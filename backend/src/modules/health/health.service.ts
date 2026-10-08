import type { HealthServicesResponse } from '@stackforge/shared';

/** Resolves when the dependency is reachable; rejects (or times out) when it is not. */
export type HealthCheck = () => Promise<unknown>;

export interface HealthChecks {
  mongodb: HealthCheck;
  redis: HealthCheck;
  simulationEngine: HealthCheck;
}

const TIMEOUT_MS = 1500;

async function probe(check: HealthCheck): Promise<'ok' | 'down'> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
  });
  try {
    await Promise.race([check(), timeout]);
    return 'ok';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}

export class HealthService {
  constructor(private readonly checks: HealthChecks) {}

  async services(): Promise<HealthServicesResponse> {
    const [mongodb, redis, simulationEngine] = await Promise.all([
      probe(this.checks.mongodb),
      probe(this.checks.redis),
      probe(this.checks.simulationEngine),
    ]);
    return { api: 'ok', mongodb, redis, simulationEngine };
  }
}

/** Checks the FastAPI service's own /health endpoint. */
export function simulationEngineCheck(baseUrl: string): HealthCheck {
  return async () => {
    const response = await fetch(new URL('/health', baseUrl), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await response.json()) as { status?: string };
    if (!response.ok || body.status !== 'ok') throw new Error('simulation engine unhealthy');
  };
}
