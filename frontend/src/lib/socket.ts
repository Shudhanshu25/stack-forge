import type { WsServerMessage } from '@stackforge/shared';
import { API_BASE_URL, getAccessToken, refreshSession } from '../api/client';

export type SocketStatus = 'connecting' | 'live' | 'offline';

/**
 * The socket lives at <API base>/ws. The base may be absolute (development) or a path such as
 * /api/v1 behind the proxy.
 */
export function socketUrl(
  apiBase: string = API_BASE_URL,
  origin: string | undefined = globalThis.location?.origin,
): string {
  const base = new URL(apiBase, origin);
  const url = new URL(`${base.pathname.replace(/\/$/, '')}/ws`, base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/**
 * One simulation's live event stream. Authenticates with the in-memory access token, subscribes,
 * and reconnects with backoff (refreshing the token when the server closes for expiry).
 */
export class SimulationSocket {
  private socket: WebSocket | null = null;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  constructor(
    private readonly simulationId: string,
    private readonly onEvent: (event: WsServerMessage) => void,
    private readonly onStatus: (status: SocketStatus) => void,
  ) {}

  open(): void {
    this.closed = false;
    this.connect();
  }

  close(): void {
    this.closed = true;
    clearTimeout(this.timer);
    this.socket?.close();
    this.socket = null;
  }

  private connect() {
    const token = getAccessToken();
    if (!token) return this.scheduleReconnect(true);
    this.onStatus('connecting');
    const socket = new WebSocket(socketUrl());
    this.socket = socket;
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
    socket.onmessage = (message) => {
      const event = JSON.parse(String(message.data)) as WsServerMessage;
      if (event.type === 'ready') {
        socket.send(JSON.stringify({ type: 'subscribe', simulationId: this.simulationId }));
      } else if (event.type === 'subscribed') {
        this.retry = 0;
        this.onStatus('live');
      } else {
        this.onEvent(event);
      }
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.onStatus('offline');
      this.scheduleReconnect(event.code === 4001);
    };
  }

  private scheduleReconnect(refreshToken: boolean) {
    if (this.closed) return;
    const delay = Math.min(30_000, 500 * 2 ** this.retry++);
    this.timer = setTimeout(async () => {
      if (refreshToken) await refreshSession();
      if (!this.closed) this.connect();
    }, delay);
  }
}
