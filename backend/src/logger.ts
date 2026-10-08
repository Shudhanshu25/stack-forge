import { trace } from '@opentelemetry/api';
import { pino, type Logger } from 'pino';

export function createLogger(level: string, service = 'api'): Logger {
  return pino({
    level,
    base: { service },
    // Correlates log lines with traces when tracing is on.
    mixin() {
      const id = trace.getActiveSpan()?.spanContext().traceId;
      return id && !/^0+$/.test(id) ? { traceId: id } : {};
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    // Never log credentials, tokens or cookies.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
        '*.accessToken',
        '*.refreshToken',
      ],
      censor: '[redacted]',
    },
  });
}
