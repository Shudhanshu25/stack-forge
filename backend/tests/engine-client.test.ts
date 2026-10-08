import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { EngineError, HttpEngineClient, ndjson } from '../src/engine/engine-client.js';
import { fixture } from './helpers.js';

async function* chunks(...parts: string[]) {
  for (const part of parts) yield new TextEncoder().encode(part);
}

describe('ndjson', () => {
  it('parses lines split across chunks', async () => {
    const out = [];
    for await (const item of ndjson(chunks('{"a":1}\n{"b"', ':2}\n\n{"c":3}'))) out.push(item);
    expect(out).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });
});

let server: Server | undefined;
afterEach(
  () => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())),
);

/** A stand-in for FastAPI that answers every request with the given handler. */
async function stub(handler: Parameters<typeof createServer>[1]): Promise<string> {
  server = createServer(handler);
  await new Promise<void>((resolve) => server!.listen(0, resolve));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

const turnRequest = {
  state: fixture.initialState,
  decisions: [],
  configuration: fixture.configuration,
  seed: fixture.seed,
  turnNumber: 1,
  agentMode: 'rules' as const,
};

describe('HttpEngineClient', () => {
  it('streams stages, then returns the record', async () => {
    const base = await stub((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      res.write(
        JSON.stringify({ type: 'stage', stage: 'PROCESSING_DECISION', progress: 45 }) + '\n',
      );
      setTimeout(() => {
        res.end(JSON.stringify({ type: 'result', record: fixture.records[0] }) + '\n');
      }, 20);
    });
    const stages: string[] = [];
    const outcome = await new HttpEngineClient(base, 1000, 1000).runTurn(turnRequest, async (s) => {
      stages.push(s.stage);
    });
    expect(stages).toEqual(['PROCESSING_DECISION']);
    expect(outcome).toEqual({ record: fixture.records[0] });
  });

  it('rejects events that break the contract', async () => {
    const base = await stub((_req, res) => {
      res.end(JSON.stringify({ type: 'result', record: { turnNumber: 'one' } }) + '\n');
    });
    await expect(
      new HttpEngineClient(base, 1000, 1000).runTurn(turnRequest, async () => {}),
    ).rejects.toMatchObject({ code: 'ENGINE_CONTRACT_VIOLATION' });
  });

  it('reports a stream that ends without a result', async () => {
    const base = await stub((_req, res) => res.end(''));
    await expect(
      new HttpEngineClient(base, 1000, 1000).runTurn(turnRequest, async () => {}),
    ).rejects.toMatchObject({ code: 'ENGINE_PROTOCOL_ERROR' });
  });

  it('maps timeouts and connection failures to unavailable errors', async () => {
    const base = await stub(() => {
      /* never answers */
    });
    const timeout = await new HttpEngineClient(base, 50, 50)
      .start({ configuration: fixture.configuration, seed: 1 })
      .catch((e: EngineError) => e);
    expect(timeout).toMatchObject({ code: 'ENGINE_TIMEOUT', unavailable: true });

    const refused = await new HttpEngineClient('http://127.0.0.1:1', 500, 500)
      .start({ configuration: fixture.configuration, seed: 1 })
      .catch((e: EngineError) => e);
    expect(refused).toMatchObject({ code: 'ENGINE_UNAVAILABLE', unavailable: true });
  });

  it('passes on the engine error code', async () => {
    const base = await stub((_req, res) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ error: { code: 'ENGINE_INPUT_ERROR', message: 'bad', details: null } }),
      );
    });
    await expect(
      new HttpEngineClient(base, 1000, 1000).start({
        configuration: fixture.configuration,
        seed: 1,
      }),
    ).rejects.toMatchObject({ code: 'ENGINE_INPUT_ERROR' });
  });

  it('refuses to send a request that breaks the contract', async () => {
    const client = new HttpEngineClient('http://127.0.0.1:1', 100, 100);
    await expect(
      client.start({ configuration: fixture.configuration, seed: -1 }),
    ).rejects.toMatchObject({ code: 'ENGINE_CONTRACT_VIOLATION' });
  });
});
