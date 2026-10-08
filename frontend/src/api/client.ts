import type { ApiErrorBody, AuthResponse } from '@stackforge/shared';
import { reportServerError } from '../lib/monitoring';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown,
  ) {
    super(message);
  }

  /** Field-level messages keyed by JSON pointer, e.g. { "/email": "must match format" }. */
  fieldMessages(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const d of this.details as { path?: string; message?: string }[]) {
      if (d.path && d.message && !out[d.path]) out[d.path] = d.message;
    }
    return out;
  }
}

// The access token lives only in memory; the refresh token is an httpOnly cookie.
let accessToken: string | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;
let onSessionLost: () => void = () => {};

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const API_BASE_URL = BASE_URL;

export function onSessionExpired(handler: () => void) {
  onSessionLost = handler;
}

// Reachability as the requests see it: false when a request cannot reach the API at all,
// true again on the next response of any status.
const networkListeners = new Set<(online: boolean) => void>();
let reachable = true;

function setReachable(online: boolean) {
  if (online === reachable) return;
  reachable = online;
  networkListeners.forEach((listener) => listener(online));
}

/** Calls back when the API becomes unreachable or reachable again. */
export function onNetworkChange(listener: (online: boolean) => void): () => void {
  networkListeners.add(listener);
  return () => networkListeners.delete(listener);
}

/** Probes the API's health endpoint, so recovery is noticed without waiting for a request. */
export async function probeApi(): Promise<void> {
  try {
    await fetch(`${BASE_URL}/health`, { cache: 'no-store' });
    setReachable(true);
  } catch {
    setReachable(false);
  }
}

async function raw(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: 'include' });
    setReachable(true);
    return res;
  } catch (err) {
    setReachable(false);
    throw err;
  }
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error: ApiErrorBody };
    return new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  } catch {
    return new ApiError(res.status, 'NETWORK_ERROR', res.statusText || 'Request failed', null);
  }
}

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    try {
      const res = await raw('/auth/refresh', { method: 'POST' });
      if (!res.ok) return null;
      const body = (await res.json()) as AuthResponse;
      setAccessToken(body.accessToken);
      return body;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? 'GET',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers: options.headers,
  };
  let res: Response;
  try {
    res = await raw(path, init);
    if (res.status === 401 && accessToken && !path.startsWith('/auth/')) {
      // Access token expired: refresh once and retry.
      if (await refreshSession()) res = await raw(path, init);
      else {
        setAccessToken(null);
        onSessionLost();
      }
    }
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Is the API running?', null);
  }
  if (!res.ok) {
    const error = await toError(res);
    reportServerError(res.status, error.code, path, res.headers.get('X-Request-Id'));
    throw error;
  }
  return readBody<T>(res);
}

/**
 * The JSON body, or undefined when there is none: 204, and also 202 Accepted (password reset,
 * resending the confirmation email), which succeed with an empty body.
 */
async function readBody<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text.trim() ? JSON.parse(text) : undefined) as T;
}

/**
 * Downloads a file from the API (with the access token) and saves it in the browser under the
 * name the server suggests.
 */
export async function download(path: string): Promise<void> {
  let res = await raw(path, { method: 'GET' });
  if (res.status === 401 && (await refreshSession())) res = await raw(path, { method: 'GET' });
  if (!res.ok) throw await toError(res);
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'report';
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
