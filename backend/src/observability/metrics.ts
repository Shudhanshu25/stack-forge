import { createServer, type Server } from 'node:http';
import type { RequestHandler } from 'express';
import client from 'prom-client';

/**
 * Prometheus metrics for this process (API or worker). Route labels are templates
 * (/api/v1/simulations/:id/turns), never raw paths, so cardinality stays bounded.
 */
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const SECONDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'HTTP requests by route template and status',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

export const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency by route template',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: SECONDS,
  registers: [registry],
});

export const jobDuration = new client.Histogram({
  name: 'turn_job_duration_seconds',
  help: 'Turn job duration from claim to final status, by outcome',
  labelNames: ['outcome'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 40, 60, 120],
  registers: [registry],
});

/** Queue depth is read from Redis when Prometheus scrapes (only the API registers a reader). */
export function registerQueueDepth(read: () => Promise<Record<string, number>>): void {
  if (registry.getSingleMetric('turn_queue_jobs')) return;
  new client.Gauge({
    name: 'turn_queue_jobs',
    help: 'Turn jobs in the queue by state',
    labelNames: ['state'] as const,
    registers: [registry],
    async collect() {
      try {
        for (const [state, count] of Object.entries(await read())) this.set({ state }, count);
      } catch {
        // Redis unavailable: keep the last values; Redis health is reported separately.
      }
    },
  });
}

/** The route template the request matched, or "unmatched". */
export function routeOf(req: { baseUrl: string; route?: { path?: unknown } }): string {
  if (!req.route) return 'unmatched';
  const path = String(req.route.path ?? '');
  return `${req.baseUrl}${path === '/' ? '' : path}` || '/';
}

export const metricsMiddleware: RequestHandler = (req, res, next) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const labels = { method: req.method, route: routeOf(req), status: String(res.statusCode) };
    end(labels);
    httpRequests.inc(labels);
  });
  next();
};

export const metricsHandler: RequestHandler = async (_req, res) => {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
};

/**
 * The worker has no HTTP server of its own: serve /metrics on a separate port. If the port
 * cannot be opened the worker keeps processing turns; only its metrics are missing.
 */
export function serveMetrics(port: number, onError: (err: Error) => void = () => {}): Server {
  const server = createServer((req, res) => {
    if (req.url !== '/metrics') {
      res.statusCode = 404;
      res.end();
      return;
    }
    registry
      .metrics()
      .then((body) => {
        res.setHeader('Content-Type', registry.contentType);
        res.end(body);
      })
      .catch(() => {
        res.statusCode = 500;
        res.end();
      });
  });
  server.on('error', onError);
  return server.listen(port);
}
