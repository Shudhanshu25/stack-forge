import { createHash, randomBytes } from 'node:crypto';
import type { Config } from '../../config.js';

/** Who Google says signed in. */
export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

/** Google sign-in (OAuth 2.0 authorization code flow with PKCE, OpenID Connect). */
export interface GoogleOAuth {
  readonly enabled: boolean;
  authorizationUrl(state: string, codeChallenge: string): string;
  exchange(code: string, codeVerifier: string): Promise<GoogleIdentity>;
}

export class GoogleSignInError extends Error {}

/** PKCE pair: the verifier stays server-side (in a signed cookie), the challenge goes to Google. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

export class HttpGoogleOAuth implements GoogleOAuth {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
  ) {}

  get enabled(): boolean {
    return Boolean(this.clientId);
  }

  authorizationUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async exchange(code: string, codeVerifier: string): Promise<GoogleIdentity> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new GoogleSignInError(`token exchange failed (${res.status})`);
    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) throw new GoogleSignInError('no id_token in the token response');
    return this.identityFrom(body.id_token);
  }

  /**
   * The ID token came straight from Google's token endpoint over TLS in exchange for our
   * client secret, so (per OpenID Connect Core 3.1.3.7) its claims are checked rather than its
   * signature: issuer, audience and expiry.
   */
  identityFrom(idToken: string, now = Date.now()): GoogleIdentity {
    const [, payload] = idToken.split('.');
    let claims: Record<string, unknown>;
    try {
      claims = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8'));
    } catch {
      throw new GoogleSignInError('malformed id_token');
    }
    if (!ISSUERS.has(String(claims.iss))) throw new GoogleSignInError('wrong issuer');
    if (claims.aud !== this.clientId) throw new GoogleSignInError('wrong audience');
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < now) {
      throw new GoogleSignInError('expired id_token');
    }
    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') {
      throw new GoogleSignInError('id_token lacks sub or email');
    }
    return {
      sub: claims.sub,
      email: claims.email.toLowerCase(),
      emailVerified: claims.email_verified === true,
      name:
        typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : claims.email,
    };
  }
}

export function createGoogleOAuth(config: Config): GoogleOAuth {
  return new HttpGoogleOAuth(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );
}
