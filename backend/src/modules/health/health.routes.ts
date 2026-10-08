import { Router } from 'express';
import { sendContract } from '../../http/validate.js';
import type { HealthService } from './health.service.js';

export function healthRoutes(health: HealthService): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    sendContract(res, 200, 'health-response.schema.json', { status: 'ok' });
  });
  // 200 when every dependency is up, 503 otherwise; the body always lists each service.
  router.get('/services', async (_req, res) => {
    const report = await health.services();
    const allOk = Object.values(report).every((s) => s === 'ok');
    sendContract(res, allOk ? 200 : 503, 'health-services-response.schema.json', report);
  });
  return router;
}
