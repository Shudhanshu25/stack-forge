import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/logger.js';
import { ROUTES } from '../src/openapi/catalog.js';
import { MemoryEventBus } from '../src/queue/event-bus.js';
import { FixtureEngine, InlineQueue, testApp, testConfig } from './helpers.js';

const up = async () => undefined;

function appWithSimulationDoc(simulationOpenApi: () => Promise<unknown>) {
  return createApp({
    config: testConfig(),
    logger: createLogger('silent'),
    healthChecks: { mongodb: up, redis: up, simulationEngine: up },
    engine: new FixtureEngine(),
    queue: new InlineQueue(),
    bus: new MemoryEventBus(),
    simulationOpenApi,
  });
}

/** Follows a local JSON pointer such as #/components/schemas/Enums/definitions/AdviceMode. */
function resolve(doc: unknown, ref: string): unknown {
  return ref
    .slice(2)
    .split('/')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], doc);
}

function refs(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => refs(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string') out.push(v);
      else refs(v, out);
    }
  }
  return out;
}

describe('OpenAPI documents', () => {
  it('documents every catalogued route with schemas that all resolve', async () => {
    const res = await request(testApp()).get('/api/v1/openapi.json').expect(200);
    const doc = res.body;
    expect(doc.openapi).toBe('3.1.0');
    const operations = Object.values(doc.paths as Record<string, object>).flatMap(Object.keys);
    expect(operations).toHaveLength(ROUTES.length);
    expect(doc.paths['/simulations/{id}/turns'].post.parameters).toContainEqual(
      expect.objectContaining({ name: 'Idempotency-Key', in: 'header' }),
    );
    const all = refs(doc);
    expect(all.length).toBeGreaterThan(50);
    const broken = all.filter((r) => !r.startsWith('#/') || resolve(doc, r) === undefined);
    expect(broken).toEqual([]);
  });

  it('every catalogued route is actually served', async () => {
    const app = testApp();
    const missing: string[] = [];
    for (const route of ROUTES) {
      const url = `/api/v1${route.path.replace('{id}', '65f000000000000000000001')}`;
      const res = await request(app)[route.method](url).send({});
      if (res.status === 404 && /^Route /.test(res.body?.error?.message ?? '')) {
        missing.push(`${route.method.toUpperCase()} ${route.path}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('serves the interactive viewer at /api/v1/docs', async () => {
    const res = await request(testApp()).get('/api/v1/docs/').expect(200);
    expect(res.text).toContain('swagger-ui');
  });

  it("proxies the simulation service's document, or reports it unavailable", async () => {
    const doc = { openapi: '3.1.0', info: { title: 'Stack Forge simulation service' } };
    await request(appWithSimulationDoc(async () => doc))
      .get('/api/v1/openapi/simulation.json')
      .expect(200, doc);
    const down = await request(
      appWithSimulationDoc(async () => {
        throw new Error('down');
      }),
    )
      .get('/api/v1/openapi/simulation.json')
      .expect(503);
    expect(down.body.error.code).toBe('SIMULATION_ENGINE_UNAVAILABLE');
  });
});
