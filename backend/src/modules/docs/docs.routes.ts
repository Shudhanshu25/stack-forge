import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { AppError } from '../../errors.js';
import { buildOpenApi } from '../../openapi/build.js';

/** Fetches the simulation service's own OpenAPI document (generated from the shared schemas). */
export type SimulationOpenApi = () => Promise<unknown>;

export function simulationOpenApiFrom(baseUrl: string): SimulationOpenApi {
  return async () => {
    const res = await fetch(new URL('/openapi.json', baseUrl), {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`simulation service returned ${res.status}`);
    return res.json();
  };
}

/**
 * /openapi.json (this API), /openapi/simulation.json (the internal simulation service) and
 * /docs, an interactive viewer for both.
 */
export function docsRoutes(simulationOpenApi: SimulationOpenApi): Router {
  const router = Router();
  let nodeDoc: unknown;
  router.get('/openapi.json', (_req, res) => {
    nodeDoc ??= buildOpenApi('1');
    res.json(nodeDoc);
  });
  router.get('/openapi/simulation.json', async (_req, res) => {
    try {
      res.json(await simulationOpenApi());
    } catch {
      throw new AppError(
        503,
        'SIMULATION_ENGINE_UNAVAILABLE',
        'The simulation engine is unavailable',
      );
    }
  });
  const viewer = {
    customSiteTitle: 'Stack Forge API',
    swaggerOptions: {
      urls: [
        { url: '/api/v1/openapi.json', name: 'Stack Forge API' },
        { url: '/api/v1/openapi/simulation.json', name: 'Simulation service (internal)' },
      ],
    },
  };
  router.use('/docs', swaggerUi.serveFiles(undefined, viewer), swaggerUi.setup(undefined, viewer));
  return router;
}
