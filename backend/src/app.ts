import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { Config } from './config.js';
import type { EngineClient } from './engine/engine-client.js';
import { authenticate } from './http/authenticate.js';
import { metricsHandler, metricsMiddleware } from './observability/metrics.js';
import { tracingMiddleware } from './observability/tracing.js';
import { errorHandler, notFoundHandler } from './http/error-handler.js';
import { rejectMongoOperators } from './http/sanitize.js';
import { accountRoutes } from './modules/account/account.routes.js';
import { AccountService } from './modules/account/account.service.js';
import { LlmUsageService } from './modules/llm/llm-usage.service.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import { createGoogleOAuth, type GoogleOAuth } from './modules/auth/google.js';
import { TokenService } from './modules/auth/tokens.js';
import { createEmailSender, type EmailSender } from './modules/email/email.js';
import { docsRoutes, type SimulationOpenApi } from './modules/docs/docs.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { HealthService, type HealthChecks } from './modules/health/health.service.js';
import { JobService } from './modules/simulations/job.service.js';
import { SimulationController } from './modules/simulations/simulation.controller.js';
import { simulationRoutes } from './modules/simulations/simulation.routes.js';
import { SimulationService } from './modules/simulations/simulation.service.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { AdminService } from './modules/admin/admin.service.js';
import { ReportService } from './modules/reports/report.service.js';
import { StartupController } from './modules/startups/startup.controller.js';
import { startupRoutes, templateRoutes } from './modules/startups/startup.routes.js';
import { StartupService } from './modules/startups/startup.service.js';
import { locationRoutes } from './modules/locations/location.routes.js';
import { LocationService } from './modules/locations/location.service.js';
import { loadTemplateCatalog } from './modules/startups/templates.js';
import type { EventBus } from './queue/event-bus.js';
import type { TurnQueue } from './queue/turn-queue.js';

/** Every public route lives under this prefix. */
export const API_PREFIX = '/api/v1';

export interface AppDeps {
  config: Config;
  logger: Logger;
  healthChecks: HealthChecks;
  engine: EngineClient;
  queue: TurnQueue;
  bus: EventBus;
  tokens?: TokenService;
  /** Transactional email (verification, password reset). */
  email?: EmailSender;
  google?: GoogleOAuth;
  /** The simulation service's OpenAPI document, for /api/v1/docs. */
  simulationOpenApi?: SimulationOpenApi;
}

/** Builds the Express app. Connections are owned by the caller so tests can inject their own. */
export function createApp({
  config,
  logger,
  healthChecks,
  engine,
  queue,
  bus,
  tokens = new TokenService(config),
  email = createEmailSender(config),
  google = createGoogleOAuth(config),
  simulationOpenApi = async () => {
    throw new Error('not configured');
  },
}: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  const requireAuth = authenticate(tokens);
  const templates = loadTemplateCatalog();
  const locations = new LocationService(engine);
  const startupController = new StartupController(
    new StartupService(templates, locations),
    templates,
  );
  const authService = new AuthService(tokens, config, email, logger);
  const authController = new AuthController(authService, config, google, logger);
  const usage = new LlmUsageService(config.llmUserDailyTokenQuota);
  const simulations = new SimulationService(engine, usage);
  const simulationController = new SimulationController(
    simulations,
    new JobService(simulations, queue, bus, () =>
      healthChecks.redis().then(
        () => true,
        () => false,
      ),
    ),
    new ReportService(simulations),
  );

  app.use(tracingMiddleware);
  app.use(metricsMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      quietReqLogger: true,
      customAttributeKeys: { reqId: 'requestId' },
      serializers: {
        req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      customProps: (req) => (req.auth ? { userId: req.auth.userId } : {}),
      autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/metrics' },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
      exposedHeaders: ['X-Request-Id', 'Content-Disposition', 'Idempotent-Replayed'],
    }),
  );
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(rejectMongoOperators);

  // Prometheus scrape endpoint: internal only (the proxy routes nothing but /api/* here).
  app.get('/metrics', metricsHandler);

  const health = healthRoutes(new HealthService(healthChecks));
  // Also at the root: container health checks and the deploy smoke test probe it there.
  app.use('/health', health);

  const v1 = express.Router();
  v1.use('/health', health);
  v1.use('/auth', authRoutes(authController, config, requireAuth));
  v1.use(
    '/account',
    accountRoutes(
      new AccountService(simulations, queue, bus),
      authService,
      usage,
      config,
      requireAuth,
    ),
  );
  v1.use('/startups', startupRoutes(startupController, requireAuth));
  v1.use('/industry-templates', templateRoutes(startupController, requireAuth));
  v1.use('/locations', locationRoutes(locations, requireAuth));
  v1.use(simulationRoutes(simulationController, requireAuth));
  v1.use('/admin', adminRoutes(new AdminService(engine), requireAuth));
  v1.use(docsRoutes(simulationOpenApi));
  app.use(API_PREFIX, v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
