import { useState, type CSSProperties, type ReactNode } from 'react';
import type { SeriesSpec } from './theme';

type Row = Record<string, number | string | null>;

/** CSS custom property for a series colour (legend swatch, tooltip dot). */
export const swatch = (color: string | undefined) => ({ '--swatch': color }) as CSSProperties;

/**
 * A chart in a card with a legend and a table-view twin, so no value is reachable only by
 * hovering or only through colour.
 */
export function ChartCard({
  title,
  subtitle,
  series,
  rows,
  xKey = 'turn',
  xLabel = 'Turn',
  format,
  children,
  actions,
  className,
  dataTour,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  series: SeriesSpec[];
  rows: Row[];
  xKey?: string;
  xLabel?: string;
  format: (value: number) => string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  dataTour?: string;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className={`card ${className ?? ''}`} data-tour={dataTour}>
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <div className="xs muted">{subtitle}</div>}
        </div>
        <div className="actions flush">
          {actions}
          <button
            type="button"
            className="toggle"
            onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
            aria-pressed={view === 'table'}
          >
            {view === 'chart' ? 'Table' : 'Chart'}
          </button>
        </div>
      </div>
      {series.length > 1 && view === 'chart' && (
        <div className="chart-legend" aria-hidden>
          {series.map((s) => (
            <span key={s.key}>
              <span className={`swatch ${s.dashed ? 'dashed' : ''}`} style={swatch(s.color)} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div key={view} className="chart-view">
        {view === 'chart' ? (
          children
        ) : (
          <div
            className="table-wrap chart-table"
            tabIndex={0}
            role="region"
            aria-label={typeof title === 'string' ? `${title}: data table` : 'Chart data table'}
          >
            <table>
              <thead>
                <tr>
                  <th>{xLabel}</th>
                  {series.map((s) => (
                    <th key={s.key} className="right">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td>{row[xKey]}</td>
                    {series.map((s) => {
                      const v = row[s.key];
                      return (
                        <td key={s.key} className="right">
                          {typeof v === 'number' ? format(v) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
