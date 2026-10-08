import type { IncomingMessage, Server } from 'node:http';
import { isValidObjectId } from 'mongoose';
import type { Logger } from 'pino';
import { WebSocket, WebSocketServer } from 'ws';
import type { WsClientMessage, WsServerMessage } from '@stackforge/shared';
import { check } from '../contracts.js';
import { AppError } from '../errors.js';
import type { TokenService } from '../modules/auth/tokens.js';
import { SimulationModel } from '../modules/simulations/simulation.model.js';
import type { EventBus, SimulationEvent } from '../queue/event-bus.js';

const AUTH_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 30_000;

interface Client {
  socket: WebSocket;
  userId: string | null;
  rooms: Set<string>;
  alive: boolean;
  expiryTimer?: NodeJS.Timeout;
}

/**
 * /api/v1/ws: authenticated WebSocket with one room per simulation. The browser sends
 * { type: "auth", token } first, then subscribes to simulations it owns. Events from the
 * worker arrive through the event bus and are relayed to the matching room.
 */
export class SimulationSocketServer {
  private readonly wss: WebSocketServer;
  private readonly clients = new Set<Client>();
  private readonly rooms = new Map<string, Set<Client>>();
  private heartbeat?: NodeJS.Timeout;
  private unsubscribe?: () => Promise<void>;

  constructor(
    server: Server,
    private readonly tokens: TokenService,
    private readonly bus: EventBus,
    private readonly allowedOrigin: string,
    private readonly logger: Logger,
  ) {
    this.wss = new WebSocketServer({
      server,
      path: '/api/v1/ws',
      maxPayload: 8 * 1024,
      verifyClient: ({ origin }: { origin?: string }) => !origin || origin === this.allowedOrigin,
    });
    this.wss.on('connection', (socket, req) => this.onConnection(socket, req));
  }

  async start(): Promise<void> {
    this.unsubscribe = await this.bus.subscribe((event) => this.broadcast(event));
    this.heartbeat = setInterval(() => this.sweep(), HEARTBEAT_MS);
    this.heartbeat.unref();
  }

  async close(): Promise<void> {
    clearInterval(this.heartbeat);
    await this.unsubscribe?.();
    for (const client of this.wss.clients) client.terminate();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }

  private onConnection(socket: WebSocket, _req: IncomingMessage) {
    const client: Client = { socket, userId: null, rooms: new Set(), alive: true };
    this.clients.add(client);
    const authTimer = setTimeout(() => {
      if (!client.userId) socket.close(4001, 'authentication required');
    }, AUTH_TIMEOUT_MS);
    socket.on('pong', () => {
      client.alive = true;
    });
    socket.on('message', (raw) => {
      void this.onMessage(client, raw.toString()).catch((err: unknown) => {
        const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
        const message = err instanceof AppError ? err.message : 'Something went wrong';
        if (!(err instanceof AppError)) this.logger.error({ err }, 'websocket message failed');
        send(socket, { type: 'error', error: { code, message } });
      });
    });
    socket.on('close', () => {
      clearTimeout(authTimer);
      clearTimeout(client.expiryTimer);
      this.clients.delete(client);
      for (const room of [...client.rooms]) this.leave(client, room);
    });
  }

  private async onMessage(client: Client, raw: string) {
    let message: WsClientMessage;
    try {
      message = JSON.parse(raw) as WsClientMessage;
    } catch {
      throw new AppError(400, 'INVALID_JSON', 'Message is not valid JSON');
    }
    if (check('ws-client-message.schema.json', message)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Message does not match the protocol');
    }

    if (message.type === 'ping') return send(client.socket, { type: 'pong' });
    if (message.type === 'auth') return this.authenticate(client, message.token ?? '');
    if (!client.userId) throw new AppError(401, 'UNAUTHORIZED', 'Send auth first');

    const simulationId = message.simulationId ?? '';
    if (message.type === 'subscribe') {
      const owned =
        isValidObjectId(simulationId) &&
        (await SimulationModel.exists({ _id: simulationId, ownerId: client.userId }));
      if (!owned) throw new AppError(404, 'NOT_FOUND', 'Simulation not found');
      this.join(client, simulationId);
      return send(client.socket, { type: 'subscribed', simulationId });
    }
    this.leave(client, simulationId);
    send(client.socket, { type: 'unsubscribed', simulationId });
  }

  private authenticate(client: Client, token: string) {
    const auth = this.tokens.verifyAccessToken(token); // throws 401 AppError when invalid
    client.userId = auth.userId;
    // Close when the token expires; the browser reconnects with a fresh one.
    clearTimeout(client.expiryTimer);
    if (auth.expiresAt) {
      const ms = Math.max(0, auth.expiresAt * 1000 - Date.now());
      client.expiryTimer = setTimeout(() => client.socket.close(4001, 'token expired'), ms);
      client.expiryTimer.unref();
    }
    send(client.socket, { type: 'ready' });
  }

  private join(client: Client, room: string) {
    client.rooms.add(room);
    let members = this.rooms.get(room);
    if (!members) this.rooms.set(room, (members = new Set()));
    members.add(client);
  }

  private leave(client: Client, room: string) {
    client.rooms.delete(room);
    const members = this.rooms.get(room);
    members?.delete(client);
    if (members?.size === 0) this.rooms.delete(room);
  }

  private broadcast(event: SimulationEvent) {
    const members = this.rooms.get(event.simulationId);
    if (!members) return;
    for (const client of members) send(client.socket, event);
  }

  /** Drops connections that missed the previous ping. */
  private sweep() {
    for (const client of this.clients) {
      if (!client.alive) {
        client.socket.terminate();
        continue;
      }
      client.alive = false;
      client.socket.ping();
    }
  }
}

function send(socket: WebSocket, message: WsServerMessage) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}
