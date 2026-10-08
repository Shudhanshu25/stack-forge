import { existsSync } from 'node:fs';

export interface Config {
  env: 'development' | 'test' | 'production';
  port: number;
  logLevel: string;
  mongodbUri: string;
  redisUrl: string;
  simulationUrl: string;
  corsOrigin: string;
  jwtAccessSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  cookieSecure: boolean;
  /** Path of the refresh cookie: the auth routes, as the browser sees them. */
  cookiePath: string;
  authRateLimitMax: number;
  bodyLimit: string;
  trustProxy: number;
  engineTimeoutMs: number;
  pipelineTimeoutMs: number;
  workerConcurrency: number;
  /** Port of the worker's Prometheus /metrics endpoint. */
  workerMetricsPort: number;
  /** Public URL of the web app, used in emailed links and after Google sign-in. */
  appUrl: string;
  /**
   * resend: Resend's API. smtp: any SMTP server, e.g. Gmail with an App Password.
   * outbox: write emails to files (development). none: drop.
   */
  emailProvider: 'resend' | 'smtp' | 'outbox' | 'none';
  emailApiKey: string;
  emailFrom: string;
  smtpHost: string;
  smtpPort: number;
  /** TLS from the start (port 465); false upgrades with STARTTLS (port 587). */
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  outboxDir: string;
  emailVerificationTtlHours: number;
  /** How long an emailed reset code works. */
  passwordResetCodeTtlMinutes: number;
  /** How long the new password can be set after the code was accepted. */
  passwordResetTtlMinutes: number;
  /** Google sign-in (OAuth 2.0 / OpenID Connect); off when the client id is empty. */
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  /** LLM tokens a user may spend per UTC day; after that turns run in rules mode. */
  llmUserDailyTokenQuota: number;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1';
}

/** Reads configuration from the environment, loading backend/.env in development if present. */
export function loadConfig(overrides: Partial<Config> = {}): Config {
  if (existsSync('.env') && process.env.NODE_ENV !== 'test') process.loadEnvFile('.env');

  const env = (process.env.NODE_ENV ?? 'development') as Config['env'];
  const config: Config = {
    env,
    port: int('PORT', 4000),
    logLevel: process.env.LOG_LEVEL ?? (env === 'test' ? 'silent' : 'info'),
    mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/stackforge',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    simulationUrl: process.env.SIMULATION_URL ?? 'http://127.0.0.1:8000',
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessTokenTtlSeconds: int('ACCESS_TOKEN_TTL_SECONDS', 900),
    refreshTokenTtlDays: int('REFRESH_TOKEN_TTL_DAYS', 7),
    cookieSecure: bool('COOKIE_SECURE', env === 'production'),
    cookiePath: process.env.COOKIE_PATH ?? '/api/v1/auth',
    authRateLimitMax: int('AUTH_RATE_LIMIT_MAX', 20),
    bodyLimit: process.env.BODY_LIMIT ?? '100kb',
    trustProxy: int('TRUST_PROXY', 0),
    engineTimeoutMs: int('ENGINE_TIMEOUT_MS', 15_000),
    pipelineTimeoutMs: int('PIPELINE_TIMEOUT_MS', 60_000),
    workerConcurrency: int('WORKER_CONCURRENCY', 4),
    workerMetricsPort: int('WORKER_METRICS_PORT', 9464),
    appUrl: (process.env.APP_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:5173').replace(
      /\/$/,
      '',
    ),
    emailProvider: (process.env.EMAIL_PROVIDER ??
      (env === 'production'
        ? 'resend'
        : env === 'test'
          ? 'none'
          : 'outbox')) as Config['emailProvider'],
    emailApiKey: process.env.EMAIL_API_KEY ?? '',
    emailFrom: process.env.EMAIL_FROM ?? 'Stack Forge <no-reply@localhost>',
    smtpHost: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    smtpPort: int('SMTP_PORT', 465),
    smtpSecure: (process.env.SMTP_SECURE ?? String(int('SMTP_PORT', 465) === 465)) === 'true',
    smtpUser: process.env.SMTP_USER ?? '',
    // Gmail shows App Passwords in groups of four ("abcd efgh ..."); the spaces are not part of it.
    smtpPassword: (process.env.SMTP_PASSWORD ?? '').replace(/\s+/g, ''),
    outboxDir: process.env.OUTBOX_DIR ?? '.outbox',
    emailVerificationTtlHours: int('EMAIL_VERIFICATION_TTL_HOURS', 24),
    passwordResetCodeTtlMinutes: int('PASSWORD_RESET_CODE_TTL_MINUTES', 10),
    passwordResetTtlMinutes: int('PASSWORD_RESET_TTL_MINUTES', 30),
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    googleRedirectUri:
      process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:4000/api/v1/auth/google/callback',
    llmUserDailyTokenQuota: int('LLM_USER_DAILY_TOKEN_QUOTA', 200_000),
    ...overrides,
  };

  if (config.jwtAccessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be set to at least 32 characters');
  }
  if (!['resend', 'smtp', 'outbox', 'none'].includes(config.emailProvider)) {
    throw new Error('EMAIL_PROVIDER must be resend, smtp, outbox or none');
  }
  if (config.emailProvider === 'smtp' && (!config.smtpUser || !config.smtpPassword)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be set when EMAIL_PROVIDER=smtp');
  }
  if (config.env === 'production' && config.emailProvider === 'outbox') {
    throw new Error('EMAIL_PROVIDER=outbox writes emails to disk and is for development only');
  }
  if (config.emailProvider === 'resend' && !config.emailApiKey) {
    throw new Error('EMAIL_API_KEY must be set when EMAIL_PROVIDER=resend');
  }
  if (config.googleClientId && !config.googleClientSecret) {
    throw new Error('GOOGLE_CLIENT_SECRET must be set when GOOGLE_CLIENT_ID is');
  }
  return config;
}
