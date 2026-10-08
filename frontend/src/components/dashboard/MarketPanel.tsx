import type { AgentOutput, MarketSnapshot, SimulationTurn } from '@stackforge/shared';
import { changeTone, formatCount, formatInrWhole, formatPercent } from '../../lib/format';

const SOURCE: Record<AgentOutput['source'], string> = {
  rules: 'rules',
  llm: 'LLM',
  rules_fallback: 'rules, LLM fallback',
};

function Meter({
  label,
  value,
  change,
  higherIsBetter,
}: {
  label: string;
  value: number;
  change: number | null;
  higherIsBetter: boolean;
}) {
  const tone = changeTone(change, higherIsBetter);
  return (
    <div>
      <div className="stat-row">
        <span className="secondary">{label}</span>
        <strong>{formatPercent(value)}</strong>
      </div>
      <div className="meter" aria-hidden>
        <span style={{ '--fill': Math.max(0, Math.min(1, value)) } as React.CSSProperties} />
      </div>
      {change !== null && change !== 0 && (
        <div className={`delta ${tone ?? ''}`}>
          {change > 0 ? '▲' : '▼'} {(Math.abs(change) * 100).toFixed(1)} pts vs last turn
        </div>
      )}
    </div>
  );
}

/** Customer sentiment, competitor pressure, market demand, events, forecast and agent views. */
export function MarketPanel({
  market,
  latest,
}: {
  market: MarketSnapshot;
  latest: SimulationTurn | null;
}) {
  const demandLabel = (index: number) =>
    index > 1.02 ? 'above normal' : index < 0.98 ? 'below normal' : 'normal';
  const forecast = latest?.forecast;
  return (
    <section className="card">
      <h2>Market</h2>
      <div className="stat-list">
        <Meter
          label="Customer sentiment"
          value={market.customerSentiment}
          change={market.sentimentChange}
          higherIsBetter
        />
        <Meter
          label="Competitor pressure"
          value={market.competitorPressure}
          change={market.pressureChange}
          higherIsBetter={false}
        />
        <div>
          <div className="stat-row">
            <span className="secondary">Market demand</span>
            <strong>{market.demandIndex.toFixed(2)}×</strong>
          </div>
          <div className="xs muted">
            {demandLabel(market.demandIndex)} this turn (seasonality and events); next turn starts
            at {market.demandIndexNext.toFixed(2)}×
          </div>
        </div>
      </div>

      <h3>Active events</h3>
      {market.activeEvents.length === 0 ? (
        <p className="small muted">None</p>
      ) : (
        <ul className="plain">
          {market.activeEvents.map((e) => (
            <li key={e.type} className={`polarity-${e.polarity}`}>
              {' '}
              {e.title}{' '}
              <span className="muted">
                · {e.turnsLeft} more turn{e.turnsLeft === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3>Forecast for next turn</h3>
      {forecast?.available ? (
        <p className="small">
          Revenue {formatInrWhole(forecast.revenue ?? 0)} · {formatCount(forecast.customers ?? 0)}{' '}
          customers · churn {formatPercent(forecast.churnRate ?? 0)}
          <br />
          <span className="xs muted">
            ML estimate if decisions stay the same ({forecast.modelVersion})
          </span>
        </p>
      ) : (
        <p className="small muted">
          {forecast?.unavailableReason ?? 'Available after the first turn.'}
        </p>
      )}

      {latest && (
        <>
          <h3>How the market reacted</h3>
          <ul className="plain">
            <li>
              <strong>Customers</strong>{' '}
              <span className="muted">({SOURCE[latest.agentEffects.customer.source]})</span>:{' '}
              {latest.agentEffects.customer.reasoningSummary}
              {latest.agentEffects.customer.fallbackReason && (
                <span className="xs muted"> ({latest.agentEffects.customer.fallbackReason})</span>
              )}
            </li>
            <li>
              <strong>Competitors</strong>{' '}
              <span className="muted">({SOURCE[latest.agentEffects.competitor.source]})</span>:{' '}
              {latest.agentEffects.competitor.reasoningSummary}
              {latest.agentEffects.competitor.fallbackReason && (
                <span className="xs muted"> ({latest.agentEffects.competitor.fallbackReason})</span>
              )}
            </li>
            {latest.competitorActions
              .filter((a) => a.action !== 'NONE')
              .map((a) => (
                <li key={a.competitorId}>
                  {latest.stateAfter.competitors.find((c) => c.id === a.competitorId)?.name}:{' '}
                  {a.reason.toLowerCase()}
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}
