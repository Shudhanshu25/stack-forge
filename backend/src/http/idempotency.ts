import type { Request } from 'express';
import { AppError } from '../errors.js';

const KEY = /^[A-Za-z0-9._:-]{1,128}$/;

/** The request's Idempotency-Key header, if present and well formed. */
export function idempotencyKeyOf(req: Request): string | undefined {
  const value = req.header('Idempotency-Key');
  if (value === undefined) return undefined;
  if (!KEY.test(value)) {
    throw new AppError(
      400,
      'INVALID_IDEMPOTENCY_KEY',
      'Idempotency-Key must be 1-128 characters of letters, digits, . _ : or -',
    );
  }
  return value;
}
