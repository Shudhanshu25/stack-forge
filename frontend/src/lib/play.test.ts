import { describe, expect, it } from 'vitest';
import type { SimulationJob, SimulationState } from '@stackforge/shared';
import {
  PIPELINE_STAGES,
  STAGE_LABELS,
  describeJobError,
  formFromState,
  isActive,
  pipelineSteps,
  recordEvent,
  toDecisions,
  withTrace,
  type JobTrace,
} from './play';
import { socketUrl } from './socket';

const state = { price: 49_900, marketingBudget: 5_000_000, employees: 3 } as SimulationState;

describe('play helpers', () => {
  it('labels every pipeline stage in the shared enum', () => {
    expect(PIPELINE_STAGES.at(-1)).toBe('COMPLETE');
    for (const stage of PIPELINE_STAGES) expect(STAGE_LABELS[stage]).toBeTruthy();
  });

  it('prefills the form from the current state', () => {
    expect(formFromState(state)).toEqual({
      priceRupees: 499,
      marketingRupees: 50_000,
      employees: 3,
      productInvestmentRupees: 0,
    });
  });

  it('sends only changed levers, and product investment only when positive', () => {
    const form = formFromState(state);
    expect(toDecisions(form, state)).toEqual([]);
    expect(
      toDecisions({ ...form, priceRupees: 599, productInvestmentRupees: 20_000 }, state),
    ).toEqual([
      { type: 'PRICING', value: 59_900 },
      { type: 'PRODUCT_QUALITY', value: 2_000_000 },
    ]);
    expect(toDecisions({ ...form, employees: 5 }, state)).toEqual([{ type: 'HIRING', value: 5 }]);
  });

  it('explains rejected decisions', () => {
    const job = {
      status: 'FAILED',
      error: {
        code: 'DECISIONS_REJECTED',
        message: 'One or more decisions were rejected',
        details: [{ field: 'decisions[0].value', reason: 'price cannot be negative' }],
      },
    } as SimulationJob;
    expect(describeJobError(job)).toBe(
      'One or more decisions were rejected: price cannot be negative',
    );
    expect(isActive(job)).toBe(false);
    expect(isActive({ ...job, status: 'RUNNING' })).toBe(true);
  });

  it('derives the websocket url from the api url', () => {
    expect(socketUrl('http://localhost:4000/api/v1')).toBe('ws://localhost:4000/api/v1/ws');
    expect(socketUrl('https://api.example.com/api/v1/')).toBe('wss://api.example.com/api/v1/ws');
    expect(socketUrl('/api/v1', 'https://stackforge.example')).toBe(
      'wss://stackforge.example/api/v1/ws',
    );
  });
});

describe('job tracking', () => {
  const queued = {
    jobId: 'j1',
    simulationId: 's1',
    turnNumber: 2,
    status: 'QUEUED',
    progress: 0,
    stage: null,
    startedAt: null,
    completedAt: null,
    error: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  } as SimulationJob;

  it('applies events that arrived before the job id was known', () => {
    // A fast turn: the socket reports completion before POST /turns returns the QUEUED job.
    const traces = new Map<string, JobTrace>();
    recordEvent(traces, { type: 'job', simulationId: 's1', job: { ...queued, status: 'RUNNING' } });
    recordEvent(traces, {
      type: 'stage',
      simulationId: 's1',
      jobId: 'j1',
      stage: 'PROCESSING_DECISION',
      progress: 45,
    });
    recordEvent(traces, {
      type: 'stage',
      simulationId: 's1',
      jobId: 'j1',
      stage: 'COMPLETE',
      progress: 100,
    });
    recordEvent(traces, {
      type: 'job',
      simulationId: 's1',
      job: { ...queued, status: 'COMPLETED', progress: 100 },
    });

    const shown = withTrace(queued, traces.get('j1'));
    expect(shown.status).toBe('COMPLETED');
    expect(traces.get('j1')!.stages).toEqual(['PROCESSING_DECISION', 'COMPLETE']);
  });

  it('never moves a job backwards and fills in progress while it runs', () => {
    const traces = new Map<string, JobTrace>();
    recordEvent(traces, { type: 'job', simulationId: 's1', job: { ...queued, status: 'RUNNING' } });
    recordEvent(traces, { type: 'job', simulationId: 's1', job: queued });
    recordEvent(traces, {
      type: 'stage',
      simulationId: 's1',
      jobId: 'j1',
      stage: 'UPDATING_FINANCIAL_MODEL',
      progress: 90,
    });
    expect(withTrace(queued, traces.get('j1'))).toMatchObject({
      status: 'RUNNING',
      progress: 90,
      stage: 'UPDATING_FINANCIAL_MODEL',
    });
  });
});

describe('turn pipeline checklist', () => {
  const states = (steps: ReturnType<typeof pipelineSteps>) =>
    steps.map((s) => `${s.stage}:${s.state}`);

  it('while queued every stage waits', () => {
    const steps = pipelineSteps([], 'QUEUED');
    expect(steps).toHaveLength(PIPELINE_STAGES.length);
    expect(steps.every((s) => s.state === 'pending')).toBe(true);
  });

  it('ticks off received stages and marks the next one active', () => {
    const steps = pipelineSteps(['PROCESSING_DECISION', 'ANALYZING_CUSTOMERS'], 'RUNNING');
    expect(states(steps).slice(0, 3)).toEqual([
      'PROCESSING_DECISION:done',
      'ANALYZING_CUSTOMERS:done',
      'ANALYZING_COMPETITORS:active',
    ]);
    expect(steps.filter((s) => s.state === 'active')).toHaveLength(1);
  });

  it('leaves out stages passed over without an event', () => {
    const steps = pipelineSteps(['PROCESSING_DECISION', 'UPDATING_FINANCIAL_MODEL'], 'RUNNING');
    const names = steps.map((s) => s.stage);
    expect(names).not.toContain('ANALYZING_CUSTOMERS');
    expect(steps.find((s) => s.state === 'active')?.stage).toBe('GENERATING_FORECAST');
  });

  it('once finished shows only what happened', () => {
    const steps = pipelineSteps(['PROCESSING_DECISION', 'COMPLETE'], 'COMPLETED');
    expect(states(steps)).toEqual(['PROCESSING_DECISION:done', 'COMPLETE:done']);
  });
});
