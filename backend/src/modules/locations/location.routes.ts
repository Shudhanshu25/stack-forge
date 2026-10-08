import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { LocationProfileRequest } from '@stackforge/shared';
import { sendContract, validateBody } from '../../http/validate.js';
import type { LocationService } from './location.service.js';

/** GET /locations (the catalog) and POST /locations/profile (preview a profile in the wizard). */
export function locationRoutes(locations: LocationService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);
  router.get('/', async (_req: Request, res: Response) => {
    sendContract(res, 200, 'location-catalog.schema.json', await locations.catalog());
  });
  router.post(
    '/profile',
    validateBody('location-profile-request.schema.json'),
    async (req: Request, res: Response) => {
      const body = req.body as LocationProfileRequest;
      const profile = await locations.profile({
        state: body.state,
        cityId: body.cityId ?? null,
        city: body.city ?? '',
        tier: body.tier ?? 'TIER_3',
      });
      sendContract(res, 200, 'location-profile.schema.json', profile);
    },
  );
  return router;
}
