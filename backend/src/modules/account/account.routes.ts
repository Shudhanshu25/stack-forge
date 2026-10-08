import { Router, type Request, type RequestHandler, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { AccountDeleteRequest } from '@stackforge/shared';
import type { Config } from '../../config.js';
import { AppError } from '../../errors.js';
import { authOf } from '../../http/authenticate.js';
import { sendContract, validateBody } from '../../http/validate.js';
import { REFRESH_COOKIE, readCookie } from '../auth/auth.controller.js';
import type { AuthService } from '../auth/auth.service.js';
import type { LlmUsageService } from '../llm/llm-usage.service.js';
import type { AccountService } from './account.service.js';

export function accountRoutes(
  account: AccountService,
  auth: AuthService,
  usage: LlmUsageService,
  config: Config,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    keyGenerator: (req) => req.auth?.userId ?? req.ip ?? 'anonymous',
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: () => {
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests, try again later');
    },
  });

  /** Today's LLM token use against the daily quota (the UI shows it when it runs out). */
  router.get('/llm-usage', authenticate, async (req: Request, res: Response) => {
    const summary = await usage.summary(authOf(req).userId);
    sendContract(res, 200, 'llm-usage-summary.schema.json', summary);
  });

  /** Everything stored about the user, as a JSON download. */
  router.get('/export', authenticate, limit, async (req: Request, res: Response) => {
    const userId = authOf(req).userId;
    const sessions = await auth.listSessions(userId, readCookie(req, REFRESH_COOKIE));
    const data = await account.export(userId, sessions);
    const day = data.exportedAt.slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="stackforge-export-${day}.json"`);
    sendContract(res, 200, 'data-export.schema.json', data);
  });

  /** Deletes the account and all its data, and ends this session. */
  router.delete(
    '/',
    authenticate,
    limit,
    validateBody('account-delete-request.schema.json'),
    async (req: Request, res: Response) => {
      await account.delete(authOf(req).userId, req.body as AccountDeleteRequest);
      res.clearCookie(REFRESH_COOKIE, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: 'strict',
        path: config.cookiePath,
      });
      res.status(204).end();
    },
  );
  return router;
}
