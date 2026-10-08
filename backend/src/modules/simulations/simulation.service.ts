import { randomInt } from 'node:crypto';
import mongoose, { isValidObjectId } from 'mongoose';
import type {
  ScenarioComparison,
  ScenarioRequest,
  SimulationAnalytics,
  AdviceRequest,
  AIAdvice,
  Decision,
  DecisionPreview,
  Simulation,
  SimulationStartRequest,
  SimulationState,
  SimulationTurn,
  StartupConfiguration,
} from '@stackforge/shared';
import { EngineError, type EngineClient } from '../../engine/engine-client.js';
import { AppError, notFound } from '../../errors.js';
import { UserModel } from '../auth/user.model.js';
import { LlmUsageService, startupProfile } from '../llm/llm-usage.service.js';
import { StartupModel } from '../startups/startup.model.js';
import { SimulationModel, type SimulationDoc } from './simulation.model.js';
import { AdviceModel } from './advice.model.js';
import { TurnModel, toTurnDto } from './turn.model.js';
import { recentSummaries } from './turn-summary.js';

const MAX_RANDOM_SEED = 2 ** 48 - 1; // crypto.randomInt's range limit

/** Maps simulation-service failures to API errors. */
export function engineFailure(err: unknown): unknown {
  if (!(err instanceof EngineError)) return err;
  if (err.code === 'ENGINE_VERSION_UNSUPPORTED') {
    return new AppError(
      409,
      'ENGINE_VERSION_UNSUPPORTED',
      'This simulation was created with an engine version this server no longer runs',
      err.details,
    );
  }
  if (err.code === 'UNKNOWN_LOCATION') {
    return new AppError(400, 'UNKNOWN_LOCATION', err.message);
  }
  if (err.unavailable) {
    return new AppError(
      503,
      'SIMULATION_ENGINE_UNAVAILABLE',
      'The simulation engine is unavailable',
    );
  }
  return new AppError(502, 'SIMULATION_ENGINE_ERROR', 'The simulation engine reported an error', {
    code: err.code,
  });
}

/**
 * Simulations, their state and their turn history. Every query is scoped to the owner.
 * Current state is always the stateAfter of the latest turn record (or the initial state).
 */
export class SimulationService {
  constructor(
    private readonly engine: EngineClient,
    private readonly usage: LlmUsageService = new LlmUsageService(0),
  ) {}

  async findOwned(ownerId: string, id: string): Promise<SimulationDoc> {
    if (!isValidObjectId(id)) throw notFound('Simulation');
    const doc = await SimulationModel.findOne({ _id: id, ownerId });
    if (!doc) throw notFound('Simulation');
    return doc;
  }

  async currentState(sim: SimulationDoc): Promise<SimulationState> {
    const latest = await TurnModel.findOne({ simulationId: sim._id })
      .sort({ turnNumber: -1 })
      .select({ record: 1 })
      .lean();
    return latest
      ? (latest.record as SimulationTurn).stateAfter
      : (sim.initialState as SimulationState);
  }

  async toDto(sim: SimulationDoc): Promise<Simulation> {
    const startup = await StartupModel.findById(sim.startupId)
      .select({ name: 1, product: 1 })
      .lean();
    return {
      startupName: startup?.name ?? '',
      productName: startup?.product?.name ?? '',
      id: sim.id as string,
      ownerId: sim.ownerId.toString(),
      startupId: sim.startupId.toString(),
      seed: sim.seed,
      agentMode: sim.agentMode as Simulation['agentMode'],
      status: sim.status as Simulation['status'],
      engineVersion: sim.engineVersion,
      currentTurn: sim.currentTurn,
      configuration: sim.configuration as StartupConfiguration,
      currentState: await this.currentState(sim),
      activeJobId: sim.activeJobId ?? null,
      createdAt: sim.createdAt.toISOString(),
      updatedAt: sim.updatedAt.toISOString(),
    };
  }

  async start(
    ownerId: string,
    startupId: string,
    input: SimulationStartRequest,
    requestId?: string,
  ): Promise<Simulation> {
    if (!isValidObjectId(startupId)) throw notFound('Startup');
    const startup = await StartupModel.findOne({ _id: startupId, ownerId });
    if (!startup) throw notFound('Startup');
    // Unverified accounts can sign in, look around and set up startups, but not simulate.
    if (
      !(await UserModel.exists({
        _id: ownerId,
        emailVerifiedAt: mongoose.trusted({ $type: 'date' }),
      }))
    ) {
      throw new AppError(
        403,
        'EMAIL_NOT_VERIFIED',
        'Confirm your email address before starting a simulation',
      );
    }
    const agentMode = input.agentMode ?? 'rules';
    const seed = input.seed ?? randomInt(0, MAX_RANDOM_SEED);
    // The simulation keeps its own copy of the configuration, so later startup edits never
    // change a game in progress.
    const configuration = structuredClone(startup.configuration) as StartupConfiguration;
    const started = await this.engine
      .start({ configuration, seed }, requestId)
      .catch((err: unknown) => {
        throw engineFailure(err);
      });
    const sim = await SimulationModel.create({
      ownerId,
      startupId,
      seed,
      agentMode,
      engineVersion: started.engineVersion,
      configuration,
      initialState: started.state,
    });
    return this.toDto(sim);
  }

  async listForStartup(ownerId: string, startupId: string): Promise<Simulation[]> {
    if (!isValidObjectId(startupId)) throw notFound('Startup');
    if (!(await StartupModel.exists({ _id: startupId, ownerId }))) throw notFound('Startup');
    const sims = await SimulationModel.find({ ownerId, startupId }).sort({ createdAt: -1 });
    return Promise.all(sims.map((s) => this.toDto(s)));
  }

  async get(ownerId: string, id: string): Promise<Simulation> {
    return this.toDto(await this.findOwned(ownerId, id));
  }

  async turns(ownerId: string, id: string): Promise<SimulationTurn[]> {
    const sim = await this.findOwned(ownerId, id);
    const docs = await TurnModel.find({ simulationId: sim._id }).sort({ turnNumber: 1 });
    return docs.map((d) => toTurnDto(d));
  }

  /** Dashboard and analytics data, computed by the simulation service from the stored turns. */
  async analytics(ownerId: string, id: string, requestId?: string): Promise<SimulationAnalytics> {
    const sim = await this.findOwned(ownerId, id);
    const turns = await TurnModel.find({ simulationId: sim._id })
      .sort({ turnNumber: 1 })
      .select({ record: 1 })
      .lean();
    return this.engine
      .analytics(
        {
          initialState: sim.initialState as SimulationState,
          records: turns.map((t) => t.record as SimulationTurn),
          seed: sim.seed,
          configuration: sim.configuration as StartupConfiguration,
          engineVersion: sim.engineVersion,
        },
        requestId,
      )
      .catch((err: unknown) => {
        throw engineFailure(err);
      });
  }

  /**
   * Runs two decision sets from the current state for 1-6 turns (same seed, rules agents).
   * Nothing is written to the turn history.
   */
  async scenario(
    ownerId: string,
    id: string,
    input: ScenarioRequest,
    requestId?: string,
  ): Promise<ScenarioComparison> {
    const sim = await this.findOwned(ownerId, id);
    assertActive(sim);
    return this.engine
      .scenario(
        {
          state: await this.currentState(sim),
          configuration: sim.configuration as StartupConfiguration,
          seed: sim.seed,
          horizon: input.horizon,
          branches: [input.baseline, input.alternative],
          engineVersion: sim.engineVersion,
        },
        requestId,
      )
      .catch((err: unknown) => {
        throw engineFailure(err);
      });
  }

  async preview(
    ownerId: string,
    id: string,
    decisions: Decision[],
    requestId?: string,
  ): Promise<DecisionPreview> {
    const sim = await this.findOwned(ownerId, id);
    assertActive(sim);
    const state = await this.currentState(sim);
    return this.engine
      .preview(
        {
          state,
          decisions,
          configuration: sim.configuration as StartupConfiguration,
          seed: sim.seed,
          turnNumber: state.turn + 1,
          engineVersion: sim.engineVersion,
        },
        requestId,
      )
      .catch((err: unknown) => {
        throw engineFailure(err);
      });
  }

  /**
   * Asks the AI CEO about a turn (the latest by default). The advisor sees the turn record
   * (including its forecast) and the turns before it; every request is logged.
   */
  async advise(
    ownerId: string,
    id: string,
    input: AdviceRequest,
    requestId?: string,
  ): Promise<AIAdvice> {
    const sim = await this.findOwned(ownerId, id);
    const turnNumber = input.turnNumber ?? sim.currentTurn;
    if (turnNumber < 1) {
      throw new AppError(409, 'NO_TURNS_YET', 'Play a turn before asking the AI CEO');
    }
    const turn = await TurnModel.findOne({ simulationId: sim._id, turnNumber }).lean();
    if (!turn) throw notFound('Turn');
    const configuration = sim.configuration as StartupConfiguration;
    const advice = await this.engine
      .advise(
        {
          mode: input.mode,
          ...(input.question ? { question: input.question } : {}),
          industry: configuration.industry,
          businessModel: configuration.businessModel,
          turn: turn.record as SimulationTurn,
          history: await recentSummaries(sim._id, turnNumber),
          startupProfile: await startupProfile(sim.startupId),
          tokenAllowance: await this.usage.allowance(ownerId),
        },
        requestId,
      )
      .catch((err: unknown) => {
        throw engineFailure(err);
      });
    const saved = await AdviceModel.create({
      ownerId,
      simulationId: sim._id,
      turnNumber,
      mode: input.mode,
      question: input.question ?? null,
      advice,
    });
    await this.usage.record(
      sim.ownerId,
      sim._id,
      turnNumber,
      advice.llmCalls,
      `advice:${saved.id}`,
    );
    return advice;
  }
}

export function assertActive(sim: SimulationDoc): void {
  if (sim.status !== 'ACTIVE') {
    throw new AppError(
      409,
      'SIMULATION_NOT_ACTIVE',
      sim.status === 'BANKRUPT'
        ? 'The startup is bankrupt; no further turns can be played'
        : `The simulation is ${sim.status.toLowerCase()}`,
    );
  }
}
