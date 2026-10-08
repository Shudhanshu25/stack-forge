import { swatch } from './ChartCard';

export interface ComparePair {
  key: string;
  label: string;
  a: number;
  b: number;
  format: (v: number) => string;
}

/**
 * The two branches side by side, one pair of bars per metric, growing from zero when results
 * arrive (transform only; instant under reduced motion). Bars are drawn from a zero line, so
 * negative values (a loss) grow the other way; every value is also written out with its sign
 * and the branch name, so neither colour nor direction carries meaning alone.
 */
export function CompareBars({
  pairs,
  labels,
  colors,
}: {
  pairs: ComparePair[];
  labels: [string, string];
  colors: [string, string];
}) {
  return (
    <div className="compare-bars">
      {pairs.map((p) => {
        const values = [p.a, p.b];
        const max = Math.max(...values.map(Math.abs)) || 1;
        const hasNegative = values.some((v) => v < 0);
        const zero = hasNegative ? 50 : 0;
        const span = hasNegative ? 50 : 100;
        return (
          <div key={p.key} className="compare-metric" role="group" aria-label={p.label}>
            <h3>{p.label}</h3>
            {values.map((v, i) => {
              const width = (Math.abs(v) / max) * span;
              const left = v < 0 ? zero - width : zero;
              return (
                <div key={i} className="compare-row">
                  <span className="secondary">{labels[i]}</span>
                  <span className="compare-track" aria-hidden>
                    {hasNegative && <span className="zero" style={{ left: '50%' }} />}
                    <span
                      className={`compare-bar ${v < 0 ? 'from-right' : 'from-left'}`}
                      style={{ ...swatch(colors[i]), left: `${left}%`, width: `${width}%` }}
                    />
                  </span>
                  <span className="num right">{p.format(v)}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
