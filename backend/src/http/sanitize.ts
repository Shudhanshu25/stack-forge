import type { RequestHandler } from 'express';
import { AppError } from '../errors.js';

function findOperatorKey(value: unknown, path: string): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findOperatorKey(value[i], `${path}/${i}`);
      if (found) return found;
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.')) return `${path}/${key}`;
      const found = findOperatorKey(child, `${path}/${key}`);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Rejects bodies and route params containing MongoDB operator keys ($gt, $where, dotted paths).
 * Mongoose's sanitizeFilter is enabled as a second layer.
 */
export const rejectMongoOperators: RequestHandler = (req, _res, next) => {
  const found = findOperatorKey(req.body, '') ?? findOperatorKey(req.params, '');
  if (found) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Request contains a forbidden key', [
      { path: found, message: 'keys may not start with "$" or contain "."' },
    ]);
  }
  next();
};
