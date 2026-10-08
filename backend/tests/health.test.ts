import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requireRole } from '../src/http/authenticate.js';
import { errorHandler } from '../src/http/error-handler.js';
import { testApp } from './helpers.js';

const down = async () => {
  throw new Error('unreachable');
};

describe('health', () => {
  it('serves the public API only under /api/v1, with /health also at the root for probes', async () => {
    const app = testApp();
    await request(app).get('/health').expect(200);
    const old = await request(app).post('/auth/login').send({}).expect(404);
    expect(old.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /health returns ok', async () => {
    const res = await request(testApp()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /health/services reports every service ok', async () => {
    const res = await request(testApp()).get('/api/v1/health/services').expect(200);
    expect(res.body).toEqual({ api: 'ok', mongodb: 'ok', redis: 'ok', simulationEngine: 'ok' });
  });

  it('GET /health/services reports a down dependency with 503', async () => {
    const app = testApp({}, { redis: down, simulationEngine: () => new Promise(() => {}) });
    const res = await request(app).get('/api/v1/health/services').expect(503);
    expect(res.body).toEqual({
      api: 'ok',
      mongodb: 'ok',
      redis: 'down',
      simulationEngine: 'down',
    });
  });
});

describe('errors', () => {
  it('unknown routes use the shared error shape', async () => {
    const res = await request(testApp()).get('/api/v1/nope').set('X-Request-Id', 'abc').expect(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', details: null });
    expect(res.headers['x-request-id']).toBe('abc');
  });

  it('malformed JSON is a 400', async () => {
    const res = await request(testApp())
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('requireRole', () => {
  const app = express();
  app.get(
    '/admin',
    (req, _res, next) => {
      req.auth = { userId: 'u1', role: req.headers['x-role'] === 'ADMIN' ? 'ADMIN' : 'USER' };
      next();
    },
    requireRole('ADMIN'),
    (_req, res) => {
      res.json({ ok: true });
    },
  );
  app.use(errorHandler);

  it('allows ADMIN and forbids USER', async () => {
    await request(app).get('/admin').set('X-Role', 'ADMIN').expect(200);
    const res = await request(app).get('/admin').expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
