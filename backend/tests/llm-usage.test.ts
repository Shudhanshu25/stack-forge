import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LlmCall } from '@stackforge/shared';
import { LlmUsageModel } from '../src/modules/llm/llm-usage.model.js';
import { LlmUsageService } from '../src/modules/llm/llm-usage.service.js';
import { authHeader, harness, novaTech, register, type RegisteredUser } from './helpers.js';

const QUOTA = 5_000;

const call = (
  purpose: LlmCall['purpose'],
  promptTokens: number,
  completionTokens = 100,
): LlmCall => ({
  purpose,
  model: 'gemini-test',
  promptVersion: `${purpose}@v1`,
  promptTokens,
  completionTokens,
  cached: false,
  outcome: 'ok',
});

let h: ReturnType<typeof harness>;
let user: RegisteredUser;
let simulationId: string;

beforeEach(async () => {
  h = harness({ llmUserDailyTokenQuota: QUOTA });
  user = await register(h.app);
  const startup = await request(h.app)
    .post('/api/v1/startups')
    .set(authHeader(user))
    .send({ ...novaTech, product: { name: 'Nova CRM', description: 'CRM for small shops' } });
  simulationId = (
    await request(h.app)
      .post(`/api/v1/startups/${startup.body.id}/simulation`)
      .set(authHeader(user))
      .send({ seed: 9, agentMode: 'llm' })
      .expect(201)
  ).body.id;
});

/** Plays a turn whose pipeline reports `calls`. */
async function playTurn(calls: LlmCall[], quotaExhausted = false) {
  h.engine.alterNext = (record) => {
    record.llmUsage = {
      promptVersions: {},
      calls,
      dailyQuotaExhausted: quotaExhausted,
      turnBudgetExhausted: false,
    };
  };
  await request(h.app)
    .post(`/api/v1/simulations/${simulationId}/turns`)
    .set(authHeader(user))
    .send({ decisions: [] })
    .expect(202);
  await h.drain();
}

const usage = async () =>
  (await request(h.app).get('/api/v1/account/llm-usage').set(authHeader(user)).expect(200)).body;

describe('daily LLM token quota', () => {
  it('sends the remaining allowance and the startup profile with every turn, and records usage', async () => {
    await playTurn([
      call('customer_agent', 1_000),
      call('competitor_agent', 900),
      call('advisor', 1_200, 300),
    ]);
    const first = h.engine.turnRequests[0]!;
    expect(first.tokenAllowance).toBe(QUOTA);
    expect(first.startupProfile).toEqual({
      name: 'NovaTech',
      productName: 'Nova CRM',
      productDescription: 'CRM for small shops',
    });
    expect(await usage()).toMatchObject({
      usedToday: 3_600,
      dailyQuota: QUOTA,
      remaining: 1_400,
      exhausted: false,
    });

    await playTurn([call('customer_agent', 1_300, 200)]);
    expect(h.engine.turnRequests[1]!.tokenAllowance).toBe(1_400);
    expect(await usage()).toMatchObject({ usedToday: 5_100, remaining: 0, exhausted: true });

    // Exhausted: the pipeline is told so (allowance 0) and runs the turn in rules mode.
    await playTurn([], true);
    expect(h.engine.turnRequests[2]!.tokenAllowance).toBe(0);
    const turns = await request(h.app)
      .get(`/api/v1/simulations/${simulationId}/turns`)
      .set(authHeader(user));
    expect(turns.body.turns[2].llmUsage.dailyQuotaExhausted).toBe(true);
  });

  it('on-demand advice also spends from, and is told about, the allowance', async () => {
    await playTurn([call('customer_agent', 2_000)]);
    const advise = vi.spyOn(h.engine, 'advise');
    advise.mockImplementationOnce(async (req) => ({
      available: true,
      mode: req.mode,
      summary: 'ok',
      positiveFactors: [],
      negativeFactors: [],
      keyRisk: '',
      keyOpportunity: '',
      recommendation: '',
      reasoning: '',
      confidence: 0.5,
      promptVersion: 'advisor@v1',
      llmCalls: [call('advisor', 1_500, 500)],
    }));
    await request(h.app)
      .post(`/api/v1/simulations/${simulationId}/advice`)
      .set(authHeader(user))
      .send({ mode: 'EXPLAIN' })
      .expect(200);
    expect(advise.mock.calls[0]![0]).toMatchObject({ tokenAllowance: QUOTA - 2_100 });
    expect((await usage()).usedToday).toBe(4_100);
  });

  it('a retried turn does not count its tokens twice', async () => {
    const service = new LlmUsageService(QUOTA);
    const calls = [call('customer_agent', 700)];
    await service.record(user.body.user.id, simulationId, 1, calls, 'turn:x:1');
    await service.record(user.body.user.id, simulationId, 1, calls, 'turn:x:1');
    expect(await LlmUsageModel.countDocuments({ callKey: 'turn:x:1:0' })).toBe(1);
    expect(await service.usedToday(user.body.user.id)).toBe(800);
  });

  it('yesterday does not count, and a quota of 0 means no limit', async () => {
    await LlmUsageModel.create({
      userId: user.body.user.id,
      purpose: 'advisor',
      model: 'm',
      promptVersion: 'advisor@v1',
      promptTokens: 9_999,
      completionTokens: 0,
      outcome: 'ok',
      createdAt: new Date(Date.now() - 36 * 3_600_000),
    });
    expect((await usage()).usedToday).toBe(0);
    expect(await new LlmUsageService(0).allowance(user.body.user.id)).toBeNull();
  });
});
