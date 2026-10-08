import { useEffect, useRef } from 'react';
import type { SimulationJob, SimulationTurn } from '@stackforge/shared';
import { QuotaNotice } from '../components/AccountNotices';
import { LineChartCard } from '../components/charts/Charts';
import { SERIES } from '../components/charts/theme';
import { CeoPanel } from '../components/dashboard/CeoPanel';
import { DecisionPanel, turnBlockedReason } from '../components/dashboard/DecisionPanel';
import { EventCards } from '../components/dashboard/EventCards';
import { KpiRow } from '../components/dashboard/KpiRow';
import { MarketPanel } from '../components/dashboard/MarketPanel';
import { EmptyState, ErrorState, PanelBoundary } from '../components/feedback/States';
import { useToast, type ToastInput } from '../components/feedback/Toaster';
import { useTurnRunner } from '../hooks/useSimulation';
import { formatChange, formatInrCompact } from '../lib/format';
import { describeJobError } from '../lib/play';
import { useTour } from '../onboarding/Onboarding';
import { useSimulationContext } from './SimulationLayout';

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

/** The founder dashboard: KPIs, revenue and profit, decisions, market and the AI CEO. */
export function DashboardPage() {
  const { simulation, analytics, turns, reload, analyticsError, turnsError } =
    useSimulationContext();
  const tour = useTour();
  const { notify } = useToast();
  // A turn this page played: announced once its record has loaded (with the quota flag).
  const expected = useRef<number | null>(null);
  const runner = useTurnRunner(simulation.id, simulation.activeJobId, (job) => {
    if (job.status === 'COMPLETED') {
      expected.current = job.turnNumber;
      tour.advance('play');
    }
    void reload();
    const toast = jobToast(job);
    if (toast) notify(toast);
  });
  const latest = turns.at(-1) ?? null;

  useEffect(() => {
    if (expected.current === null || !latest || latest.turnNumber < expected.current) return;
    expected.current = null;
    turnToasts(latest, turns.at(-2) ?? null).forEach(notify);
  }, [latest, turns, notify]);

  const retry = () => void reload();
  const blocked = turnBlockedReason(simulation, runner.running);
  const rows =
    analytics?.series.map((p) => ({ turn: p.turn, revenue: p.revenue, profit: p.profit })) ?? [];

  return (
    <div className="dash">
      <div className="stack">
        <QuotaNotice exhaustedOnLastTurn={Boolean(latest?.llmUsage?.dailyQuotaExhausted)} />
        {turns.length === 0 && !turnsError && (
          <EmptyState
            title="No turns played yet"
            action={
              <button
                type="button"
                className="primary"
                disabled={blocked !== null}
                onClick={() => void runner.play([])}
              >
                Play turn 1 with the starting plan
              </button>
            }
          >
            Each turn is one month. After the first, this dashboard shows how your KPIs changed,
            revenue and profit over time, how customers and competitors reacted, and the AI
            CEO&apos;s analysis. Adjust the decisions below first, or start with the plan you set
            up.
          </EmptyState>
        )}
        <EventCards
          simulationId={simulation.id}
          latest={latest}
          market={analytics?.market ?? null}
        />
        {analytics ? (
          <>
            <PanelBoundary name="Key metrics">
              <KpiRow kpis={analytics.kpis} />
            </PanelBoundary>
            <PanelBoundary name="Revenue and profit chart">
              <LineChartCard
                title="Revenue and profit"
                subtitle="Per turn (month), Indian rupees"
                rows={rows}
                series={[
                  { key: 'revenue', label: 'Revenue', color: SERIES[0] },
                  { key: 'profit', label: 'Profit', color: SERIES[1] },
                ]}
                format={formatInrCompact}
                height={260}
                zeroLine
                ranges
              />
            </PanelBoundary>
          </>
        ) : (
          <ErrorState
            title="Key metrics and charts could not be loaded"
            message={analyticsError}
            onRetry={retry}
          />
        )}
        <div className="two-col">
          <PanelBoundary name="Decisions">
            <DecisionPanel simulation={simulation} runner={runner} />
          </PanelBoundary>
          <PanelBoundary name="Market">
            {analytics ? (
              <MarketPanel market={analytics.market} latest={latest} />
            ) : (
              <ErrorState
                title="The market could not be loaded"
                message={analyticsError}
                onRetry={retry}
              />
            )}
          </PanelBoundary>
        </div>
      </div>
      <aside className="stack dash-side">
        <PanelBoundary name="AI CEO">
          <CeoPanel
            simulationId={simulation.id}
            latest={latest}
            turnsError={turnsError}
            onRetryTurns={retry}
          />
        </PanelBoundary>
      </aside>
    </div>
  );
}
