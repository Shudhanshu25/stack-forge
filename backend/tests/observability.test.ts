import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { HttpEngineClient } from '../src/engine/engine-client.js';
import { JobModel } from '../src/modules/simulations/job.model.js';
import { inSpan } from '../src/observability/tracing.js';
import { authHeader, fixture, harness, novaTech, register } from './helpers.js';

const exporter = new InMemorySpanExporter();
let provider: NodeTracerProvider;

beforeAll(() => {
  provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  provider.register();
});
afterAll(() => provider.shutdown());
beforeEach(() => exporter.reset());

async function playOneTurn() {
  const h = harness();
  const user = await register(h.app);
  const startup = await request(h.app)
    .post('/api/v1/startups')
    .set(authHeader(user))
    .send(novaTech);
  const sim = await request(h.app)
    .post(`/api/v1/startups/${startup.body.id}/simulation`)
    .set(authHeader(user))
    .send({ seed: 2024 });
  const job = await request(h.app)
    .post(`/api/v1/simulations/${sim.body.id}/turns`)
    .set(authHeader(user))
    .send({ decisions: [] })
    .expect(202);
  await h.drain();
  return { h, simulationId: sim.body.id as string, jobId: job.body.jobId as string };
}

describe('tracing', () => {
  it('one turn is one trace: the worker continues the API request span', async () => {
    const { jobId } = await playOneTurn();
    const spans = exporter.getFinishedSpans();
    const requestSpan = spans.find((s) => s.name === 'POST /api/v1/simulations/:id/turns');
    const jobSpan = spans.find((s) => s.name === 'turn.job');
    expect(requestSpan).toBeDefined();
    expect(jobSpan).toBeDefined();
    expect(jobSpan!.spanContext().traceId).toBe(requestSpan!.spanContext().traceId);
    expect(jobSpan!.attributes['stackforge.job_id']).toBe(jobId);
    const stored = await JobModel.findById(jobId).lean();
    expect(String((stored!.traceContext as Record<string, string>).traceparent)).toContain(
      requestSpan!.spanContext().traceId,
    );
  });

  it('calls to the simulation service carry the trace context', async () => {
    let seen: IncomingHttpHeaders = {};
    const server = createServer((req, res) => {
      seen = req.headers;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({ state: fixture.initialState, engineVersion: fixture.engineVersion }),
      );
    }).listen(0);
    try {
      const client = new HttpEngineClient(
        `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        2000,
        2000,
      );
      const traceId = await inSpan('test.parent', {}, async (span) => {
        await client.start({ configuration: fixture.configuration, seed: 1 });
        return span.spanContext().traceId;
      });
      expect(seen.traceparent).toMatch(new RegExp(`^00-${traceId}-[0-9a-f]{16}-01$`));
    } finally {
      server.close();
    }
  });
});

describe('metrics', () => {
  it('counts requests by route template, never by raw id', async () => {
    const { h, simulationId } = await playOneTurn();
    const res = await request(h.app).get('/metrics').expect(200);
    expect(res.text).toContain(
      'http_requests_total{method="POST",route="/api/v1/simulations/:id/turns",status="202"}',
    );
    expect(res.text).not.toContain(simulationId);
    expect(res.text).toMatch(/turn_job_duration_seconds_count\{outcome="completed"\} [1-9]/);
  });

  it('is not part of the public API', async () => {
    const { h } = await playOneTurn();
    await request(h.app).get('/api/v1/metrics').expect(404);
  });
});

describe('worker metrics endpoint', () => {
  it('a port that cannot be opened is reported, not fatal', async () => {
    const { serveMetrics } = await import('../src/observability/metrics.js');
    const first = serveMetrics(0);
    await new Promise((r) => first.once('listening', r));
    const port = (first.address() as AddressInfo).port;
    const reported = await new Promise<Error>((resolve) => serveMetrics(port, resolve));
    expect(reported.message).toMatch(/EADDRINUSE|EACCES/);
    first.close();
  });
});
