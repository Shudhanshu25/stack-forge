import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { JobModel } from '../src/modules/simulations/job.model.js';
import { TurnModel } from '../src/modules/simulations/turn.model.js';
import { authHeader, harness, novaTech, register, type RegisteredUser } from './helpers.js';

const MARKETING = { decisions: [{ type: 'MARKETING', value: 5_000_000 }] };

let h: ReturnType<typeof harness>;
let user: RegisteredUser;
let simulationId: string;

async function startSimulation(owner: RegisteredUser) {
  const startup = await request(h.app)
    .post('/api/v1/startups')
    .set(authHeader(owner))
    .send(novaTech);
  const sim = await request(h.app)
    .post(`/api/v1/startups/${startup.body.id}/simulation`)
    .set(authHeader(owner))
    .send({ seed: 2024 })
    .expect(201);
  return sim.body.id as string;
}

const submit = (
  key: string | undefined,
  body: object = MARKETING,
  owner = user,
  sim = simulationId,
) => {
  const req = request(h.app).post(`/api/v1/simulations/${sim}/turns`).set(authHeader(owner));
  if (key !== undefined) req.set('Idempotency-Key', key);
  return req.send(body);
};

beforeEach(async () => {
  h = harness();
  user = await register(h.app);
  simulationId = await startSimulation(user);
});

describe('POST /simulations/:id/turns with Idempotency-Key', () => {
  it('a repeated key returns the original job instead of a second turn', async () => {
    const first = await submit('turn-1-abc').expect(202);
    expect(first.headers['idempotent-replayed']).toBeUndefined();

    // Retried while the first is still queued: same job, no 409 for the active turn.
    const queued = await submit('turn-1-abc').expect(202);
    expect(queued.body.jobId).toBe(first.body.jobId);
    expect(queued.headers['idempotent-replayed']).toBe('true');

    await h.drain();

    // Retried after it completed: still the same job, and still exactly one turn.
    const done = await submit('turn-1-abc').expect(202);
    expect(done.body).toMatchObject({ jobId: first.body.jobId, status: 'COMPLETED' });
    expect(await JobModel.countDocuments({ simulationId })).toBe(1);
    expect(await TurnModel.countDocuments({ simulationId })).toBe(1);

    // A new key plays the next turn.
    const next = await submit('turn-2-abc').expect(202);
    expect(next.body).toMatchObject({ turnNumber: 2 });
    expect(next.body.jobId).not.toBe(first.body.jobId);
  });

  it('rejects a key reused with different decisions', async () => {
    await submit('same-key').expect(202);
    const res = await submit('same-key', { decisions: [{ type: 'HIRING', value: 3 }] }).expect(422);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await JobModel.countDocuments({ simulationId })).toBe(1);
  });

  it('rejects a malformed key', async () => {
    const res = await submit('has spaces in it').expect(400);
    expect(res.body.error.code).toBe('INVALID_IDEMPOTENCY_KEY');
  });

  it("is scoped to the user: another user's key never returns someone else's job", async () => {
    const first = await submit('shared-key').expect(202);
    const other = await register(h.app);
    const otherSim = await startSimulation(other);
    const res = await submit('shared-key', MARKETING, other, otherSim).expect(202);
    expect(res.body.jobId).not.toBe(first.body.jobId);
    expect(res.body.simulationId).toBe(otherSim);
  });

  it('without a key, a second submission while a turn is queued is still refused', async () => {
    await submit(undefined).expect(202);
    const res = await submit(undefined).expect(409);
    expect(res.body.error.code).toBe('TURN_IN_PROGRESS');
  });
});
