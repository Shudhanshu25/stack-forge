import type { RequestHandler } from 'express';
import type { UserRole } from '@stackforge/shared';
import { forbidden, unauthorized } from '../errors.js';
import type { TokenService } from '../modules/auth/tokens.js';

export interface AuthContext {
  userId: string;
  role: UserRole;
  /** Access token expiry, seconds since the epoch. */
  expiresAt?: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

/** Requires a valid Bearer access token and attaches req.auth. */
export function authenticate(tokens: TokenService): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    req.auth = tokens.verifyAccessToken(header.slice('Bearer '.length).trim());
    req.log = req.log.child({ userId: req.auth.userId });
    next();
  };
}

export function requireRole(role: UserRole): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) throw unauthorized();
    if (req.auth.role !== role) throw forbidden();
    next();
  };
}

/** Returns the authenticated context; only valid behind authenticate(). */
export function authOf(req: { auth?: AuthContext }): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
