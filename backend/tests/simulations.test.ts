import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { EngineError } from '../src/engine/engine-client.js';
import { AdviceModel } from '../src/modules/simulations/advice.model.js';
import { JobModel } from '../src/modules/simulations/job.model.js';
import { SimulationModel } from '../src/modules/simulations/simulation.model.js';
import { TurnModel } from '../src/modules/simulations/turn.model.js';
import {
  authHeader,
  fixture,
  harness,
  novaTech,
  register,
  type RegisteredUser,
} from './helpers.js';

const MARKETING = { decisions: [{ type: 'MARKETING', value: 5_000_000 }] };

let h: ReturnType<typeof harness>;
let user: RegisteredUser;
let simulationId: string;

async function startSimulation(owner = user, body: object = { seed: 2024 }) {
  const startup = await request(h.app)
    .post('/api/v1/startups')
    .set(authHeader(owner))
    .send(novaTech);
  const res = await request(h.app)
    .post(`/api/v1/startups/${startup.body.id}/simulation`)
    .set(authHeader(owner))
    .send(body)
    .expect(201);
  return res.body;
}

async function playTurn(owner = user, body: object = MARKETING) {
  const res = await request(h.app)
    .post(`/api/v1/simulations/${simulationId}/turns`)
    .set(authHeader(owner))
    .send(body);
  return res;
}

beforeEach(async () => {
  h = harness();
  user = await register(h.app);
  simulationId = (await startSimulation()).id;
});

describe('starting a simulation', () => {
  it('stores the seed, a configuration snapshot and the initial state', async () => {
    const sim = await request(h.app)
      .get(`/api/v1/simulations/${simulationId}`)
      .set(authHeader(user))
      .expect(200);
    expect(sim.body).toMatchObject({
      seed: 2024,
      agentMode: 'rules',
      status: 'ACTIVE',
      currentTurn: 0,
      activeJobId: null,
      engineVersion: fixture.engineVersion,
    });
    expect(sim.body.currentState).toEqual(fixture.initialState);
    expect(sim.body.configuration.industry).toBe('SAAS');
    expect(h.engine.calls).toContain('start:2024');
  });

  it('chooses a random seed when none is given', async () => {
    const sim = await startSimulation(user, {});
    expect(Number.isSafeInteger(sim.seed)).toBe(true);
  });

  it('starts in llm agent mode when asked and passes the mode to the pipeline', async () => {
    const sim = await startSimulation(user, { seed: 3, agentMode: 'llm' });
    expect(sim.agentMode).toBe('llm');
    await request(h.app)
      .post(`/api/v1/simulations/${sim.id}/turns`)
      .set(authHeader(user))
      .send({ decisions: [] })
      .expect(202);
    await h.drain();
    expect(h.engine.turnRequests.at(-1)!.agentMode).toBe('llm');
  });

  it("keeps the simulation's configuration when the startup is edited later", async () => {
    const startupId = (await SimulationModel.findById(simulationId))!.startupId.toString();
    await request(h.app)
      .patch(`/api/v1/startups/${startupId}`)
      .set(authHeader(user))
      .send({ industry: 'GAMING' })
      .expect(200);
    const sim = await request(h.app)
      .get(`/api/v1/simulations/${simulationId}`)
      .set(authHeader(user));
    expect(sim.body.configuration.industry).toBe('SAAS');
  });

  it('lists the simulations of a startup', async () => {
    const startupId = (await SimulationModel.findById(simulationId))!.startupId.toString();
    const res = await request(h.app)
      .get(`/api/v1/startups/${startupId}/simulations`)
      .set(authHeader(user))
      .expect(200);
    expect(res.body.simulations.map((s: { id: string }) => s.id)).toEqual([simulationId]);
  });
});

describe('preview', () => {
  it('returns the engine estimate for the next turn', async () => {
    const res = await request(h.app)
      .post(`/api/v1/simulations/${simulationId}/preview`)
      .set(authHeader(user))
      .send(MARKETING)
      .expect(200);
    expect(res.body.label).toBe('Simulation estimate');
    expect(h.engine.calls).toContain('preview:1');
  });

  it('validates the decisions body', async () => {
    const res = await request(h.app)
      .post(`/api/v1/simulations/${simulationId}/preview`)
      .set(authHeader(user))
      .send({ decisions: [{ type: 'BRIBERY', value: 1 }] })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('playing turns', () => {
  it('enqueues a job and returns its id', async () => {
    const res = await playTurn();
    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ status: 'QUEUED', turnNumber: 1, progress: 0, error: null });
    expect(h.queue.waiting).toEqual([res.body.jobId]);
  });

  it('runs the job: stages relayed, record appended, state advanced', async () => {
    const { jobId } = (await playTurn()).body;
    await h.drain();

    const job = await request(h.app).get(`/api/v1/jobs/${jobId}`).set(authHeader(user)).expect(200);
    expect(job.body).toMatchObject({ status: 'COMPLETED', progress: 100, stage: 'COMPLETE' });
    expect(job.body.startedAt).not.toBeNull();
    expect(job.body.completedAt).not.toBeNull();

    const sim = await request(h.app)
      .get(`/api/v1/simulations/${simulationId}`)
      .set(authHeader(user));
    expect(sim.body.currentTurn).toBe(1);
    expect(sim.body.activeJobId).toBeNull();
    expect(sim.body.currentState).toEqual(fixture.records[0]!.stateAfter);

    const turns = await request(h.app)
      .get(`/api/v1/simulations/${simulationId}/turns`)
      .set(authHeader(user))
      .expect(200);
    expect(turns.body.turns).toHaveLength(1);
    expect(turns.body.turns[0]).toMatchObject({
      turnNumber: 1,
      simulationId,
      decisions: MARKETING.decisions,
    });

    const kinds = h.bus.published.map((e) =>
      e.type === 'job' ? `job:${e.job!.status}` : `stage:${e.stage}`,
    );
    expect(kinds).toEqual([
      'job:QUEUED',
      'job:RUNNING',
      'stage:PROCESSING_DECISION',
      'stage:UPDATING_FINANCIAL_MODEL',
      'stage:COMPLETE',
      'job:COMPLETED',
    ]);
  });

  it('plays ten turns in sequence', async () => {
    for (let turn = 1; turn <= 10; turn++) {
      expect((await playTurn(user, { decisions: [] })).status).toBe(202);
      await h.drain();
    }
    const sim = await request(h.app)
      .get(`/api/v1/simulations/${simulationId}`)
      .set(authHeader(user));
    expect(sim.body.currentTurn).toBe(10);
    expect(sim.body.currentState).toEqual(fixture.records[9]!.stateAfter);
    expect(await TurnModel.countDocuments({ simulationId })).toBe(10);
  });

  it('allows only one queued or running job per simulation', async () => {
    expect((await playTurn()).status).toBe(202);
    const second = await playTurn();
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('TURN_IN_PROGRESS');
    await h.drain();
    expect((await playTurn()).status).toBe(202);
  });

  it('enforces the one-active-job rule in the database as well', async () => {
    await playTurn();
    const sim = await SimulationModel.findById(simulationId);
    await expect(
      JobModel.create({
        ownerId: sim!.ownerId,
        simulationId: sim!._id,
        turnNumber: 1,
        decisions: [],
        activeLock: true,
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('leaves the simulation at its previous turn when the pipeline rejects the decisions', async () => {
    h.engine.rejectNext = {
      code: 'DECISIONS_REJECTED',
      message: 'One or more decisions were rejected',
      details: [{ field: 'decisions[0].value', reason: 'price cannot be negative' }],
    };
    const { jobId } = (await playTurn()).body;
    await h.drain();
    const job = await request(h.app).get(`/api/v1/jobs/${jobId}`).set(authHeader(user));
    expect(job.body.status).toBe('FAILED');
    expect(job.body.error).toMatchObject({ code: 'DECISIONS_REJECTED' });
    const sim = await request(h.app)
      .get(`/api/v1/simulations/${simulationId}`)
      .set(authHeader(user));
    expect(sim.body).toMatchObject({ currentTurn: 0, activeJobId: null });
    expect(await TurnModel.countDocuments({ simulationId })).toBe(0);
    expect((await playTurn()).status).toBe(202); // the lock was released
  });

  it('fails the job cleanly when the engine is unreachable', async () => {
    h.engine.throwNext = new EngineError(
      'ENGINE_UNAVAILABLE',
      'The simulation engine is unavailable',
    );
    const { jobId } = (await playTurn()).body;
    await h.drain();
    const job = await JobModel.findById(jobId);
    expect(job!.status).toBe('FAILED');
    expect(job!.error).toMatchObject({ code: 'ENGINE_UNAVAILABLE' });
    expect(job!.activeLock).toBeUndefined();
    expect(await TurnModel.countDocuments({ simulationId })).toBe(0);
  });

  it('rejects a record that does not continue from the current state', async () => {
    h.engine.alterNext = (record) => {
      record.stateBefore.cash += 1;
    };
    const { jobId } = (await playTurn()).body;
    await h.drain();
    expect((await JobModel.findById(jobId))!.error).toMatchObject({
      code: 'ENGINE_CONTRACT_VIOLATION',
    });
  });

  it('returns 503 and releases the lock when the queue is down', async () => {
    h.queue.failNext = true;
    const res = await playTurn();
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('QUEUE_UNAVAILABLE');
    expect(await JobModel.findOne({ simulationId })).toMatchObject({ status: 'FAILED' });
    expect((await playTurn()).status).toBe(202);
  });

  it('marks the simulation bankrupt and refuses further turns', async () => {
    h.engine.alterNext = (record) => {
      record.stateAfter.cash = -1;
    };
    await playTurn();
    await h.drain();
    const sim = await request(h.app)
      .get(`/api/v1/simulations/${simulationId}`)
      .set(authHeader(user));
    expect(sim.body.status).toBe('BANKRUPT');
    const res = await playTurn();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SIMULATION_NOT_ACTIVE');
  });

  it('finishes a retried job without writing the turn twice', async () => {
    const { jobId } = (await playTurn()).body;
    await h.drain();
    await JobModel.updateOne({ _id: jobId }, { $set: { status: 'RUNNING', activeLock: true } });
    await h.processor.process(jobId);
    expect(await TurnModel.countDocuments({ simulationId })).toBe(1);
    expect((await JobModel.findById(jobId))!.status).toBe('COMPLETED');
  });
});

describe('cancelling', () => {
  it('cancels a queued job before it runs', async () => {
    const { jobId } = (await playTurn()).body;
    const res = await request(h.app)
      .post(`/api/v1/jobs/${jobId}/cancel`)
      .set(authHeader(user))
      .expect(202);
    expect(res.body.status).toBe('CANCELLED');
    expect(h.queue.waiting).toEqual([]);
    await h.processor.process(jobId); // a stale delivery does nothing
    expect(await TurnModel.countDocuments({ simulationId })).toBe(0);
    expect((await playTurn()).status).toBe(202);
  });

  it('stops a running job before its record is written', async () => {
    const { jobId } = (await playTurn()).body;
    h.engine.beforeResult = async () => {
      await request(h.app).post(`/api/v1/jobs/${jobId}/cancel`).set(authHeader(user)).expect(202);
    };
    h.queue.waiting.length = 0; // simulate the worker having picked it up
    await h.processor.process(jobId);
    expect((await JobModel.findById(jobId))!.status).toBe('CANCELLED');
    expect(await TurnModel.countDocuments({ simulationId })).toBe(0);
  });

  it('refuses to cancel a finished job', async () => {
    const { jobId } = (await playTurn()).body;
    await h.drain();
    const res = await request(h.app)
      .post(`/api/v1/jobs/${jobId}/cancel`)
      .set(authHeader(user))
      .expect(409);
    expect(res.body.error.code).toBe('JOB_FINISHED');
  });
});

describe('turn records', () => {
  it('cannot be updated', async () => {
    await playTurn();
    await h.drain();
    const turn = await TurnModel.findOne({ simulationId });
    await expect(
      TurnModel.updateOne({ _id: turn!._id }, { $set: { turnNumber: 9 } }),
    ).rejects.toThrow('immutable');
    await expect(
      TurnModel.findOneAndUpdate({ _id: turn!._id }, { $set: { turnNumber: 9 } }),
    ).rejects.toThrow('immutable');
    turn!.turnNumber = 9;
    await expect(turn!.save()).rejects.toThrow('immutable');
  });
});

describe('ownership', () => {
  it("user B cannot see or play user A's simulation or jobs", async () => {
    const other = await register(h.app);
    const { jobId } = (await playTurn()).body;
    for (const [method, url] of [
      ['get', `/simulations/${simulationId}`],
      ['get', `/simulations/${simulationId}/turns`],
      ['post', `/simulations/${simulationId}/preview`],
      ['post', `/simulations/${simulationId}/turns`],
      ['get', `/jobs/${jobId}`],
      ['post', `/jobs/${jobId}/cancel`],
    ] as const) {
      const res = await request(h.app)[method](url).set(authHeader(other)).send(MARKETING);
      expect(res.status, `${method} ${url}`).toBe(404);
    }
    const startupId = (await SimulationModel.findById(simulationId))!.startupId.toString();
    await request(h.app)
      .post(`/api/v1/startups/${startupId}/simulation`)
      .set(authHeader(other))
      .send({})
      .expect(404);
  });
});

describe('deleting a startup', () => {
  it('removes its simulations, turns and jobs', async () => {
    await playTurn();
    await h.drain();
    const startupId = (await SimulationModel.findById(simulationId))!.startupId.toString();
    await request(h.app).delete(`/api/v1/startups/${startupId}`).set(authHeader(user)).expect(204);
    expect(await SimulationModel.countDocuments({ _id: simulationId })).toBe(0);
    expect(await TurnModel.countDocuments({ simulationId })).toBe(0);
    expect(await JobModel.countDocuments({ simulationId })).toBe(0);
  });

  it('is refused while a turn is in progress', async () => {
    await playTurn();
    const startupId = (await SimulationModel.findById(simulationId))!.startupId.toString();
    const res = await request(h.app)
      .delete(`/api/v1/startups/${startupId}`)
      .set(authHeader(user))
      .expect(409);
    expect(res.body.error.code).toBe('TURN_IN_PROGRESS');
  });
});

describe('agent memory', () => {
  it('sends a bounded summary of the previous turns with each pipeline request', async () => {
    for (let turn = 1; turn <= 7; turn++) {
      await playTurn(user, { decisions: [] });
      await h.drain();
    }
    const requests = h.engine.turnRequests;
    expect(requests[0]!.memory).toEqual([]);
    const last = requests.at(-1)!;
    expect(last.turnNumber).toBe(7);
    expect(last.memory!.map((m) => m.turnNumber)).toEqual([2, 3, 4, 5, 6]);
    expect(last.memory!.at(-1)).toMatchObject({
      revenue: fixture.records[5]!.stateAfter.revenue,
      customers: fixture.records[5]!.stateAfter.customers,
    });
  });
});

describe('AI CEO advice', () => {
  const ask = (body: object, owner = user) =>
    request(h.app)
      .post(`/api/v1/simulations/${simulationId}/advice`)
      .set(authHeader(owner))
      .send(body);

  it('needs a played turn', async () => {
    const res = await ask({ mode: 'ANALYZE' }).expect(409);
    expect(res.body.error.code).toBe('NO_TURNS_YET');
  });

  it('answers about the latest turn with its record and earlier history, and logs it', async () => {
    for (let turn = 1; turn <= 3; turn++) {
      await playTurn(user, { decisions: [] });
      await h.drain();
    }
    const res = await ask({ mode: 'EXPLAIN', question: 'Why did profit fall?' }).expect(200);
    expect(res.body).toMatchObject({ available: true, mode: 'EXPLAIN' });
    const sent = h.engine.adviceRequests.at(-1)!;
    expect(sent.turn.turnNumber).toBe(3);
    expect(sent.history.map((t) => t.turnNumber)).toEqual([1, 2]);
    expect(sent.industry).toBe('SAAS');
    expect(await AdviceModel.countDocuments({ simulationId })).toBe(1);

    await ask({ mode: 'SCENARIO', question: 'Raise marketing?', turnNumber: 1 }).expect(200);
    expect(h.engine.adviceRequests.at(-1)!.history).toEqual([]);
  });

  it('validates the mode and is scoped to the owner', async () => {
    await playTurn();
    await h.drain();
    await ask({ mode: 'GUESS' }).expect(400);
    const other = await register(h.app);
    await ask({ mode: 'ANALYZE' }, other).expect(404);
  });
});
