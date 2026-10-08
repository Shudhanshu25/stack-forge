import type { LocationProfile } from '@stackforge/shared';

type IndexKey = keyof LocationProfile['indices'];

/** How each index reads in plain language, from the founder's point of view. */
const PLAIN: {
  key: IndexKey;
  label: string;
  high: string;
  low: string;
  /** Whether a higher value helps the startup (salaries and rent do not). */
  higherHelps: boolean;
  note?: string;
}[] = [
  { key: 'salaryIndex', label: 'Salaries', high: 'high', low: 'low', higherHelps: false },
  {
    key: 'operatingCostIndex',
    label: 'Rent and overheads',
    high: 'high',
    low: 'low',
    higherHelps: false,
  },
  {
    key: 'regulatoryBurden',
    label: 'State compliance',
    high: 'heavy',
    low: 'light',
    higherHelps: false,
  },
  {
    key: 'talentAvailability',
    label: 'Talent',
    high: 'easy to hire',
    low: 'hard to hire',
    higherHelps: true,
  },
  {
    key: 'purchasingPower',
    label: "Customers' spending power",
    high: 'high',
    low: 'low',
    higherHelps: true,
  },
  { key: 'localMarketSize', label: 'Local market', high: 'large', low: 'small', higherHelps: true },
  {
    key: 'competitionDensity',
    label: 'Local competition',
    high: 'strong',
    low: 'light',
    higherHelps: false,
  },
  { key: 'infrastructure', label: 'Infrastructure', high: 'good', low: 'weak', higherHelps: true },
  {
    key: 'fundingAccess',
    label: 'Investor access',
    high: 'good',
    low: 'limited',
    higherHelps: true,
    note: 'not used by the simulation yet',
  },
];

/** Within this distance of 1.0 an index reads as "near the national average". */
export const NEAR_BASELINE = 0.08;

export function describeIndex(value: number, high: string, low: string): string {
  if (value >= 1 + NEAR_BASELINE) return high;
  if (value <= 1 - NEAR_BASELINE) return low;
  return 'near the national average';
}

/**
 * A location's indices in plain language ("Salaries: high"), each against the national
 * baseline, with estimates labelled and the sources a click away.
 */
export function LocationProfileCard({
  profile,
  localDemandWeight,
  industryName,
}: {
  profile: LocationProfile;
  localDemandWeight?: number;
  industryName?: string;
}) {
  const place =
    profile.basis === 'NEUTRAL'
      ? 'National baseline'
      : [profile.city, profile.stateName].filter(Boolean).join(', ');
  return (
    <section className="location-card" aria-label={`Location profile: ${place}`}>
      <div className="card-head">
        <h2>{place}</h2>
        <span className="xs muted">
          {profile.basis === 'LISTED_CITY'
            ? 'Listed city'
            : profile.basis === 'STATE_AND_TIER'
              ? "State values with typical figures for the city's size"
              : 'No location effect'}
        </span>
      </div>
      <ul className="location-indices">
        {PLAIN.map(({ key, label, high, low, higherHelps, note }) => {
          const index = profile.indices[key];
          const reading = describeIndex(index.value, high, low);
          const tone =
            reading === 'near the national average'
              ? 'neutral'
              : index.value > 1 === higherHelps
                ? 'good'
                : 'bad';
          return (
            <li key={key}>
              <span className="location-label">{label}</span>
              <span className={`location-reading ${tone}`}>
                {reading}
                <span className="xs muted num"> ×{index.value.toFixed(2)}</span>
              </span>
              {(index.isEstimate || note) && (
                <span className="xs muted location-flags">
                  {index.isEstimate && <span className="badge">estimate</span>}
                  {note && <span>{note}</span>}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {localDemandWeight !== undefined && (
        <p className="xs muted">
          Costs apply in full to every business. Demand effects (market, spending power,
          competition) count {Math.round(localDemandWeight * 100)}%
          {industryName ? ` for ${industryName}` : ''}, because that is how local its customers are.
        </p>
      )}
      <details className="xs">
        <summary>Sources</summary>
        <ul className="plain location-sources">
          {PLAIN.map(({ key, label }) => (
            <li key={key}>
              <strong>{label}:</strong> {profile.indices[key].source}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
