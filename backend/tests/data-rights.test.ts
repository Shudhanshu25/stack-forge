import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { RefreshTokenModel } from '../src/modules/auth/refresh-token.model.js';
import { UserModel } from '../src/modules/auth/user.model.js';
import { LlmUsageModel } from '../src/modules/llm/llm-usage.model.js';
import { AdviceModel } from '../src/modules/simulations/advice.model.js';
import { JobModel } from '../src/modules/simulations/job.model.js';
import { SimulationModel } from '../src/modules/simulations/simulation.model.js';
import { TurnModel } from '../src/modules/simulations/turn.model.js';
import { StartupModel } from '../src/modules/startups/startup.model.js';
import {
  STRONG_PASSWORD,
  authHeader,
  harness,
  novaTech,
  refreshCookieOf,
  register,
  type RegisteredUser,
} from './helpers.js';

let h: ReturnType<typeof harness>;
beforeEach(() => {
  h = harness();
});

/** A user with a startup, a simulation, one played turn and one AI CEO answer. */
async function userWithData(): Promise<RegisteredUser & { simulationId: string }> {
  const user = await register(h.app);
  const auth = authHeader(user);
  const startup = await request(h.app).post('/api/v1/startups').set(auth).send(novaTech);
  const sim = await request(h.app)
    .post(`/api/v1/startups/${startup.body.id}/simulation`)
    .set(auth)
    .send({ seed: 3 })
    .expect(201);
  await request(h.app)
    .post(`/api/v1/simulations/${sim.body.id}/turns`)
    .set(auth)
    .send({ decisions: [] })
    .expect(202);
  await h.drain();
  await request(h.app)
    .post(`/api/v1/simulations/${sim.body.id}/advice`)
    .set(auth)
    .send({ mode: 'EXPLAIN' })
    .expect(200);
  await LlmUsageModel.create({
    userId: user.body.user.id,
    simulationId: sim.body.id,
    turnNumber: 1,
    purpose: 'advisor',
    model: 'gemini-3.8-flash',
    promptVersion: 'advisor@v1',
    promptTokens: 900,
    completionTokens: 120,
    outcome: 'ok',
  });
  return { ...user, simulationId: sim.body.id };
}

async function asAdmin() {
  const admin = await register(h.app);
  await UserModel.updateOne({ email: admin.email }, { $set: { role: 'ADMIN' } });
  const login = await request(h.app)
    .post('/api/v1/auth/login')
    .send({ email: admin.email, password: STRONG_PASSWORD });
  return { Authorization: `Bearer ${login.body.accessToken}` };
}

describe('data export', () => {
  it("downloads everything the user owns, and nothing of anyone else's or any secret", async () => {
    const user = await userWithData();
    await userWithData(); // someone else
    const res = await request(h.app)
      .get('/api/v1/account/export')
      .set(authHeader(user))
      .set('Cookie', user.refreshCookie)
      .expect(200);
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="stackforge-export-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    const data = res.body;
    expect(data.user.email).toBe(user.email);
    expect(data.startups).toHaveLength(1);
    expect(data.simulations).toHaveLength(1);
    expect(data.turns).toHaveLength(1);
    expect(data.turns[0].simulationId).toBe(user.simulationId);
    expect(data.advice).toHaveLength(1);
    expect(data.sessions).toEqual([expect.objectContaining({ current: true })]);
    expect(data.llmUsage).toEqual([
      expect.objectContaining({ promptVersion: 'advisor@v1', promptTokens: 900 }),
    ]);
    const text = JSON.stringify(data);
    expect(text).not.toMatch(/passwordHash|tokenHash|\$argon2/);
  });
});

describe('account deletion', () => {
  it('needs the password, then removes everything and keeps only anonymous totals', async () => {
    const user = await userWithData();
    const other = await userWithData();
    const admin = await asAdmin();
    const before = (await request(h.app).get('/api/v1/admin/stats').set(admin)).body;

    const wrong = await request(h.app)
      .delete('/api/v1/account')
      .set(authHeader(user))
      .send({ confirm: 'DELETE MY ACCOUNT', password: 'Wrong-Password-1' });
    expect(wrong.status).toBe(401);
    expect(await StartupModel.countDocuments({ ownerId: user.body.user.id })).toBe(1);

    const confirmMissing = await request(h.app)
      .delete('/api/v1/account')
      .set(authHeader(user))
      .send({ password: STRONG_PASSWORD });
    expect(confirmMissing.status).toBe(400);

    await request(h.app)
      .delete('/api/v1/account')
      .set(authHeader(user))
      .send({ confirm: 'DELETE MY ACCOUNT', password: STRONG_PASSWORD })
      .expect(204);

    const ownerId = new mongoose.Types.ObjectId(user.body.user.id as string);
    for (const [name, count] of [
      ['users', await UserModel.countDocuments({ _id: ownerId })],
      ['startups', await StartupModel.countDocuments({ ownerId })],
      ['simulations', await SimulationModel.countDocuments({ ownerId })],
      ['turns', await TurnModel.countDocuments({ ownerId })],
      ['jobs', await JobModel.countDocuments({ ownerId })],
      ['advice', await AdviceModel.countDocuments({ ownerId })],
      ['sessions', await RefreshTokenModel.countDocuments({ userId: ownerId })],
      ['llm usage', await LlmUsageModel.countDocuments({ userId: ownerId })],
    ] as const) {
      expect({ name, count }).toEqual({ name, count: 0 });
    }
    // Usage rows remain for cost accounting, with nothing pointing at the person.
    expect(await LlmUsageModel.countDocuments({ userId: null, simulationId: null })).toBe(1);
    // The other user is untouched; the deleted session cannot come back.
    expect(await StartupModel.countDocuments({ ownerId: other.body.user.id })).toBe(1);
    await request(h.app).post('/api/v1/auth/refresh').set('Cookie', user.refreshCookie).expect(401);
    await request(h.app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: STRONG_PASSWORD })
      .expect(401);

    const after = (await request(h.app).get('/api/v1/admin/stats').set(admin)).body;
    for (const key of [
      'users',
      'startups',
      'simulations',
      'turnsPlayed',
      'aiRequests',
      'mlPredictions',
    ]) {
      expect({ key, value: after[key] }).toEqual({ key, value: before[key] });
    }
  });

  it('cancels a turn that is still queued', async () => {
    const user = await userWithData();
    await request(h.app)
      .post(`/api/v1/simulations/${user.simulationId}/turns`)
      .set(authHeader(user))
      .send({ decisions: [] })
      .expect(202);
    await request(h.app)
      .delete('/api/v1/account')
      .set(authHeader(user))
      .send({ confirm: 'DELETE MY ACCOUNT', password: STRONG_PASSWORD })
      .expect(204);
    await h.drain(); // the worker finds nothing to do
    expect(await TurnModel.countDocuments({ simulationId: user.simulationId })).toBe(0);
  });

  it('a Google-only account (no password) needs just the confirmation', async () => {
    const start = await request(h.app).get('/api/v1/auth/google/start');
    const cookie = (start.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    const google = new URL(start.headers.location!);
    const callback = await request(h.app)
      .get(
        `/api/v1/auth/google/callback?code=${google.searchParams.get('code')}&state=${google.searchParams.get('state')}`,
      )
      .set('Cookie', cookie);
    const session = await request(h.app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookieOf(callback))
      .expect(200);
    await request(h.app)
      .delete('/api/v1/account')
      .set('Authorization', `Bearer ${session.body.accessToken}`)
      .send({ confirm: 'DELETE MY ACCOUNT' })
      .expect(204);
    expect(await UserModel.countDocuments({})).toBe(0);
  });
});
