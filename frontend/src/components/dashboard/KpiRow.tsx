import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Kpi, Kpis } from '@stackforge/shared';
import { changeTone, formatChange, formatMetric, type MetricKind } from '../../lib/format';
import { useCountUp } from '../../lib/motion';
import { Term } from '../Term';

const KPIS: { key: keyof Kpis; label: ReactNode; kind: MetricKind; higherIsBetter: boolean }[] = [
  { key: 'cash', label: 'Cash', kind: 'money', higherIsBetter: true },
  { key: 'revenue', label: 'Revenue', kind: 'money', higherIsBetter: true },
  { key: 'profit', label: 'Profit', kind: 'money', higherIsBetter: true },
  { key: 'customers', label: 'Customers', kind: 'count', higherIsBetter: true },
  { key: 'churnRate', label: <Term k="churn">Churn</Term>, kind: 'rate', higherIsBetter: false },
  {
    key: 'marketShare',
    label: <Term k="marketShare">Market share</Term>,
    kind: 'rate',
    higherIsBetter: true,
  },
];

/** How many times `value` has changed since the first render (keys the highlight). */
function useChanged(value: unknown): number {
  const first = useRef(true);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setCount((c) => c + 1);
  }, [value]);
  return count;
}

/**
 * A KPI tile: value, and its change since last turn with an arrow, sign, words and tone. When
 * a turn completes the value counts from the old figure to the new one and the change
 * indicator briefly highlights; both are instant under reduced motion.
 */
export function KpiTile({
  label,
  kpi,
  kind,
  higherIsBetter = true,
}: {
  label: ReactNode;
  kpi: Kpi;
  kind: MetricKind;
  higherIsBetter?: boolean;
}) {
  const shown = useCountUp(kpi.value);
  const changes = useChanged(kpi.value);
  const change = formatChange(kind, kpi.change);
  const tone = changeTone(kpi.change, higherIsBetter);
  const arrow = kpi.change === null || kpi.change === 0 ? '→' : kpi.change > 0 ? '▲' : '▼';
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {/* Screen readers get the final figure, not the intermediate frames. */}
        <span aria-hidden>{formatMetric(kind, shown)}</span>
        <span className="sr-only">{formatMetric(kind, kpi.value)}</span>
      </div>
      <div key={changes} className={`delta ${tone ?? ''} ${changes > 0 && tone ? 'flash' : ''}`}>
        {change === null ? (
          <span className="muted">no previous turn</span>
        ) : (
          <>
            <span aria-hidden>{arrow}</span>
            <span>{change}</span>
            <span className="muted">vs last turn</span>
          </>
        )}
      </div>
    </div>
  );
}

export function KpiRow({ kpis }: { kpis: Kpis }) {
  return (
    <div className="kpis" data-tour="analyze">
      {KPIS.map((k) => (
        <KpiTile
          key={k.key}
          label={k.label}
          kpi={kpis[k.key]}
          kind={k.kind}
          higherIsBetter={k.higherIsBetter}
        />
      ))}
    </div>
  );
}
