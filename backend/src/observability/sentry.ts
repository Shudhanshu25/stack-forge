import * as Sentry from '@sentry/node';

/**
 * Error tracking. Enabled when SENTRY_DSN is set; errors only (tracing is OpenTelemetry's job,
 * so Sentry does not install its own OpenTelemetry setup).
 */
export function initSentry(service: string, dsn = process.env.SENTRY_DSN): boolean {
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.RELEASE_SHA,
    serverName: service,
    skipOpenTelemetrySetup: true,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
  Sentry.setTag('service', service);
  return true;
}

type ErrorTags = Partial<
  Record<'requestId' | 'jobId' | 'simulationId' | 'userId' | 'traceId', string | undefined>
>;

/** Reports an unexpected error with the ids needed to find it in the logs and traces. */
export function reportError(err: unknown, tags: ErrorTags): void {
  if (!Sentry.isEnabled()) return;
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(tags)) if (value) scope.setTag(key, value);
    Sentry.captureException(err);
  });
}
