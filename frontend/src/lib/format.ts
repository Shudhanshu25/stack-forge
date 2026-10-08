import { formatCount, formatInrCompact, formatInrWhole } from './money';

export { formatCount, formatInrCompact, formatInrWhole };

/** 0.1234 -> "12.3%"; small non-zero shares keep enough digits to be visible (0.013%). */
export function formatPercent(rate: number | null | undefined, digits?: number): string {
  if (rate === null || rate === undefined) return '—';
  const d = digits ?? (rate !== 0 && Math.abs(rate) < 0.01 ? 3 : 1);
  return `${(rate * 100).toFixed(d)}%`;
}

export const formatMonths = (months: number | null) =>
  months === null ? '—' : `${months.toFixed(1)} mo`;

export const formatMaybeInr = (paise: number | null) =>
  paise === null ? '—' : formatInrCompact(paise);

export type MetricKind = 'money' | 'count' | 'rate';

export function formatMetric(kind: MetricKind, value: number | null): string {
  if (value === null) return '—';
  if (kind === 'money') return formatInrCompact(value);
  if (kind === 'rate') return formatPercent(value);
  return formatCount(Math.round(value));
}

/** "+₹12.3K", "-4", "+1.2 pts" for a change, or null when there is no previous value. */
export function formatChange(kind: MetricKind, change: number | null): string | null {
  if (change === null) return null;
  const sign = change > 0 ? '+' : change < 0 ? '-' : '±';
  const abs = Math.abs(change);
  if (kind === 'money') return `${sign}${formatInrCompact(abs)}`;
  if (kind === 'rate')
    return `${sign}${(abs * 100).toFixed(abs !== 0 && abs < 0.0001 ? 4 : 2)} pts`;
  return `${sign}${formatCount(Math.round(abs))}`;
}

/**
 * Whether a change is good news. Most metrics are better higher; churn is better lower.
 * Returns null for no change, so the UI shows a neutral delta.
 */
export function changeTone(change: number | null, higherIsBetter = true): 'good' | 'bad' | null {
  if (change === null || change === 0) return null;
  return change > 0 === higherIsBetter ? 'good' : 'bad';
}
