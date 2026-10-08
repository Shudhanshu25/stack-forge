import { Router, type RequestHandler } from 'express';
import { requireRole } from '../../http/authenticate.js';
import { sendContract } from '../../http/validate.js';
import type { AdminService } from './admin.service.js';

export function adminRoutes(admin: AdminService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate, requireRole('ADMIN'));
  router.get('/stats', async (_req, res) => {
    sendContract(res, 200, 'admin-stats.schema.json', await admin.stats());
  });
  return router;
}
