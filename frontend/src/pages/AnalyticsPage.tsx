import { useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import type { EstimatedEffect, SimulationAnalytics } from '@stackforge/shared';
import { LineChartCard, StackedBarCard } from '../components/charts/Charts';
import { SERIES } from '../components/charts/theme';
import { EmptyState, ErrorState, Spinner } from '../components/feedback/States';
import { LocationAnalytics } from '../components/location/LocationAnalytics';
import { Term } from '../components/Term';
import {
  formatCount,
  formatInrCompact,
  formatMaybeInr,
  formatMonths,
  formatPercent,
} from '../lib/format';
import { DECISION_LABELS, METRIC_LABELS } from '../lib/play';
import { REPORT_FORMATS, useReportExport, type ReportFormat } from '../hooks/useReportExport';
import { useSimulationContext } from './SimulationLayout';

const TABS = [
  ['financial', 'Financial'],
  ['customers', 'Customers'],
  ['market', 'Market'],
  ['decisions', 'Decisions'],
  ['forecasts', 'Forecasts'],
  ['location', 'Location'],
] as const;
type Tab = (typeof TABS)[number][0];

const SEGMENT_LABELS: Record<string, string> = {
  PRICE_SENSITIVE: 'Price-sensitive',
  PREMIUM: 'Premium',
  LOYAL: 'Loyal',
  OCCASIONAL: 'Occasional',
  ENTERPRISE: 'Enterprise',
};

/** Rows keyed by turn, one column per group value. */
function pivot<T extends { turn: number }>(
  items: T[],
  group: (x: T) => string,
  value: (x: T) => number,
) {
  const rows = new Map<number, Record<string, number>>();
  for (const item of items) {
    const row = rows.get(item.turn) ?? { turn: item.turn };
    row[group(item)] = value(item);
    rows.set(item.turn, row);
  }
  return [...rows.values()];
}

function Exports({ simulationId }: { simulationId: string }) {
  const exportReport = useReportExport(simulationId);
  const [busy, setBusy] = useState<ReportFormat | null>(null);
  const get = (format: ReportFormat) => async () => {
    setBusy(format);
    await exportReport(format);
    setBusy(null);
  };
  return (
    <div className="actions flush">
      <span className="small muted">Export report</span>
      {REPORT_FORMATS.map((f) => (
        <button key={f} type="button" onClick={get(f)} disabled={busy !== null}>
          {busy === f && <Spinner />}
          {f.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Financial({ a }: { a: SimulationAnalytics }) {
  const latest = a.series.at(-1)!;
  const tile = (label: React.ReactNode, value: string, note?: string) => (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {note && <div className="xs muted">{note}</div>}
    </div>
  );
  return (
    <div className="stack">
      <div className="kpis">
        {tile(<Term k="grossMargin">Gross margin</Term>, formatPercent(latest.grossMargin))}
        {tile(
          <Term k="burnRate">Burn rate</Term>,
          latest.burnRate ? formatInrCompact(latest.burnRate) : '₹0',
          'per month',
        )}
        {tile(
          <Term k="runway">Runway</Term>,
          latest.runwayMonths === null ? 'not burning' : formatMonths(latest.runwayMonths),
        )}
        {tile(<Term k="cac">CAC</Term>, formatMaybeInr(latest.cac), 'this turn')}
        {tile(<Term k="ltv">LTV</Term>, formatMaybeInr(latest.ltv))}
        {tile('ARPU', formatMaybeInr(latest.arpu), 'revenue per customer')}
      </div>
      <div className="two-col">
        <LineChartCard
          title="Revenue and expenses"
          rows={a.series.map((p) => ({
            turn: p.turn,
            revenue: p.revenue,
            expenses: p.expensesTotal,
          }))}
          series={[
            { key: 'revenue', label: 'Revenue', color: SERIES[0] },
            { key: 'expenses', label: 'Expenses', color: SERIES[1] },
          ]}
          format={formatInrCompact}
          ranges
        />
        <LineChartCard
          title="Cash"
          rows={a.series.map((p) => ({ turn: p.turn, cash: p.cash }))}
          series={[{ key: 'cash', label: 'Cash', color: SERIES[0] }]}
          format={formatInrCompact}
          zeroLine
          ranges
        />
      </div>
      <StackedBarCard
        title="Where the money goes"
        subtitle="Expenses per turn by category"
        rows={a.series.slice(1).map((p) => ({
          turn: p.turn,
          variable: p.variableCosts,
          fixed: p.fixedCosts,
          marketing: p.marketingCosts,
          employees: p.employeeCosts,
          product: p.productCosts,
        }))}
        series={[
          { key: 'employees', label: 'Salaries', color: SERIES[0] },
          { key: 'marketing', label: 'Marketing', color: SERIES[1] },
          { key: 'fixed', label: 'Fixed costs', color: SERIES[2] },
          { key: 'variable', label: 'Variable costs', color: SERIES[3] },
          { key: 'product', label: 'Product investment', color: SERIES[4] },
        ]}
        format={formatInrCompact}
      />
    </div>
  );
}

function Customers({ a }: { a: SimulationAnalytics }) {
  const segmentSeries = Object.entries(SEGMENT_LABELS).map(([key, label], i) => ({
    key,
    label,
    color: SERIES[i]!,
  }));
  const latestTurn = a.currentTurn;
  const latest = a.segments.filter((s) => s.turn === latestTurn);
  return (
    <div className="stack">
      <div className="two-col">
        <LineChartCard
          title="Customers by segment"
          rows={pivot(
            a.segments,
            (s) => s.segment,
            (s) => s.customers,
          )}
          series={segmentSeries}
          format={(v) => formatCount(v)}
        />
        <StackedBarCard
          title="New and churned customers"
          rows={a.series
            .slice(1)
            .map((p) => ({ turn: p.turn, gained: p.newCustomers, lost: p.churnedCustomers }))}
          series={[
            { key: 'gained', label: 'New', color: SERIES[0] },
            { key: 'lost', label: 'Churned', color: SERIES[1] },
          ]}
          format={(v) => formatCount(v)}
          stacked={false}
        />
      </div>
      <LineChartCard
        title={
          <>
            Monthly <Term k="churn">churn</Term> by segment
          </>
        }
        rows={pivot(
          a.segments.filter((s) => s.turn > 0),
          (s) => s.segment,
          (s) => s.churnProbability,
        )}
        series={segmentSeries}
        format={(v) => formatPercent(v, 1)}
        height={220}
      />
      <section className="card">
        <h2>Segments at turn {latestTurn}</h2>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label={`Segments at turn ${latestTurn}`}
        >
          <table>
            <thead>
              <tr>
                <th>Segment</th>
                <th className="right">Population</th>
                <th className="right">Your customers</th>
                <th className="right">Penetration</th>
                <th className="right">Churn / month</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((s) => (
                <tr key={s.segment}>
                  <td>{SEGMENT_LABELS[s.segment]}</td>
                  <td className="right">{formatCount(s.population)}</td>
                  <td className="right">{formatCount(s.customers)}</td>
                  <td className="right">
                    {formatPercent(s.population ? s.customers / s.population : 0)}
                  </td>
                  <td className="right">{formatPercent(s.churnProbability)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Market({ a }: { a: SimulationAnalytics }) {
  const names = [...new Map(a.competitors.map((c) => [c.id, c.name])).entries()];
  const prices = pivot(
    a.competitors,
    (c) => c.id,
    (c) => c.price,
  ).map((row, i) => ({
    ...row,
    you: a.series[i]?.price ?? null,
  }));
  return (
    <div className="stack">
      <div className="two-col">
        <LineChartCard
          title="Your price against competitors"
          rows={prices}
          series={[
            { key: 'you', label: 'You', color: SERIES[0] },
            ...names.map(([id, name], i) => ({ key: id, label: name, color: SERIES[i + 1]! })),
          ]}
          format={formatInrCompact}
        />
        <LineChartCard
          title="Competitor market share"
          rows={pivot(
            a.competitors,
            (c) => c.id,
            (c) => c.marketShare,
          )}
          series={names.map(([id, name], i) => ({ key: id, label: name, color: SERIES[i + 1]! }))}
          format={(v) => formatPercent(v, 1)}
        />
      </div>
      <div className="two-col">
        <LineChartCard
          title={
            <>
              Your <Term k="marketShare">market share</Term>
            </>
          }
          rows={a.series.map((p) => ({ turn: p.turn, share: p.marketShare }))}
          series={[{ key: 'share', label: 'Market share', color: SERIES[0] }]}
          format={(v) => formatPercent(v, 3)}
        />
        <LineChartCard
          title="Sentiment, pressure and awareness"
          rows={a.series.map((p) => ({
            turn: p.turn,
            sentiment: p.customerSatisfaction,
            pressure: p.competitorPressure,
            awareness: p.brandAwareness,
          }))}
          series={[
            { key: 'sentiment', label: 'Customer sentiment', color: SERIES[0] },
            { key: 'pressure', label: 'Competitor pressure', color: SERIES[1] },
            { key: 'awareness', label: 'Brand awareness', color: SERIES[2] },
          ]}
          format={(v) => formatPercent(v, 0)}
        />
      </div>
      <LineChartCard
        title="Market demand index"
        subtitle="Seasonality × active events (1.0 = a normal month)"
        rows={a.series.slice(1).map((p) => ({ turn: p.turn, demand: p.demandIndex }))}
        series={[{ key: 'demand', label: 'Demand index', color: SERIES[0] }]}
        format={(v) => `${v.toFixed(2)}×`}
        height={180}
      />
    </div>
  );
}

function EffectChips({ effects }: { effects: EstimatedEffect[] }) {
  const moved = effects.filter((e) => e.direction !== 'FLAT');
  if (moved.length === 0) return <span className="muted">no noticeable effect</span>;
  return (
    <span className="chips">
      {moved.map((e) => (
        <span key={e.metric} className="chip">
          {e.direction === 'UP' ? '▲' : '▼'} {METRIC_LABELS[e.metric] ?? e.metric}{' '}
          <span className="muted">{e.magnitude.toLowerCase()}</span>
        </span>
      ))}
    </span>
  );
}

function Decisions({ a, dashboard }: { a: SimulationAnalytics; dashboard: string }) {
  if (a.decisions.length === 0) {
    return (
      <EmptyState
        title="No decisions to compare yet"
        action={
          <Link to={dashboard} className="button primary">
            Change a decision on the dashboard
          </Link>
        }
      >
        Each turn where you changed price, marketing, hiring or product appears here, with what the
        preview estimated against how the metrics really moved.
      </EmptyState>
    );
  }
  const scored = a.decisions.filter((d) => d.directionAgreement !== null);
  const average = scored.length
    ? scored.reduce((sum, d) => sum + d.directionAgreement!, 0) / scored.length
    : null;
  return (
    <section className="card">
      <div className="card-head">
        <h2>Previewed against actual impact</h2>
        <span className="small secondary">
          Direction agreement {average === null ? '—' : formatPercent(average, 0)} over{' '}
          {scored.length} turn{scored.length === 1 ? '' : 's'}
        </span>
      </div>
      <p className="xs muted">
        Preview: what the decisions were estimated to do against changing nothing (rules agents,
        same seed). Actual: how each metric really moved over the turn, including events,
        competitors and agents.
      </p>
      <div
        className="table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Previewed against actual impact per decision"
      >
        <table>
          <thead>
            <tr>
              <th>Turn</th>
              <th>Decisions</th>
              <th>Previewed</th>
              <th>Actual movement</th>
              <th className="right">Agreement</th>
            </tr>
          </thead>
          <tbody>
            {[...a.decisions].reverse().map((d) => (
              <tr key={d.turn}>
                <td>{d.turn}</td>
                <td className="wrap">
                  {d.decisions.map((x) => (
                    <div key={x.decision.type}>
                      {DECISION_LABELS[x.decision.type]}{' '}
                      {x.decision.type === 'HIRING'
                        ? x.decision.value
                        : formatInrCompact(x.decision.value)}
                    </div>
                  ))}
                </td>
                <td className="wrap">
                  <EffectChips effects={d.combinedPreview} />
                </td>
                <td className="wrap">
                  <EffectChips effects={d.actual} />
                </td>
                <td className="right">
                  {d.directionAgreement === null ? '—' : formatPercent(d.directionAgreement, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Forecasts({ a, dashboard }: { a: SimulationAnalytics; dashboard: string }) {
  const acc = a.forecastAccuracy;
  if (a.forecasts.length === 0) {
    return (
      <EmptyState
        title="No forecasts yet"
        action={
          <Link to={dashboard} className="button primary">
            Play a turn
          </Link>
        }
      >
        After each turn the forecasting model predicts the next month&apos;s revenue, customers and
        churn. Forecasts and their accuracy against what happened appear here once a turn has been
        played with a trained model available.
      </EmptyState>
    );
  }
  const tile = (label: string, value: string, note: string) => (
    <div className="kpi" key={label}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="xs muted">{note}</div>
    </div>
  );
  const rows = (key: 'revenue' | 'customers') =>
    a.forecasts.map((f) => ({
      turn: f.targetTurn,
      forecast: f.predicted[key],
      actual: f.actual?.[key] ?? null,
    }));
  const series = [
    { key: 'actual', label: 'Actual', color: SERIES[0] },
    { key: 'forecast', label: 'Forecast', color: SERIES[1], dashed: true },
  ];
  return (
    <div className="stack">
      <div className="kpis">
        {tile(
          'Revenue error',
          acc.revenueMape === null ? '—' : `${acc.revenueMape.toFixed(1)}%`,
          'mean absolute % error',
        )}
        {tile(
          'Customers error',
          acc.customersMape === null ? '—' : `${acc.customersMape.toFixed(1)}%`,
          'mean absolute % error',
        )}
        {tile(
          'Churn error',
          acc.churnRateMae === null ? '—' : `${(acc.churnRateMae * 100).toFixed(2)} pts`,
          'mean absolute error',
        )}
        {tile('Compared turns', String(acc.pairs), 'forecast and actual both known')}
      </div>
      <div className="two-col">
        <LineChartCard
          title="Revenue: forecast against actual"
          rows={rows('revenue')}
          series={series}
          format={formatInrCompact}
        />
        <LineChartCard
          title="Customers: forecast against actual"
          rows={rows('customers')}
          series={series}
          format={(v) => formatCount(v)}
        />
      </div>
      <p className="xs muted">
        Forecasts are ML estimates made after each turn for the next one, assuming decisions stay
        the same. They never change the simulation.
      </p>
    </div>
  );
}

/** Financial, customer, market, decision and forecast analytics, plus report export. */
export function AnalyticsPage() {
  const { simulation, analytics, analyticsError, reload } = useSimulationContext();
  const { tab = 'financial' } = useParams();
  const current = (TABS.some(([t]) => t === tab) ? tab : 'financial') as Tab;
  const dashboard = `/simulations/${simulation.id}`;
  let body;
  if (!analytics) {
    body = (
      <ErrorState
        title="Analytics could not be loaded"
        message={analyticsError}
        onRetry={() => void reload()}
      />
    );
  } else if (analytics.series.length < 2) {
    body = (
      <EmptyState
        title="Not enough history yet"
        action={
          <Link to={dashboard} className="button primary">
            Play your first turn
          </Link>
        }
      >
        Analytics compare months. After your first turn this page shows revenue against costs, cash,
        customers by segment, competitors and the market, and how your decisions and the forecasts
        played out.
      </EmptyState>
    );
  } else {
    body = (
      <div key={current} className="view-fade stack">
        {current === 'financial' && <Financial a={analytics} />}
        {current === 'customers' && <Customers a={analytics} />}
        {current === 'market' && <Market a={analytics} />}
        {current === 'decisions' && <Decisions a={analytics} dashboard={dashboard} />}
        {current === 'forecasts' && <Forecasts a={analytics} dashboard={dashboard} />}
        {current === 'location' && <LocationAnalytics impact={analytics.location} />}
      </div>
    );
  }
  return (
    <div className="stack">
      <div className="page-head tight">
        <nav className="tabs bare" aria-label="Analytics">
          {TABS.map(([key, label]) => (
            <NavLink
              key={key}
              to={`/simulations/${simulation.id}/analytics/${key}`}
              className={current === key ? 'active' : ''}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <Exports simulationId={simulation.id} />
      </div>
      {body}
    </div>
  );
}
