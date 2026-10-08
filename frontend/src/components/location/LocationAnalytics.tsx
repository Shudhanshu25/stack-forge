import type { SimulationAnalytics } from '@stackforge/shared';
import { formatChange, formatInrCompact, formatPercent } from '../../lib/format';
import { EmptyState } from '../feedback/States';
import { Term } from '../Term';
import { LocationProfileCard } from './LocationProfileCard';

type Impact = NonNullable<SimulationAnalytics['location']>;

const DEMAND_TEXT: Record<string, (factor: number) => string> = {
  marketSize: (f) =>
    f > 1 ? 'more customers nearby' : f < 1 ? 'fewer customers nearby' : 'no change',
  priceElasticity: (f) =>
    f < 1 ? 'customers mind price less' : f > 1 ? 'customers mind price more' : 'no change',
  competition: (f) =>
    f > 1 ? 'stronger local competitors' : f < 1 ? 'weaker local competitors' : 'no change',
};

/**
 * The analytics location panel: how much of the cost base and demand the location accounts
 * for, against the national baseline (every index 1.0).
 */
export function LocationAnalytics({ impact }: { impact: Impact | undefined }) {
  if (!impact) {
    return (
      <EmptyState title="No location information">
        This simulation&apos;s engine version predates locations, so its results carry no location
        effect.
      </EmptyState>
    );
  }
  const neutral = impact.profile.basis === 'NEUTRAL';
  const share = impact.monthlyCostBase ? impact.monthlyLocationCost / impact.monthlyCostBase : 0;
  const sign = impact.monthlyLocationCost > 0 ? '▲' : impact.monthlyLocationCost < 0 ? '▼' : '→';
  return (
    <div className="stack">
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">
            <Term k="location">Location</Term> cost this month
          </div>
          <div className="kpi-value">
            <span aria-hidden>{sign} </span>
            {formatChange('money', impact.monthlyLocationCost)}
          </div>
          <div className="xs muted">against the national baseline</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Share of the cost base</div>
          <div className="kpi-value">{formatPercent(share)}</div>
          <div className="xs muted">
            of {formatInrCompact(impact.monthlyCostBase)} spent this month
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Local demand weight</div>
          <div className="kpi-value">{Math.round(impact.localDemandWeight * 100)}%</div>
          <div className="xs muted">how much demand effects count for this industry</div>
        </div>
      </div>
      {neutral && (
        <p className="notice">
          This startup was created before locations existed, so it uses the national baseline: its
          costs and market are exactly as they were.
        </p>
      )}
      <div className="two-col">
        <section className="card" aria-labelledby="location-costs">
          <h2 id="location-costs">Costs this month</h2>
          {impact.costs.length === 0 ? (
            <p className="small muted">Play a turn to see what the location costs.</p>
          ) : (
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Location costs">
              <table>
                <thead>
                  <tr>
                    <th>Cost</th>
                    <th className="right">Here</th>
                    <th className="right">At baseline</th>
                    <th className="right">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {impact.costs.map((c) => (
                    <tr key={c.key}>
                      <td>
                        {c.label} <span className="xs muted num">×{c.factor.toFixed(2)}</span>
                      </td>
                      <td className="right">{formatInrCompact(c.actual)}</td>
                      <td className="right">{formatInrCompact(c.baseline)}</td>
                      <td className="right">{formatChange('money', c.actual - c.baseline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3>Demand</h3>
          <ul className="plain">
            {impact.demand.map((d) => (
              <li key={d.key}>
                <strong>{d.label}</strong> <span className="num">×{d.factor.toFixed(2)}</span>{' '}
                <span className="muted">
                  ({DEMAND_TEXT[d.key]?.(Number(d.factor.toFixed(4))) ?? ''})
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <LocationProfileCard
            profile={impact.profile}
            localDemandWeight={impact.localDemandWeight}
          />
        </section>
      </div>
    </div>
  );
}
