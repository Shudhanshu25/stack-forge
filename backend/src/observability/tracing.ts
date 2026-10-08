import {
  context,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
  type Context,
  type Span,
} from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import type { RequestHandler } from 'express';
import { routeOf } from './metrics.js';

/**
 * OpenTelemetry tracing. A turn is one trace: the API request span, the worker's job span (its
 * context travels in the job document), the call to FastAPI (W3C traceparent header) and the
 * pipeline and LLM spans inside the simulation service. Enabled when
 * OTEL_EXPORTER_OTLP_ENDPOINT is set (e.g. http://tempo:4318).
 */
export function initTracing(
  serviceName: string,
  endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
): NodeTracerProvider | null {
  if (!endpoint) return null;
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` }),
      ),
    ],
  });
  provider.register(); // AsyncLocalStorage context and the W3C trace-context propagator
  return provider;
}

export const tracer = () => trace.getTracer('stackforge');

/** W3C headers (traceparent, tracestate) for a context; empty when tracing is off. */
export function traceHeaders(ctx: Context = context.active()): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(ctx, carrier);
  return carrier;
}

export function contextFrom(carrier: unknown): Context {
  return propagation.extract(
    ROOT_CONTEXT,
    carrier && typeof carrier === 'object' ? (carrier as Record<string, string>) : {},
  );
}

/** The active trace id, for log lines and error reports. */
export function activeTraceId(): string | undefined {
  const id = trace.getActiveSpan()?.spanContext().traceId;
  return id && !/^0+$/.test(id) ? id : undefined;
}

/** One server span per request, continuing an incoming traceparent if there is one. */
export const tracingMiddleware: RequestHandler = (req, res, next) => {
  const parent = propagation.extract(ROOT_CONTEXT, req.headers);
  const span = tracer().startSpan(`${req.method}`, { kind: SpanKind.SERVER }, parent);
  res.on('finish', () => {
    const route = routeOf(req);
    span.updateName(`${req.method} ${route}`);
    span.setAttributes({
      'http.request.method': req.method,
      'http.route': route,
      'http.response.status_code': res.statusCode,
      'stackforge.request_id': String(req.id ?? ''),
    });
    if (req.auth?.userId) span.setAttribute('enduser.id', req.auth.userId);
    if (res.statusCode >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
    span.end();
  });
  context.with(trace.setSpan(parent, span), next);
};

/** Runs `fn` in a span (a child of `parent`), recording failures. */
export async function inSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>,
  parent: Context = context.active(),
  kind: SpanKind = SpanKind.INTERNAL,
): Promise<T> {
  return tracer().startActiveSpan(name, { kind, attributes }, parent, async (span) => {
    try {
      return await fn(span);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
