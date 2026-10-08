import type {
  AdvisorRequest,
  EngineAnalyticsRequest,
  EngineInfoResponse,
  EngineScenarioRequest,
  ScenarioComparison,
  SimulationAnalytics,
  AIAdvice,
  DecisionPreview,
  EnginePreviewRequest,
  EngineReplayRequest,
  EngineReplayResponse,
  EngineStartRequest,
  EngineStartResponse,
  LocationCatalog,
  LocationProfile,
  LocationProfileRequest,
  PipelineError,
  PipelineEvent,
  PipelineStage,
  PipelineTurnRequest,
  SimulationTurn,
} from '@stackforge/shared';
import { check, type SchemaId } from '../contracts.js';
import { traceHeaders } from '../observability/tracing.js';

/** A failure talking to the simulation service. `code` is stable for API errors and job errors. */
export class EngineError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'EngineError';
  }

  get unavailable(): boolean {
    return this.code === 'ENGINE_UNAVAILABLE' || this.code === 'ENGINE_TIMEOUT';
  }
}

export type PipelineOutcome = { record: SimulationTurn } | { error: PipelineError };

export interface StageUpdate {
  stage: PipelineStage;
  progress: number;
}

export interface EngineClient {
  start(request: EngineStartRequest, requestId?: string): Promise<EngineStartResponse>;
  preview(request: EnginePreviewRequest, requestId?: string): Promise<DecisionPreview>;
  replay(request: EngineReplayRequest, requestId?: string): Promise<EngineReplayResponse>;
  analytics(request: EngineAnalyticsRequest, requestId?: string): Promise<SimulationAnalytics>;
  scenario(request: EngineScenarioRequest, requestId?: string): Promise<ScenarioComparison>;
  info(requestId?: string): Promise<EngineInfoResponse>;
  /** States, listed cities and tiers. */
  locations(requestId?: string): Promise<LocationCatalog>;
  /** Resolves a listed city, or another city by state and tier; UNKNOWN_LOCATION if unknown. */
  locationProfile(request: LocationProfileRequest, requestId?: string): Promise<LocationProfile>;
  /** AI CEO advice; failures inside the advisor come back as advice marked unavailable. */
  advise(request: AdvisorRequest, requestId?: string): Promise<AIAdvice>;
  /** Runs the turn pipeline, calling onStage as each stage completes. */
  runTurn(
    request: PipelineTurnRequest,
    onStage: (update: StageUpdate) => Promise<void>,
    requestId?: string,
  ): Promise<PipelineOutcome>;
}

/** Calls the FastAPI simulation service. Requests and responses are checked against the shared schemas. */
export class HttpEngineClient implements EngineClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
    private readonly pipelineTimeoutMs: number,
  ) {}

  start(request: EngineStartRequest, requestId?: string) {
    return this.post<EngineStartResponse>(
      '/engine/start',
      request,
      'engine-start-request.schema.json',
      'engine-start-response.schema.json',
      requestId,
    );
  }

  preview(request: EnginePreviewRequest, requestId?: string) {
    return this.post<DecisionPreview>(
      '/engine/preview',
      request,
      'engine-preview-request.schema.json',
      'decision-preview.schema.json',
      requestId,
    );
  }

  replay(request: EngineReplayRequest, requestId?: string) {
    return this.post<EngineReplayResponse>(
      '/engine/replay',
      request,
      'engine-replay-request.schema.json',
      'engine-replay-response.schema.json',
      requestId,
    );
  }

  analytics(request: EngineAnalyticsRequest, requestId?: string) {
    return this.post<SimulationAnalytics>(
      '/analytics/simulation',
      request,
      'engine-analytics-request.schema.json',
      'simulation-analytics.schema.json',
      requestId,
      this.pipelineTimeoutMs, // previews every decision turn
    );
  }

  scenario(request: EngineScenarioRequest, requestId?: string) {
    return this.post<ScenarioComparison>(
      '/engine/scenario',
      request,
      'engine-scenario-request.schema.json',
      'scenario-comparison.schema.json',
      requestId,
    );
  }

  info(requestId?: string): Promise<EngineInfoResponse> {
    return this.get<EngineInfoResponse>(
      '/engine/info',
      'engine-info-response.schema.json',
      requestId,
    );
  }

  locations(requestId?: string): Promise<LocationCatalog> {
    return this.get<LocationCatalog>('/locations', 'location-catalog.schema.json', requestId);
  }

  locationProfile(request: LocationProfileRequest, requestId?: string) {
    return this.post<LocationProfile>(
      '/locations/profile',
      request,
      'location-profile-request.schema.json',
      'location-profile.schema.json',
      requestId,
    );
  }

  private async get<T>(path: string, responseSchema: SchemaId, requestId?: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(new URL(path, this.baseUrl), {
        headers: requestId ? { 'X-Request-Id': requestId } : {},
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw asEngineError(err);
    }
    if (!response.ok) throw await errorFrom(response);
    const data: unknown = await response.json();
    assertContract(responseSchema, data, 'response');
    return data as T;
  }

  advise(request: AdvisorRequest, requestId?: string) {
    return this.post<AIAdvice>(
      '/advisor/ask',
      request,
      'advisor-request.schema.json',
      'ai-advice.schema.json',
      requestId,
      this.pipelineTimeoutMs, // the advisor may call the LLM twice
    );
  }

  async runTurn(
    request: PipelineTurnRequest,
    onStage: (update: StageUpdate) => Promise<void>,
    requestId?: string,
  ): Promise<PipelineOutcome> {
    assertContract('pipeline-turn-request.schema.json', request, 'request');
    const response = await this.fetch('/pipeline/turn', request, this.pipelineTimeoutMs, requestId);
    if (!response.ok) throw await errorFrom(response);
    if (!response.body) throw new EngineError('ENGINE_PROTOCOL_ERROR', 'Pipeline returned no body');

    try {
      for await (const event of ndjson(response.body)) {
        assertContract('pipeline-event.schema.json', event, 'event');
        const e = event as PipelineEvent;
        if (e.type === 'stage' && e.stage !== undefined) {
          await onStage({ stage: e.stage, progress: e.progress ?? 0 });
        } else if (e.type === 'result' && e.record) {
          return { record: e.record };
        } else if (e.type === 'error' && e.error) {
          return { error: e.error };
        } else {
          throw new EngineError('ENGINE_PROTOCOL_ERROR', `Malformed ${e.type} event`);
        }
      }
    } catch (err) {
      throw asEngineError(err);
    }
    throw new EngineError('ENGINE_PROTOCOL_ERROR', 'Pipeline ended without a result');
  }

  private async post<T>(
    path: string,
    body: unknown,
    requestSchema: SchemaId,
    responseSchema: SchemaId,
    requestId?: string,
    timeoutMs = this.timeoutMs,
  ): Promise<T> {
    assertContract(requestSchema, body, 'request');
    const response = await this.fetch(path, body, timeoutMs, requestId);
    if (!response.ok) throw await errorFrom(response);
    let data: unknown;
    try {
      data = await response.json();
    } catch (err) {
      throw asEngineError(err);
    }
    assertContract(responseSchema, data, 'response');
    return data as T;
  }

  private async fetch(
    path: string,
    body: unknown,
    timeoutMs: number,
    requestId?: string,
  ): Promise<Response> {
    try {
      return await fetch(new URL(path, this.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(requestId ? { 'X-Request-Id': requestId } : {}),
          ...traceHeaders(),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw asEngineError(err);
    }
  }
}

function assertContract(id: SchemaId, data: unknown, what: string): void {
  const issues = check(id, data);
  if (issues) {
    throw new EngineError(
      'ENGINE_CONTRACT_VIOLATION',
      `Engine ${what} does not match ${id}`,
      issues,
    );
  }
}

function asEngineError(err: unknown): EngineError {
  if (err instanceof EngineError) return err;
  const name = (err as Error)?.name;
  if (name === 'TimeoutError' || name === 'AbortError') {
    return new EngineError('ENGINE_TIMEOUT', 'The simulation engine did not respond in time');
  }
  if (err instanceof SyntaxError) {
    return new EngineError('ENGINE_PROTOCOL_ERROR', 'The simulation engine sent invalid JSON');
  }
  return new EngineError('ENGINE_UNAVAILABLE', 'The simulation engine is unavailable');
}

async function errorFrom(response: Response): Promise<EngineError> {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
    };
    if (body.error?.code) {
      return new EngineError(
        body.error.code,
        body.error.message ?? 'Engine error',
        body.error.details,
      );
    }
  } catch {
    // fall through to a generic error
  }
  return new EngineError('ENGINE_ERROR', `Simulation engine responded ${response.status}`);
}

/** Parses a newline-delimited JSON stream, tolerating lines split across chunks. */
export async function* ndjson(body: AsyncIterable<Uint8Array>): AsyncGenerator<unknown> {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) yield JSON.parse(buffer);
}
