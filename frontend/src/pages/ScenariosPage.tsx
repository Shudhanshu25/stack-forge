import { useState, type FormEvent } from 'react';
import type { ScenarioComparison, ScenarioDifference } from '@stackforge/shared';
import { ApiError } from '../api/client';
import { simulationApi } from '../api/endpoints';
import { LineChartCard } from '../components/charts/Charts';
import { CompareBars } from '../components/charts/CompareBars';
import { SERIES } from '../components/charts/theme';
import { Field } from '../components/Field';
import { EmptyState, ErrorState, Spinner } from '../components/feedback/States';
import { formatCount, formatInrCompact, formatPercent } from '../lib/format';
import { formFromState, toDecisions, type DecisionForm } from '../lib/play';
import { useSimulationContext } from './SimulationLayout';

const METRIC_ROWS: {
  metric: ScenarioDifference['metric'];
  label: string;
  format: (v: number) => string;
}[] = [
  { metric: 'revenue', label: 'Total revenue', format: formatInrCompact },
  { metric: 'profit', label: 'Total profit', format: formatInrCompact },
  { metric: 'endCash', label: 'Cash at the end', format: formatInrCompact },
  { metric: 'endCustomers', label: 'Customers at the end', format: (v) => formatCount(v) },
  {
    metric: 'averageChurnRate',
    label: 'Average monthly churn',
    format: (v) => formatPercent(v, 2),
  },
];

function BranchEditor({
  title,
  label,
  form,
  onLabel,
  onChange,
  minEmployees,
}: {
  title: string;
  label: string;
  form: DecisionForm;
  onLabel: (v: string) => void;
  onChange: (f: DecisionForm) => void;
  minEmployees: number;
}) {
  const set = (key: keyof DecisionForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...form, [key]: e.target.value === '' ? 0 : Number(e.target.value) });
  return (
    <div className="card">
      <h2>{title}</h2>
      <Field label="Name">
        <input maxLength={40} value={label} onChange={(e) => onLabel(e.target.value)} />
      </Field>
      <div className="decision-grid">
        <Field label="Price (₹)">
          <input
            type="number"
            min={1}
            step="any"
            value={form.priceRupees || ''}
            onChange={set('priceRupees')}
          />
        </Field>
        <Field label="Marketing / month (₹)">
          <input
            type="number"
            min={0}
            step="any"
            value={form.marketingRupees}
            onChange={set('marketingRupees')}
          />
        </Field>
        <Field label="Employees">
          <input
            type="number"
            min={minEmployees}
            step={1}
            value={form.employees}
            onChange={set('employees')}
          />
        </Field>
        <Field label="Product investment (₹)">
          <input
            type="number"
            min={0}
            step="any"
            value={form.productInvestmentRupees}
            onChange={set('productInvestmentRupees')}
          />
        </Field>
      </div>
    </div>
  );
}

/** Words for a difference, without judging which branch is better. */
function describe(d: ScenarioDifference, format: (v: number) => string, label: string): string {
  if (d.difference === 0) return 'the same';
  const direction = d.difference > 0 ? 'higher' : 'lower';
  const size =
    d.metric === 'averageChurnRate'
      ? `${(Math.abs(d.difference) * 100).toFixed(2)} pts`
      : format(Math.abs(d.difference));
  return `${label} ${direction} by ${size}`;
}

/** Scenario comparison: two decision sets from the current state, same seed, rules agents. */
export function ScenariosPage() {
  const { simulation } = useSimulationContext();
  const state = simulation.currentState;
  const [horizon, setHorizon] = useState(3);
  const [baseline, setBaseline] = useState<DecisionForm>(() => formFromState(state));
  const [alternative, setAlternative] = useState<DecisionForm>(() => formFromState(state));
  const [labels, setLabels] = useState({ baseline: 'Current plan', alternative: 'Alternative' });
  const [result, setResult] = useState<ScenarioComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    void compare();
  }

  async function compare() {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await simulationApi.scenario(simulation.id, {
          horizon,
          baseline: {
            label: labels.baseline || 'Baseline',
            decisions: toDecisions(baseline, state),
          },
          alternative: {
            label: labels.alternative || 'Alternative',
            decisions: toDecisions(alternative, state),
          },
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The comparison failed');
    } finally {
      setBusy(false);
    }
  }

  const [a, b] = result?.branches ?? [];
  const rowsFor = (key: 'revenue' | 'profit' | 'customers' | 'churnRate' | 'cash') =>
    (a?.turns ?? []).map((t, i) => ({ turn: t.turn, a: t[key], b: b?.turns[i]?.[key] ?? null }));
  const series =
    a && b
      ? [
          { key: 'a', label: a.label, color: SERIES[0] },
          { key: 'b', label: b.label, color: SERIES[1] },
        ]
      : [];

  return (
    <div className="stack">
      <form onSubmit={submit} className="stack" id="scenario-form">
        <div className="two-col">
          <BranchEditor
            title="Branch A"
            label={labels.baseline}
            onLabel={(v) => setLabels({ ...labels, baseline: v })}
            form={baseline}
            onChange={setBaseline}
            minEmployees={state.employees}
          />
          <BranchEditor
            title="Branch B"
            label={labels.alternative}
            onLabel={(v) => setLabels({ ...labels, alternative: v })}
            form={alternative}
            onChange={setAlternative}
            minEmployees={state.employees}
          />
        </div>
        <div className="card actions spread flush">
          <span className="small secondary">
            Both branches start from turn {state.turn} with the same seed and rule-based agents, so
            the decisions are the only difference. Nothing is saved to your history.
          </span>
          <span className="actions flush">
            <label className="small secondary" htmlFor="horizon">
              Horizon
            </label>
            <select
              id="horizon"
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} turn{n > 1 ? 's' : ''}
                </option>
              ))}
            </select>
            <button className="primary" disabled={busy || simulation.status !== 'ACTIVE'}>
              {busy && <Spinner />}
              {busy ? 'Running' : 'Compare'}
            </button>
          </span>
        </div>
      </form>
      {error && (
        <ErrorState
          title="The comparison could not be run"
          message={error}
          onRetry={() => void compare()}
        />
      )}

      {!result && !error && (
        <EmptyState
          title="No scenario run yet"
          action={
            <button
              type="submit"
              form="scenario-form"
              className="primary"
              disabled={busy || simulation.status !== 'ACTIVE'}
            >
              Compare the two branches
            </button>
          }
        >
          Set two decision plans above. The comparison runs both from your current month with the
          same seed and shows their results side by side: bars for the totals, a table of
          differences, and charts turn by turn.
        </EmptyState>
      )}

      {result && a && b && (
        <>
          <section className="card">
            <div className="card-head">
              <h2>
                {result.label}: turns {result.startTurn}–{result.startTurn + result.horizon - 1}
              </h2>
              <span className="xs muted">rules agents · same seed · not saved</span>
            </div>
            {[a, b].map((branch) =>
              branch.rejections.length > 0 ? (
                <p key={branch.label} className="field-error">
                  {branch.label}: {branch.rejections.map((r) => r.reason).join('; ')}
                </p>
              ) : branch.bankruptAtTurn ? (
                <p key={branch.label} className="field-error">
                  ✕ {branch.label} runs out of cash in turn {branch.bankruptAtTurn}.
                </p>
              ) : null,
            )}
            {result.differences.length > 0 && (
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Differences between the two scenarios"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th className="right">{a.label}</th>
                      <th className="right">{b.label}</th>
                      <th>Trade-off</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METRIC_ROWS.map(({ metric, label, format }) => {
                      const d = result.differences.find((x) => x.metric === metric)!;
                      return (
                        <tr key={metric}>
                          <td>{label}</td>
                          <td className="right">{format(d.baseline)}</td>
                          <td className="right">{format(d.alternative)}</td>
                          <td className="secondary">{describe(d, format, b.label)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="xs muted mt-8">
              Differences only; which trade-off suits your startup is your call.
            </p>
          </section>
          <section className="card" aria-labelledby="compare-bars-title">
            <h2 id="compare-bars-title">Side by side</h2>
            <CompareBars
              key={`${result.startTurn}-${result.horizon}-${a.label}-${b.label}-${JSON.stringify(result.differences)}`}
              labels={[a.label, b.label]}
              colors={[SERIES[0], SERIES[1]]}
              pairs={METRIC_ROWS.map(({ metric, label, format }) => {
                const d = result.differences.find((x) => x.metric === metric)!;
                return { key: metric, label, a: d.baseline, b: d.alternative, format };
              })}
            />
          </section>
          {a.turns.length > 0 && b.turns.length > 0 && (
            <div className="grid-3">
              <LineChartCard
                title="Revenue"
                rows={rowsFor('revenue')}
                series={series}
                format={formatInrCompact}
                height={180}
              />
              <LineChartCard
                title="Profit"
                rows={rowsFor('profit')}
                series={series}
                format={formatInrCompact}
                height={180}
                zeroLine
              />
              <LineChartCard
                title="Cash"
                rows={rowsFor('cash')}
                series={series}
                format={formatInrCompact}
                height={180}
                zeroLine
              />
              <LineChartCard
                title="Customers"
                rows={rowsFor('customers')}
                series={series}
                format={(v) => formatCount(v)}
                height={180}
              />
              <LineChartCard
                title="Monthly churn"
                rows={rowsFor('churnRate')}
                series={series}
                format={(v) => formatPercent(v, 1)}
                height={180}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
