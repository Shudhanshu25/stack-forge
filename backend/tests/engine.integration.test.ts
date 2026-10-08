/**
 * Cross-service contract test: the Node client against the real FastAPI service.
 * Skipped when simulation/.venv does not exist.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SimulationState, SimulationTurn } from '@stackforge/shared';
import { HttpEngineClient } from '../src/engine/engine-client.js';
import { fixture } from './helpers.js';

const simulationDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../simulation',
);
const python = [
  path.join(simulationDir, '.venv', 'Scripts', 'python.exe'),
  path.join(simulationDir, '.venv', 'bin', 'python'),
].find(existsSync);

const PORT = 18765;
const base = `http://127.0.0.1:${PORT}`;
let child: ChildProcess | undefined;

describe.skipIf(!python)('engine client against FastAPI', () => {
  beforeAll(async () => {
    child = spawn(
      python!,
      [
        '-m',
        'uvicorn',
        'app.main:app',
        '--host',
        '127.0.0.1',
        '--port',
        String(PORT),
        '--log-level',
        'warning',
      ],
      {
        cwd: simulationDir,
        stdio: 'ignore',
        env: { ...process.env, LOG_LEVEL: 'WARNING', LLM_PROVIDER: 'none' },
      },
    );
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        if ((await fetch(`${base}/health`)).ok) return;
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('FastAPI did not start');
  }, 40_000);

  afterAll(() => {
    child?.kill();
  });

  it('starts, previews, plays turns and replays them exactly', async () => {
    const client = new HttpEngineClient(base, 10_000, 30_000);
    const { configuration, seed } = fixture;
    const { state: initial } = await client.start({ configuration, seed });
    expect(initial).toEqual(fixture.initialState);

    const preview = await client.preview({
      state: initial,
      decisions: [{ type: 'MARKETING', value: 5_000_000 }],
      configuration,
      seed,
      turnNumber: 1,
    });
    expect(preview.label).toBe('Simulation estimate');

    // Replay the fixture's own decisions through the pipeline; records must match it exactly.
    let state: SimulationState = initial;
    const records: SimulationTurn[] = [];
    const stages: string[] = [];
    for (const stored of fixture.records.slice(0, 4)) {
      const outcome = await client.runTurn(
        {
          state,
          decisions: stored.decisions,
          configuration,
          seed,
          turnNumber: stored.turnNumber,
          agentMode: 'rules',
        },
        async ({ stage }) => {
          stages.push(stage);
        },
      );
      if (!('record' in outcome)) throw new Error(outcome.error.message);
      // The engine's part matches the stored run exactly; forecast, advice and LLM usage are
      // the pipeline's additions.
      const { forecast, advice, llmUsage, ...core } = outcome.record;
      expect(core).toEqual(stored);
      expect(llmUsage).toMatchObject({ calls: [], dailyQuotaExhausted: false });
      expect(forecast).toMatchObject({ targetTurn: stored.turnNumber + 1 });
      expect(advice).toMatchObject({ mode: 'ANALYZE' });
      records.push(outcome.record);
      state = outcome.record.stateAfter;
    }
    expect(stages.slice(0, 7)).toEqual([
      'PROCESSING_DECISION',
      'ANALYZING_CUSTOMERS',
      'ANALYZING_COMPETITORS',
      'APPLYING_MARKET_EVENT',
      'UPDATING_FINANCIAL_MODEL',
      'GENERATING_FORECAST',
      'AI_CEO_ANALYSIS',
    ]);

    // Records that went through JSON (as MongoDB stores them) replay exactly.
    const replay = await client.replay({
      initialState: initial,
      records: JSON.parse(JSON.stringify(records)),
      seed,
      configuration,
    });
    expect(replay.mismatches).toEqual([]);
  }, 30_000);

  it('returns rejected decisions as a pipeline error', async () => {
    const client = new HttpEngineClient(base, 10_000, 30_000);
    const outcome = await client.runTurn(
      {
        state: fixture.initialState,
        decisions: [{ type: 'MARKETING', value: -1 }],
        configuration: fixture.configuration,
        seed: fixture.seed,
        turnNumber: 1,
        agentMode: 'rules',
      },
      async () => {},
    );
    expect(outcome).toMatchObject({ error: { code: 'DECISIONS_REJECTED' } });
  });
});
