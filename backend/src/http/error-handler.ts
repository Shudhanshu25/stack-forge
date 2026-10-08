import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../errors.js';
import { reportError } from '../observability/sentry.js';
import { activeTraceId } from '../observability/tracing.js';

interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

export function isDatabaseUnavailable(err: unknown): boolean {
  return (
    err instanceof mongoose.Error.MongooseServerSelectionError ||
    (err instanceof Error &&
      (err.name === 'MongoNetworkError' ||
        err.name === 'MongoServerSelectionError' ||
        err.name === 'MongoNotConnectedError' ||
        /buffering timed out|Client must be connected|before initial connection/i.test(
          err.message,
        )))
  );
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const bodyError = err as BodyParserError;
  if (bodyError?.type === 'entity.too.large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
  }
  if (bodyError?.type === 'entity.parse.failed') {
    return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
  if (bodyError?.type && bodyError.status && bodyError.status < 500) {
    return new AppError(bodyError.status, 'BAD_REQUEST', bodyError.message);
  }
  if (isDatabaseUnavailable(err)) {
    return new AppError(503, 'SERVICE_UNAVAILABLE', 'Database is unavailable, try again shortly');
  }
  return new AppError(500, 'INTERNAL_ERROR', 'Internal server error');
}

export const notFoundHandler: RequestHandler = (req) => {
  throw new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
};

/** The single place errors become HTTP responses: { error: { code, message, details } }. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = toAppError(err);
  if (appError.status >= 500) {
    req.log?.error({ err }, appError.message);
    // Expected outages (engine/database/queue down) are logged; only bugs go to Sentry.
    if (appError.status === 500) {
      reportError(err, {
        requestId: String(req.id ?? ''),
        userId: req.auth?.userId,
        traceId: activeTraceId(),
      });
    }
  } else {
    req.log?.info({ code: appError.code, status: appError.status }, appError.message);
  }
  // Internal details (including contract violations) are logged, never sent.
  const details = appError.status >= 500 ? null : appError.details;
  res.status(appError.status).json({
    error: { code: appError.code, message: appError.message, details },
  });
};
