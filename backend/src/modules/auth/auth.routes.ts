import { Router, type RequestHandler } from 'express';
import { rateLimit, type Options } from 'express-rate-limit';
import type { Config } from '../../config.js';
import { AppError } from '../../errors.js';
import { validateBody } from '../../http/validate.js';
import type { AuthController } from './auth.controller.js';

const WINDOW_MS = 15 * 60 * 1000;

/**
 * A per-client limit for one action. Every action counts separately, so failed logins can never
 * block the password reset that recovers from them. The 429 says which action was limited and
 * how long to wait (details.retryAfterSeconds, also the Retry-After header).
 */
function limiter(
  limit: number,
  action: string,
  options: Partial<Pick<Options, 'skipSuccessfulRequests'>> = {},
): RequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...options,
    handler: (req, res) => {
      const reset = (req as { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(((reset?.getTime() ?? Date.now() + WINDOW_MS) - Date.now()) / 1000),
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      const minutes = Math.ceil(retryAfterSeconds / 60);
      throw new AppError(
        429,
        'RATE_LIMITED',
        `Too many ${action} attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        { action, retryAfterSeconds },
      );
    },
  });
}

export function authRoutes(
  controller: AuthController,
  config: Config,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  // Credential and email-sending actions get the strict limit, each with its own counter;
  // session endpoints run on every page load and share a lenient one.
  const max = config.authRateLimitMax;
  const lenient = limiter(max * 5, 'session');

  router.get('/options', lenient, controller.options);
  router.post(
    '/register',
    limiter(max, 'sign-up'),
    validateBody('register-request.schema.json'),
    controller.register,
  );
  // Only failed logins count: signing in successfully never uses up the allowance.
  router.post(
    '/login',
    limiter(max, 'sign-in', { skipSuccessfulRequests: true }),
    validateBody('login-request.schema.json'),
    controller.login,
  );
  router.post('/refresh', lenient, controller.refresh);
  router.post('/logout', lenient, controller.logout);
  router.get('/me', lenient, authenticate, controller.me);
  router.post('/me/onboarding', lenient, authenticate, controller.completeOnboarding);

  router.post(
    '/verify-email',
    limiter(max, 'email confirmation'),
    validateBody('verify-email-request.schema.json'),
    controller.verifyEmail,
  );
  router.post(
    '/verify-email/resend',
    limiter(max, 'confirmation email'),
    authenticate,
    controller.resendVerification,
  );
  router.post(
    '/password-reset',
    limiter(max, 'password reset'),
    validateBody('password-reset-request.schema.json'),
    controller.requestPasswordReset,
  );
  // Code checks have their own counter on top of the five tries each code allows.
  router.post(
    '/password-reset/verify',
    limiter(max, 'code check'),
    validateBody('password-reset-verify-request.schema.json'),
    controller.verifyPasswordResetCode,
  );
  router.post(
    '/password-reset/confirm',
    limiter(max, 'new password'),
    validateBody('password-reset-confirm-request.schema.json'),
    controller.confirmPasswordReset,
  );

  router.get('/sessions', lenient, authenticate, controller.sessions);
  router.delete('/sessions/:id', lenient, authenticate, controller.revokeSession);

  const google = limiter(max, 'Google sign-in');
  router.get('/google/start', google, controller.googleStart);
  router.get('/google/callback', google, controller.googleCallback);

  return router;
}
