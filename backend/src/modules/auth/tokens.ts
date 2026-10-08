import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@stackforge/shared';
import type { Config } from '../../config.js';
import { unauthorized } from '../../errors.js';
import type { AuthContext } from '../../http/authenticate.js';

const ISSUER = 'stack-forge';
const AUDIENCE = 'stack-forge-api';
const ROLES: readonly UserRole[] = ['USER', 'ADMIN'];

export class TokenService {
  constructor(private readonly config: Config) {}

  get accessTokenTtlSeconds(): number {
    return this.config.accessTokenTtlSeconds;
  }

  signAccessToken(userId: string, role: UserRole): string {
    return jwt.sign({ role }, this.config.jwtAccessSecret, {
      algorithm: 'HS256',
      subject: userId,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: this.config.accessTokenTtlSeconds,
    });
  }

  verifyAccessToken(token: string): AuthContext {
    try {
      const payload = jwt.verify(token, this.config.jwtAccessSecret, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (typeof payload === 'string' || !payload.sub || !ROLES.includes(payload.role)) {
        throw unauthorized('Invalid access token');
      }
      return { userId: payload.sub, role: payload.role as UserRole, expiresAt: payload.exp };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw unauthorized('Access token expired', 'TOKEN_EXPIRED');
      }
      throw unauthorized('Invalid access token');
    }
  }

  /** An opaque random refresh token; only its SHA-256 hash is stored. */
  newRefreshToken(): { token: string; tokenHash: string; expiresAt: Date } {
    const token = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
    return { token, tokenHash: hashRefreshToken(token), expiresAt };
  }
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
