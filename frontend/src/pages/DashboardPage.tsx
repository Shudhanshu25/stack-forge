import { QuotaNotice } from '../components/AccountNotices';
import { LineChartCard } from '../components/charts/Charts';
import { SERIES } from '../components/charts/theme';
import { CeoPanel } from '../components/dashboard/CeoPanel';
import { DecisionPanel, turnBlockedReason } from '../components/dashboard/DecisionPanel';
import { EventCards } from '../components/dashboard/EventCards';
import { KpiRow } from '../components/dashboard/KpiRow';
import { MarketPanel } from '../components/dashboard/MarketPanel';
import { EmptyState, ErrorState, PanelBoundary } from '../components/feedback/States';
import { useUserName } from '../auth/AuthContext';
import { formatInrCompact } from '../lib/format';
import { useSimulationContext } from './SimulationLayout';

export { jobToast, turnToasts } from '../lib/turnToasts';

/** "Good morning, Aarav" by the local time of day. */
export function greeting(name: string | undefined, now = new Date()): string {
  const h = now.getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

/** The founder dashboard: KPIs, revenue and profit, decisions, market and the AI CEO. */
export function DashboardPage() {
  const { simulation, analytics, turns, reload, analyticsError, turnsError, runner } =
    useSimulationContext();
  const latest = turns.at(-1) ?? null;
  const userName = useUserName();

  const retry = () => void reload();
  const blocked = turnBlockedReason(simulation, runner.running);
  const rows =
    analytics?.series.map((p) => ({ turn: p.turn, revenue: p.revenue, profit: p.profit })) ?? [];

  return (
    <div className="dash">
      <div className="stack">
        <div className="greeting">
          <div>
            <h2 className="section-h">{greeting(userName ?? undefined)}</h2>
            <p className="muted small">
              Here&apos;s how {simulation.startupName} is performing in month{' '}
              {simulation.currentTurn}.
            </p>
          </div>
        </div>
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
