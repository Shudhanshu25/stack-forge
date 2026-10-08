import { randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Logger } from 'pino';
import type {
  AuthOptions,
  AuthResponse,
  LoginRequest,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  PasswordResetVerifyRequest,
  RegisterRequest,
  VerifyEmailRequest,
} from '@stackforge/shared';
import type { Config } from '../../config.js';
import { notFound } from '../../errors.js';
import { authOf } from '../../http/authenticate.js';
import { sendContract } from '../../http/validate.js';
import type { AuthService, Session } from './auth.service.js';
import { describeDevice } from './device.js';
import { pkcePair, type GoogleOAuth } from './google.js';

export const REFRESH_COOKIE = 'sf_refresh';
/** Holds the OAuth state and PKCE verifier between the redirect to Google and the callback. */
const OAUTH_COOKIE = 'sf_oauth';
const OAUTH_TTL_SECONDS = 600;

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

const deviceOf = (req: Request) => describeDevice(req.header('User-Agent'));

export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: Config,
    private readonly google: GoogleOAuth,
    private readonly logger: Logger,
  ) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'strict',
      path: this.config.cookiePath,
    };
  }

  /** Lax: Google's redirect back to the callback is a cross-site navigation. */
  private oauthCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: `${this.config.cookiePath}/google`,
      maxAge: OAUTH_TTL_SECONDS * 1000,
    };
  }

  private setRefreshCookie(res: Response, session: Session): void {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...this.cookieOptions(),
      expires: session.refreshTokenExpiresAt,
    });
  }

  private sendSession(res: Response, status: number, session: Session): void {
    this.setRefreshCookie(res, session);
    const body: AuthResponse = {
      user: session.user,
      accessToken: session.accessToken,
      accessTokenExpiresIn: session.accessTokenExpiresIn,
    };
    sendContract(res, status, 'auth-response.schema.json', body);
  }

  options = async (_req: Request, res: Response) => {
    const body: AuthOptions = { google: this.google.enabled };
    sendContract(res, 200, 'auth-options.schema.json', body);
  };

  register = async (req: Request, res: Response) => {
    this.sendSession(
      res,
      201,
      await this.auth.register(req.body as RegisterRequest, deviceOf(req)),
    );
  };

  login = async (req: Request, res: Response) => {
    this.sendSession(res, 200, await this.auth.login(req.body as LoginRequest, deviceOf(req)));
  };

  refresh = async (req: Request, res: Response) => {
    try {
      this.sendSession(res, 200, await this.auth.refresh(readCookie(req, REFRESH_COOKIE)));
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
      throw err;
    }
  };

  logout = async (req: Request, res: Response) => {
    await this.auth.logout(readCookie(req, REFRESH_COOKIE));
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    res.status(204).end();
  };

  completeOnboarding = async (req: Request, res: Response) => {
    const user = await this.auth.completeOnboarding(authOf(req).userId);
    sendContract(res, 200, 'user.schema.json', user);
  };

  me = async (req: Request, res: Response) => {
    sendContract(res, 200, 'user.schema.json', await this.auth.me(authOf(req).userId));
  };

  verifyEmail = async (req: Request, res: Response) => {
    const user = await this.auth.verifyEmail((req.body as VerifyEmailRequest).token);
    sendContract(res, 200, 'user.schema.json', user);
  };

  resendVerification = async (req: Request, res: Response) => {
    await this.auth.resendVerification(authOf(req).userId);
    res.status(202).end();
  };

  requestPasswordReset = async (req: Request, res: Response) => {
    await this.auth.requestPasswordReset((req.body as PasswordResetRequest).email);
    res.status(202).end();
  };

  verifyPasswordResetCode = async (req: Request, res: Response) => {
    const result = await this.auth.verifyPasswordResetCode(req.body as PasswordResetVerifyRequest);
    sendContract(res, 200, 'password-reset-verify-response.schema.json', result);
  };

  confirmPasswordReset = async (req: Request, res: Response) => {
    await this.auth.confirmPasswordReset(req.body as PasswordResetConfirmRequest);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    res.status(204).end();
  };

  sessions = async (req: Request, res: Response) => {
    const sessions = await this.auth.listSessions(
      authOf(req).userId,
      readCookie(req, REFRESH_COOKIE),
    );
    sendContract(res, 200, 'session-list-response.schema.json', { sessions });
  };

  revokeSession = async (req: Request<{ id: string }>, res: Response) => {
    await this.auth.revokeSession(authOf(req).userId, req.params.id);
    res.status(204).end();
  };

  /** Starts Google sign-in: remembers state + PKCE verifier, then redirects to Google. */
  googleStart = async (_req: Request, res: Response) => {
    if (!this.google.enabled) throw notFound('Google sign-in');
    const state = randomBytes(24).toString('base64url');
    const { verifier, challenge } = pkcePair();
    const sealed = jwt.sign({ state, verifier }, this.config.jwtAccessSecret, {
      expiresIn: OAUTH_TTL_SECONDS,
      audience: 'google-oauth',
    });
    res.cookie(OAUTH_COOKIE, sealed, this.oauthCookieOptions());
    res.redirect(302, this.google.authorizationUrl(state, challenge));
  };

  /**
   * Google redirects here. On success the refresh cookie is set and the browser goes back to the
   * app, which then calls /auth/refresh like on any page load. Errors go back to the login page.
   */
  googleCallback = async (req: Request, res: Response) => {
    if (!this.google.enabled) throw notFound('Google sign-in');
    const fail = (reason: string) => {
      this.logger.info({ reason }, 'google sign-in failed');
      res.redirect(302, `${this.config.appUrl}/login?error=google`);
    };
    const sealed = readCookie(req, OAUTH_COOKIE);
    res.clearCookie(OAUTH_COOKIE, { ...this.oauthCookieOptions(), maxAge: undefined });
    const { code, state, error } = req.query as Record<string, string | undefined>;
    if (error || !code || !state || !sealed) return fail(error ?? 'missing code, state or cookie');
    let saved: { state: string; verifier: string };
    try {
      saved = jwt.verify(sealed, this.config.jwtAccessSecret, {
        audience: 'google-oauth',
      }) as typeof saved;
    } catch {
      return fail('state cookie invalid or expired');
    }
    if (saved.state !== state) return fail('state mismatch');
    try {
      const identity = await this.google.exchange(code, saved.verifier);
      const session = await this.auth.googleSignIn(identity, deviceOf(req));
      this.setRefreshCookie(res, session);
      res.redirect(302, `${this.config.appUrl}/auth/google/done`);
    } catch (err) {
      fail((err as Error).message);
    }
  };
}
