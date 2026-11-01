import type { SimulationJob, SimulationTurn } from '@stackforge/shared';
import type { ToastInput } from '../components/feedback/Toaster';
import { formatChange, formatInrCompact } from './format';
import { describeJobError } from './play';

/** The toast for a finished job; completed turns are announced once their record has loaded. */
export function jobToast(job: SimulationJob): ToastInput | null {
  if (job.status === 'FAILED') {
    return {
      kind: 'error',
      title: `Turn ${job.turnNumber} failed`,
      body: describeJobError(job) || 'Nothing changed; you can play the turn again.',
    };
  }
  if (job.status === 'CANCELLED') {
    return {
      kind: 'info',
      title: `Turn ${job.turnNumber} cancelled`,
      body: 'Nothing was recorded; your decisions are still in the form.',
    };
  }
  return null;
}

/** The toasts for a newly recorded turn: completion, and the quota notice when it applied. */
export function turnToasts(turn: SimulationTurn, previous: SimulationTurn | null): ToastInput[] {
  const s = turn.stateAfter;
  const revenueChange = previous ? s.revenue - previous.stateAfter.revenue : null;
  const toasts: ToastInput[] = [
    {
      kind: 'success',
      title: `Turn ${turn.turnNumber} complete`,
      body: `Revenue ${formatInrCompact(s.revenue)}${
        revenueChange === null ? '' : ` (${formatChange('money', revenueChange)})`
      }, profit ${formatInrCompact(s.profit)}.`,
    },
  ];
  if (turn.llmUsage?.dailyQuotaExhausted) {
    toasts.push({
      kind: 'warning',
      key: 'quota',
      title: 'Daily AI quota reached',
      body: 'This turn ran in rules mode: rule-based customer and competitor agents, and no AI CEO analysis until the quota resets.',
    });
  }
  return toasts;
}
