import { Router, type RequestHandler } from 'express';
import { validateBody } from '../../http/validate.js';
import type { StartupController } from './startup.controller.js';

export function startupRoutes(controller: StartupController, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);
  router.get('/', controller.list);
  router.post('/', validateBody('startup-create-request.schema.json'), controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id', validateBody('startup-update-request.schema.json'), controller.update);
  router.delete('/:id', controller.remove);
  return router;
}

export function templateRoutes(
  controller: StartupController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.get('/', authenticate, controller.listTemplates);
  return router;
}
