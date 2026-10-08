import type { RequestHandler, Response } from 'express';
import { check, type SchemaId } from '../contracts.js';
import { AppError } from '../errors.js';

/** Rejects the request with 400 unless the body matches the shared schema. */
export function validateBody(id: SchemaId): RequestHandler {
  return (req, _res, next) => {
    const issues = check(id, req.body);
    if (issues) throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', issues);
    next();
  };
}

/** Sends a response body after checking it against its shared schema; a mismatch is a server bug. */
export function sendContract(res: Response, status: number, id: SchemaId, body: unknown): void {
  const issues = check(id, body);
  if (issues) {
    throw new AppError(500, 'CONTRACT_VIOLATION', `Response does not match ${id}`, issues);
  }
  res.status(status).json(body);
}
