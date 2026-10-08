import type { SchemaId } from '../contracts.js';

/** How a route is documented. Request and response bodies are shared schemas, never redefined. */
export interface RouteDoc {
  method: 'get' | 'post' | 'patch' | 'delete';
  /** Path under /api/v1, with {param} placeholders. */
  path: string;
  tag: string;
  summary: string;
  auth: 'none' | 'user' | 'admin' | 'refresh-cookie';
  body?: SchemaId;
  /** Status code to response schema; null means an empty body. */
  responses: Record<number, SchemaId | null | 'binary'>;
  idempotent?: true;
}

/** Every route the API serves under /api/v1. A test checks each one exists. */
export const ROUTES: RouteDoc[] = [
  // Health
  {
    method: 'get',
    path: '/health',
    tag: 'health',
    summary: 'Liveness',
    auth: 'none',
    responses: { 200: 'health-response.schema.json' },
  },
  {
    method: 'get',
    path: '/health/services',
    tag: 'health',
    summary: 'Status of each dependency; 503 if any is down',
    auth: 'none',
    responses: {
      200: 'health-services-response.schema.json',
      503: 'health-services-response.schema.json',
    },
  },

  // Auth
  {
    method: 'post',
    path: '/auth/register',
    tag: 'auth',
    summary: 'Create an account; sets the refresh cookie',
    auth: 'none',
    body: 'register-request.schema.json',
    responses: { 201: 'auth-response.schema.json' },
  },
  {
    method: 'post',
    path: '/auth/login',
    tag: 'auth',
    summary: 'Log in; sets the refresh cookie',
    auth: 'none',
    body: 'login-request.schema.json',
    responses: { 200: 'auth-response.schema.json' },
  },
  {
    method: 'get',
    path: '/locations',
    tag: 'startups',
    summary: 'States, their listed cities and the tiers, for choosing a location',
    auth: 'user',
    responses: { 200: 'location-catalog.schema.json' },
  },
  {
    method: 'post',
    path: '/locations/profile',
    tag: 'startups',
    summary: 'Preview the location profile of a listed city, or of another city by state and tier',
    auth: 'user',
    body: 'location-profile-request.schema.json',
    responses: { 200: 'location-profile.schema.json' },
  },
  {
    method: 'post',
    path: '/auth/password-reset',
    tag: 'auth',
    summary: 'Email a 6-digit reset code; 202 whether or not the email has an account',
    auth: 'none',
    body: 'password-reset-request.schema.json',
    responses: { 202: null },
  },
  {
    method: 'post',
    path: '/auth/password-reset/verify',
    tag: 'auth',
    summary: 'Exchange the emailed code for a single-use reset token (400 INVALID_CODE otherwise)',
    auth: 'none',
    body: 'password-reset-verify-request.schema.json',
    responses: { 200: 'password-reset-verify-response.schema.json' },
  },
  {
    method: 'post',
    path: '/auth/password-reset/confirm',
    tag: 'auth',
    summary: 'Set a new password with the reset token; signs out every session',
    auth: 'none',
    body: 'password-reset-confirm-request.schema.json',
    responses: { 204: null },
  },
  {
    method: 'post',
    path: '/auth/refresh',
    tag: 'auth',
    summary: 'Rotate the refresh cookie and issue a new access token',
    auth: 'refresh-cookie',
    responses: { 200: 'auth-response.schema.json' },
  },
  {
    method: 'post',
    path: '/auth/logout',
    tag: 'auth',
    summary: 'Revoke the refresh token and clear the cookie',
    auth: 'refresh-cookie',
    responses: { 204: null },
  },
  {
    method: 'get',
    path: '/auth/me',
    tag: 'auth',
    summary: 'The current user',
    auth: 'user',
    responses: { 200: 'user.schema.json' },
  },
  {
    method: 'post',
    path: '/auth/me/onboarding',
    tag: 'auth',
    summary: 'Mark the onboarding walkthrough complete',
    auth: 'user',
    responses: { 200: 'user.schema.json' },
  },

  // Startups
  {
    method: 'get',
    path: '/industry-templates',
    tag: 'startups',
    summary: 'Industry templates for the creation wizard',
    auth: 'user',
    responses: { 200: 'industry-template-list-response.schema.json' },
  },
  {
    method: 'get',
    path: '/startups',
    tag: 'startups',
    summary: "The user's startups",
    auth: 'user',
    responses: { 200: 'startup-list-response.schema.json' },
  },
  {
    method: 'post',
    path: '/startups',
    tag: 'startups',
    summary: 'Create a startup',
    auth: 'user',
    body: 'startup-create-request.schema.json',
    responses: { 201: 'startup.schema.json' },
  },
  {
    method: 'get',
    path: '/startups/{id}',
    tag: 'startups',
    summary: 'One startup',
    auth: 'user',
    responses: { 200: 'startup.schema.json' },
  },
  {
    method: 'patch',
    path: '/startups/{id}',
    tag: 'startups',
    summary: 'Edit a startup',
    auth: 'user',
    body: 'startup-update-request.schema.json',
    responses: { 200: 'startup.schema.json' },
  },
  {
    method: 'delete',
    path: '/startups/{id}',
    tag: 'startups',
    summary: 'Delete a startup',
    auth: 'user',
    responses: { 204: null },
  },

  // Simulations
  {
    method: 'post',
    path: '/startups/{id}/simulation',
    tag: 'simulations',
    summary: 'Start a simulation (seed and agent mode optional)',
    auth: 'user',
    body: 'simulation-start-request.schema.json',
    responses: { 201: 'simulation.schema.json' },
  },
  {
    method: 'get',
    path: '/startups/{id}/simulations',
    tag: 'simulations',
    summary: "A startup's simulations",
    auth: 'user',
    responses: { 200: 'simulation-list-response.schema.json' },
  },
  {
    method: 'get',
    path: '/simulations/{id}',
    tag: 'simulations',
    summary: 'A simulation and its current state',
    auth: 'user',
    responses: { 200: 'simulation.schema.json' },
  },
  {
    method: 'get',
    path: '/simulations/{id}/turns',
    tag: 'simulations',
    summary: 'Turn history (immutable records)',
    auth: 'user',
    responses: { 200: 'turn-list-response.schema.json' },
  },
  {
    method: 'get',
    path: '/simulations/{id}/analytics',
    tag: 'simulations',
    summary: 'Derived metrics for every view',
    auth: 'user',
    responses: { 200: 'simulation-analytics.schema.json' },
  },
  {
    method: 'get',
    path: '/simulations/{id}/report',
    tag: 'simulations',
    summary: 'Download a report: ?format=json|csv|pdf',
    auth: 'user',
    responses: { 200: 'binary' },
  },
  {
    method: 'post',
    path: '/simulations/{id}/preview',
    tag: 'simulations',
    summary: 'Estimate the effect of decisions without playing',
    auth: 'user',
    body: 'decisions-request.schema.json',
    responses: { 200: 'decision-preview.schema.json' },
  },
  {
    method: 'post',
    path: '/simulations/{id}/scenarios',
    tag: 'simulations',
    summary: 'Compare two decision sets over 1-6 turns (never recorded)',
    auth: 'user',
    body: 'scenario-request.schema.json',
    responses: { 200: 'scenario-comparison.schema.json' },
  },
  {
    method: 'post',
    path: '/simulations/{id}/turns',
    tag: 'simulations',
    summary: 'Play the next turn as a job. Idempotency-Key makes retries safe.',
    auth: 'user',
    body: 'decisions-request.schema.json',
    responses: { 202: 'simulation-job.schema.json' },
    idempotent: true,
  },
  {
    method: 'post',
    path: '/simulations/{id}/advice',
    tag: 'simulations',
    summary: 'Ask the AI CEO about a turn',
    auth: 'user',
    body: 'advice-request.schema.json',
    responses: { 200: 'ai-advice.schema.json' },
  },

  // Jobs
  {
    method: 'get',
    path: '/jobs/{id}',
    tag: 'jobs',
    summary: 'Job status and progress',
    auth: 'user',
    responses: { 200: 'simulation-job.schema.json' },
  },
  {
    method: 'post',
    path: '/jobs/{id}/cancel',
    tag: 'jobs',
    summary: 'Cancel a queued or running turn',
    auth: 'user',
    responses: { 202: 'simulation-job.schema.json' },
  },

  // Admin
  {
    method: 'get',
    path: '/admin/stats',
    tag: 'admin',
    summary: 'Aggregate platform metrics (ADMIN only)',
    auth: 'admin',
    responses: { 200: 'admin-stats.schema.json' },
  },
];
