import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { WsServerMessage } from '@stackforge/shared';
import { createLogger } from '../src/logger.js';
import { TokenService } from '../src/modules/auth/tokens.js';
import { SimulationSocketServer } from '../src/ws/ws-server.js';
import { authHeader, harness, novaTech, register, type RegisteredUser } from './helpers.js';

let h: ReturnType<typeof harness>;
let server: Server;
let sockets: SimulationSocketServer;
let url: string;
let user: RegisteredUser;
let simulationId: string;
const origin = 'http://localhost:5173';

/** Opens a socket and collects every message it receives. */
async function connect(headers: Record<string, string> = { Origin: origin }) {
  const ws = new WebSocket(url, { headers });
  const messages: WsServerMessage[] = [];
  ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  const next = (type: WsServerMessage['type']) =>
    new Promise<WsServerMessage>((resolve, reject) => {
      const deadline = Date.now() + 3000;
      const poll = () => {
        const found = messages.find((m) => m.type === type);
        if (found) {
          messages.splice(messages.indexOf(found), 1);
          resolve(found);
        } else if (Date.now() > deadline) reject(new Error(`no ${type} message`));
        else setTimeout(poll, 10);
      };
      poll();
    });
  const send = (message: object) => ws.send(JSON.stringify(message));
  return { ws, messages, next, send };
}

beforeEach(async () => {
  h = harness();
  server = createServer(h.app);
  sockets = new SimulationSocketServer(
    server,
    new TokenService(h.config),
    h.bus,
    origin,
    createLogger('silent'),
  );
  await sockets.start();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/ws`;

  user = await register(h.app);
  const startup = await request(h.app)
    .post('/api/v1/startups')
    .set(authHeader(user))
    .send(novaTech);
  simulationId = (
    await request(h.app)
      .post(`/api/v1/startups/${startup.body.id}/simulation`)
      .set(authHeader(user))
      .send({ seed: 1 })
  ).body.id;
});

afterEach(async () => {
  await sockets.close();
  await new Promise((resolve) => server.close(resolve));
});

describe('websocket', () => {
  it('relays stage progress and job updates to the simulation room', async () => {
    const client = await connect();
    client.send({ type: 'auth', token: user.accessToken });
    await client.next('ready');
    client.send({ type: 'subscribe', simulationId });
    expect(await client.next('subscribed')).toMatchObject({ simulationId });

    await request(h.app)
      .post(`/api/v1/simulations/${simulationId}/turns`)
      .set(authHeader(user))
      .send({ decisions: [] })
      .expect(202);
    await h.drain();

    const stage = await client.next('stage');
    expect(stage).toMatchObject({ simulationId, turnNumber: 1, stage: 'PROCESSING_DECISION' });
    await new Promise((r) => setTimeout(r, 50));
    const stages = client.messages.filter((m) => m.type === 'stage').map((m) => m.stage);
    expect(stages).toEqual(['UPDATING_FINANCIAL_MODEL', 'COMPLETE']);
    const statuses = client.messages.filter((m) => m.type === 'job').map((m) => m.job!.status);
    expect(statuses).toEqual(['QUEUED', 'RUNNING', 'COMPLETED']);
    client.ws.close();
  });

  it('requires authentication before subscribing', async () => {
    const client = await connect();
    client.send({ type: 'subscribe', simulationId });
    expect(await client.next('error')).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    client.send({ type: 'auth', token: 'not-a-token' });
    expect(await client.next('error')).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    client.ws.close();
  });

  it("does not let a user subscribe to someone else's simulation", async () => {
    const other = await register(h.app);
    const client = await connect();
    client.send({ type: 'auth', token: other.accessToken });
    await client.next('ready');
    client.send({ type: 'subscribe', simulationId });
    expect(await client.next('error')).toMatchObject({ error: { code: 'NOT_FOUND' } });
    await h.bus.publish({ type: 'stage', simulationId, stage: 'COMPLETE', progress: 100 });
    await new Promise((r) => setTimeout(r, 50));
    expect(client.messages.filter((m) => m.type === 'stage')).toEqual([]);
    client.ws.close();
  });

  it('rejects messages that break the protocol', async () => {
    const client = await connect();
    client.ws.send('not json');
    expect(await client.next('error')).toMatchObject({ error: { code: 'INVALID_JSON' } });
    client.send({ type: 'shout' });
    expect(await client.next('error')).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    client.ws.close();
  });

  it('refuses connections from other origins', async () => {
    await expect(connect({ Origin: 'https://evil.example' })).rejects.toThrow();
  });
});
