import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineError } from '../src/engine/engine-client.js';
import { SimulationModel } from '../src/modules/simulations/simulation.model.js';
import { authHeader, harness, novaTech, register, type RegisteredUser } from './helpers.js';

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
      .expect(201)
  ).body.id;
  // As if the simulation had been created by an older engine release.
  await SimulationModel.updateOne({ _id: simulationId }, { $set: { engineVersion: '0.9.0' } });
});

describe('engine versioning', () => {
  it("every engine call carries the simulation's recorded engine version", async () => {
    const preview = vi.spyOn(h.engine, 'preview');
    const analytics = vi.spyOn(h.engine, 'analytics');
    const scenario = vi.spyOn(h.engine, 'scenario');
    const auth = authHeader(user);
    const decisions = [{ type: 'MARKETING', value: 5_000_000 }];

    await request(h.app)
      .post(`/api/v1/simulations/${simulationId}/preview`)
      .set(auth)
      .send({ decisions });
    await request(h.app)
      .post(`/api/v1/simulations/${simulationId}/turns`)
      .set(auth)
      .send({ decisions })
      .expect(202);
    await h.drain();
    await request(h.app).get(`/api/v1/simulations/${simulationId}/analytics`).set(auth);
    await request(h.app)
      .post(`/api/v1/simulations/${simulationId}/scenarios`)
      .set(auth)
      .send({ horizon: 2, baseline: { decisions: [] }, alternative: { decisions } });

    expect(preview.mock.calls[0]![0].engineVersion).toBe('0.9.0');
    expect(h.engine.turnRequests[0]!.engineVersion).toBe('0.9.0');
    expect(analytics.mock.calls[0]![0].engineVersion).toBe('0.9.0');
    expect(scenario.mock.calls[0]![0].engineVersion).toBe('0.9.0');
  });

  it('a version the simulation service no longer has is a clear 409, not a generic error', async () => {
    vi.spyOn(h.engine, 'preview').mockRejectedValueOnce(
      new EngineError('ENGINE_VERSION_UNSUPPORTED', 'engine version 0.9.0 is not available', {
        version: '0.9.0',
      }),
    );
    const res = await request(h.app)
      .post(`/api/v1/simulations/${simulationId}/preview`)
      .set(authHeader(user))
      .send({ decisions: [] })
      .expect(409);
    expect(res.body.error).toMatchObject({
      code: 'ENGINE_VERSION_UNSUPPORTED',
      details: { version: '0.9.0' },
    });
  });
});
