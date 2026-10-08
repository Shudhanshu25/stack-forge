import type { AgentMode, Simulation, Startup } from '@stackforge/shared';
import { simulationApi } from '../api/endpoints';

/** The startup's latest simulation, or a new one; `fresh` always starts a new one. */
export async function openStartupSimulation(
  startup: Pick<Startup, 'id'>,
  { fresh = false, agentMode = 'rules' }: { fresh?: boolean; agentMode?: AgentMode } = {},
): Promise<Simulation> {
  const [latest] = fresh ? [] : await simulationApi.listForStartup(startup.id);
  return latest ?? (await simulationApi.start(startup.id, { agentMode }));
}
