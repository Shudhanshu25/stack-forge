import * as Sentry from '@sentry/react';

/** Error tracking, on when the build sets VITE_SENTRY_DSN. Errors only, no tracing or replays. */
export function initMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_RELEASE_SHA,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

/**
 * Reports a server-side failure the user saw, tagged with the API's request id so the event can
 * be matched to the backend log line and trace.
 */
export function reportServerError(
  status: number,
  code: string,
  path: string,
  requestId: string | null,
): void {
  if (status < 500 || !Sentry.isEnabled()) return;
  Sentry.withScope((scope) => {
    if (requestId) scope.setTag('requestId', requestId);
    scope.setTag('apiCode', code);
    scope.setContext('api', { status, path });
    Sentry.captureMessage(`API ${status} ${code} on ${path}`, 'error');
  });
}

export const ErrorBoundary = Sentry.ErrorBoundary;
