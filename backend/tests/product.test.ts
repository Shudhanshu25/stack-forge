import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserModel } from '../src/modules/auth/user.model.js';
import { TurnModel } from '../src/modules/simulations/turn.model.js';
import {
  STRONG_PASSWORD,
  analyticsFixture,
  authHeader,
  harness,
  novaTech,
  register,
  type RegisteredUser,
} from './helpers.js';

let h: ReturnType<typeof harness>;
let user: RegisteredUser;
let simulationId: string;

beforeEach(async () => {
  h = harness();
  user = await register(h.app);
  const startup = await request(h.app)
    .post('/api/v1/startups')
    .set(authHeader(user))
    .send(novaTech);
  simulationId = (
    await request(h.app)
      .post(`/api/v1/startups/${startup.body.id}/simulation`)
      .set(authHeader(user))
      .send({ seed: 2024 })
  ).body.id;
  for (let turn = 1; turn <= 3; turn++) {
    await request(h.app)
      .post(`/api/v1/simulations/${simulationId}/turns`)
      .set(authHeader(user))
      .send({ decisions: [] });
    await h.drain();
  }
});

describe('simulation header data', () => {
  it('includes the startup and product names', async () => {
    const res = await request(h.app)
      .get(`/api/v1/simulations/${simulationId}`)
      .set(authHeader(user));
    expect(res.body).toMatchObject({ startupName: 'NovaTech', productName: 'Nova CRM' });
  });
});

describe('analytics', () => {
  it('passes every stored record to the simulation service and returns its analytics', async () => {
    const res = await request(h.app)
      .get(`/api/v1/simulations/${simulationId}/analytics`)
      .set(authHeader(user))
      .expect(200);
    expect(res.body.currentTurn).toBe(analyticsFixture.currentTurn);
    expect(h.engine.calls).toContain('analytics:3');
  });

  it('is scoped to the owner', async () => {
    const other = await register(h.app);
    await request(h.app)
      .get(`/api/v1/simulations/${simulationId}/analytics`)
      .set(authHeader(other))
      .expect(404);
  });
});

describe('scenario comparison', () => {
  const body = {
    horizon: 4,
    baseline: { label: '₹799', decisions: [{ type: 'PRICING', value: 79_900 }] },
    alternative: { label: '₹699', decisions: [{ type: 'PRICING', value: 69_900 }] },
  };

  it('runs both branches without touching the turn history', async () => {
    const res = await request(h.app)
      .post(`/api/v1/simulations/${simulationId}/scenarios`)
      .set(authHeader(user))
      .send(body)
      .expect(200);
    expect(res.body).toMatchObject({
      label: 'Simulation estimate',
      agentMode: 'rules',
      horizon: 4,
    });
    expect(h.engine.calls).toContain('scenario:4');
    expect(await TurnModel.countDocuments({ simulationId })).toBe(3);
  });

  it('limits the horizon to six turns', async () => {
    await request(h.app)
      .post(`/api/v1/simulations/${simulationId}/scenarios`)
      .set(authHeader(user))
      .send({ ...body, horizon: 7 })
      .expect(400);
  });
});

describe('reports', () => {
  const download = (format: string) =>
    request(h.app)
      .get(`/api/v1/simulations/${simulationId}/report?format=${format}`)
      .set(authHeader(user))
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });

  it('exports JSON with the simulation, analytics and turns', async () => {
    const res = await download('json').expect(200);
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="novatech-turn-\d+\.json"/,
    );
    const report = JSON.parse((res.body as Buffer).toString('utf8'));
    expect(Object.keys(report)).toEqual(['exportedAt', 'simulation', 'analytics', 'turns']);
    expect(report.turns).toHaveLength(3);
  });

  it('exports one CSV row per turn', async () => {
    const res = await download('csv').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = (res.body as Buffer).toString('utf8').trim().split('\n');
    expect(lines[0]).toMatch(/^turn,revenue_inr,expenses_inr,profit_inr,cash_inr,/);
    expect(lines).toHaveLength(analyticsFixture.series.length + 1);
  });

  it('exports a PDF', async () => {
    const res = await download('pdf').expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('rejects an unknown format', async () => {
    await download('xlsx').expect(400);
  });
});

describe('onboarding', () => {
  it('starts incomplete and can be completed', async () => {
    expect(user.body.user.onboardingCompleted).toBe(false);
    const res = await request(h.app)
      .post('/api/v1/auth/me/onboarding')
      .set(authHeader(user))
      .expect(200);
    expect(res.body.onboardingCompleted).toBe(true);
    const me = await request(h.app).get('/api/v1/auth/me').set(authHeader(user));
    expect(me.body.onboardingCompleted).toBe(true);
  });
});

describe('admin', () => {
  it('is forbidden to regular users', async () => {
    const res = await request(h.app).get('/api/v1/admin/stats').set(authHeader(user)).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('reports platform totals to admins', async () => {
    await UserModel.updateOne({ email: user.email }, { $set: { role: 'ADMIN' } });
    const login = await request(h.app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: STRONG_PASSWORD })
      .expect(200);
    const res = await request(h.app)
      .get('/api/v1/admin/stats')
      .set({ Authorization: `Bearer ${login.body.accessToken}` })
      .expect(200);
    expect(res.body).toMatchObject({
      users: 1,
      startups: 1,
      simulations: 1,
      turnsPlayed: 3,
      failedJobs: 0,
      aiRequests: 0,
      mlPredictions: 0,
      engineVersion: expect.any(String),
      modelVersion: 'forecast-test',
    });
    expect(res.body.averageTurnDurationMs).toBeGreaterThanOrEqual(0);
  });
});
