import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../../errors.js';
import { validateBody } from '../../http/validate.js';
import type { SimulationController } from './simulation.controller.js';

export function simulationRoutes(
  controller: SimulationController,
  authenticate: RequestHandler,
  adviceLimitPerWindow = 30,
): Router {
  const router = Router();
  const decisions = validateBody('decisions-request.schema.json');

  router.post(
    '/startups/:id/simulation',
    authenticate,
    validateBody('simulation-start-request.schema.json'),
    controller.start,
  );
  router.get('/startups/:id/simulations', authenticate, controller.listForStartup);

  router.get('/simulations/:id', authenticate, controller.get);
  router.get('/simulations/:id/turns', authenticate, controller.turns);
  router.get('/simulations/:id/analytics', authenticate, controller.analytics);
  router.get('/simulations/:id/report', authenticate, controller.report);
  router.post(
    '/simulations/:id/scenarios',
    authenticate,
    validateBody('scenario-request.schema.json'),
    controller.scenario,
  );
  router.post('/simulations/:id/preview', authenticate, decisions, controller.preview);
  router.post('/simulations/:id/turns', authenticate, decisions, controller.playTurn);
  // Each question costs an LLM call: limit per user.
  const adviceLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: adviceLimitPerWindow,
    keyGenerator: (req) => req.auth?.userId ?? req.ip ?? 'anonymous',
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: () => {
      throw new AppError(429, 'RATE_LIMITED', 'Too many AI CEO questions, try again later');
    },
  });
  router.post(
    '/simulations/:id/advice',
    authenticate,
    adviceLimit,
    validateBody('advice-request.schema.json'),
    controller.advise,
  );

  router.get('/jobs/:id', authenticate, controller.getJob);
  router.post('/jobs/:id/cancel', authenticate, controller.cancelJob);
  return router;
}
