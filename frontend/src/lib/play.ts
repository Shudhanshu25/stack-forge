import type {
  Decision,
  JobStatus,
  PipelineStage,
  SimulationJob,
  SimulationState,
  WsServerMessage,
} from '@stackforge/shared';
import enums from '@stackforge/shared/schemas/enums.schema.json';
import { paiseToRupees, rupeesToPaise } from './money';

/** Every pipeline stage, in order. Stages a milestone has not built are simply never reported. */
export const PIPELINE_STAGES = enums.definitions.PipelineStage.enum as PipelineStage[];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  PROCESSING_DECISION: 'Processing decision',
  ANALYZING_CUSTOMERS: 'Analyzing customers',
  ANALYZING_COMPETITORS: 'Analyzing competitors',
  APPLYING_MARKET_EVENT: 'Applying market event',
  UPDATING_FINANCIAL_MODEL: 'Updating financial model',
  GENERATING_FORECAST: 'Generating forecast',
  AI_CEO_ANALYSIS: 'AI CEO analysis',
  COMPLETE: 'Complete',
};

export interface PipelineStep {
  stage: PipelineStage;
  state: 'done' | 'active' | 'pending';
}

/**
 * The pipeline as a checklist, driven only by the stage events received: reached stages are
 * done; while the job runs, the stage after the last one reached is active and the rest are
 * pending. Stages passed over without an event (a milestone that has not built them) are left
 * out rather than shown as stuck.
 */
export function pipelineSteps(
  reached: readonly PipelineStage[],
  status: JobStatus | null,
): PipelineStep[] {
  const done = new Set(reached);
  const last = Math.max(-1, ...reached.map((s) => PIPELINE_STAGES.indexOf(s)));
  const running = status === 'RUNNING';
  const waiting = status === 'QUEUED' || running;
  return PIPELINE_STAGES.flatMap((stage, i): PipelineStep[] => {
    if (done.has(stage)) return [{ stage, state: 'done' }];
    if (!waiting || i < last) return [];
    return [{ stage, state: running && i === last + 1 ? 'active' : 'pending' }];
  });
}

export const TERMINAL: JobStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED'];
export const isActive = (job: SimulationJob | null): boolean =>
  job !== null && !TERMINAL.includes(job.status);

/** The four decisions, in rupees and headcount, as the form edits them. */
export interface DecisionForm {
  priceRupees: number;
  marketingRupees: number;
  employees: number;
  productInvestmentRupees: number;
}

export function formFromState(state: SimulationState): DecisionForm {
  return {
    priceRupees: paiseToRupees(state.price),
    marketingRupees: paiseToRupees(state.marketingBudget),
    employees: state.employees,
    productInvestmentRupees: 0,
  };
}

/**
 * Turns the form into engine decisions: only the levers that differ from the current state
 * (unchanged levers simply persist), plus product investment when positive (it is one-off).
 */
export function toDecisions(form: DecisionForm, state: SimulationState): Decision[] {
  const price = rupeesToPaise(form.priceRupees);
  const marketing = rupeesToPaise(form.marketingRupees);
  const employees = Math.round(form.employees);
  const decisions: Decision[] = [];
  if (price !== state.price) decisions.push({ type: 'PRICING', value: price });
  if (marketing !== state.marketingBudget) decisions.push({ type: 'MARKETING', value: marketing });
  if (employees !== state.employees) decisions.push({ type: 'HIRING', value: employees });
  if (form.productInvestmentRupees > 0) {
    decisions.push({ type: 'PRODUCT_QUALITY', value: rupeesToPaise(form.productInvestmentRupees) });
  }
  return decisions;
}

export const DECISION_LABELS: Record<Decision['type'], string> = {
  PRICING: 'Price',
  MARKETING: 'Marketing',
  HIRING: 'Hiring',
  PRODUCT_QUALITY: 'Product investment',
  FIRING: 'Firing',
  R_AND_D: 'R&D',
  EXPANSION: 'Expansion',
  COST_CUTTING: 'Cost cutting',
  FUNDING: 'Funding',
};

export const METRIC_LABELS: Record<string, string> = {
  revenue: 'Revenue',
  profit: 'Profit',
  cash: 'Cash',
  customers: 'Customers',
  newCustomers: 'New customers',
  churnedCustomers: 'Churned customers',
  marketShare: 'Market share',
  customerSatisfaction: 'Satisfaction',
  brandAwareness: 'Brand awareness',
  productQuality: 'Product quality',
};

/** Human-readable reason for a failed job, including each rejected decision. */
export function describeJobError(job: SimulationJob): string {
  if (!job.error) return '';
  const details = Array.isArray(job.error.details)
    ? (job.error.details as { field?: string; reason?: string }[])
        .map((d) => d.reason)
        .filter(Boolean)
    : [];
  return details.length ? `${job.error.message}: ${details.join('; ')}` : job.error.message;
}

const STATUS_RANK: Record<JobStatus, number> = {
  QUEUED: 0,
  RUNNING: 1,
  COMPLETED: 2,
  FAILED: 2,
  CANCELLED: 2,
};

/** The more advanced of two snapshots of the same job (status only ever moves forward). */
export function latest(a: SimulationJob, b: SimulationJob): SimulationJob {
  return STATUS_RANK[b.status] >= STATUS_RANK[a.status] ? b : a;
}

/** Everything heard about one job over the socket. */
export interface JobTrace {
  job: SimulationJob | null;
  stages: PipelineStage[];
  progress: number;
}

/**
 * Records a socket event under its job id, whether or not the page knows that job yet: a fast
 * turn can finish before the HTTP response that returns its id. Returns the job id, if any.
 */
export function recordEvent(traces: Map<string, JobTrace>, event: WsServerMessage): string | null {
  const jobId = event.jobId ?? event.job?.jobId;
  if (!jobId) return null;
  const trace = traces.get(jobId) ?? { job: null, stages: [], progress: 0 };
  if (event.type === 'stage' && event.stage) {
    if (!trace.stages.includes(event.stage)) trace.stages = [...trace.stages, event.stage];
    trace.progress = Math.max(trace.progress, event.progress ?? 0);
  } else if (event.type === 'job' && event.job) {
    trace.job = trace.job ? latest(trace.job, event.job) : event.job;
  }
  traces.set(jobId, trace);
  return jobId;
}

/** A job snapshot brought up to date with what the socket already reported. */
export function withTrace(job: SimulationJob, trace?: JobTrace): SimulationJob {
  if (!trace) return job;
  let merged = trace.job ? latest(job, trace.job) : job;
  if (isActive(merged) && trace.progress > merged.progress) {
    merged = { ...merged, progress: trace.progress, stage: trace.stages.at(-1) ?? merged.stage };
  }
  return merged;
}
