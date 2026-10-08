import { Link } from 'react-router-dom';
import { EmptyState, ErrorState } from '../components/feedback/States';
import { formatCount, formatInrCompact, formatPercent } from '../lib/format';
import { DECISION_LABELS } from '../lib/play';
import { useSimulationContext } from './SimulationLayout';

/** Turn timeline, newest first: decisions, outcomes, events, competitor moves and analysis. */
export function TimelinePage() {
  const { simulation, turns, turnsError, reload } = useSimulationContext();
  if (turnsError) {
    return (
      <ErrorState
        title="The turn history could not be loaded"
        message={turnsError}
        onRetry={() => void reload()}
      />
    );
  }
  if (turns.length === 0) {
    return (
      <EmptyState
        title="No turns yet"
        action={
          <Link to={`/simulations/${simulation.id}`} className="button primary">
            Play your first turn
          </Link>
        }
      >
        Every month you play is recorded here, newest first: your decisions, the results, market
        events, how customers and competitors reacted, and the AI CEO&apos;s analysis.
      </EmptyState>
    );
  }
  return (
    <ol className="timeline plain">
      {[...turns].reverse().map((t) => {
        const s = t.stateAfter;
        const names = new Map(s.competitors.map((c) => [c.id, c.name]));
        const moves = t.competitorActions.filter((a) => a.action !== 'NONE');
        return (
          <li key={t.turnNumber} className="card">
            <div className="card-head">
              <span className="turn-no">Turn {t.turnNumber}</span>
              <span className="small secondary num">
                Revenue {formatInrCompact(s.revenue)} · Profit {formatInrCompact(s.profit)} · Cash{' '}
                {formatInrCompact(s.cash)} · {formatCount(s.customers)} customers (+{s.newCustomers}{' '}
                / −{s.churnedCustomers}) · share {formatPercent(s.marketShare)}
              </span>
            </div>
            <div className="grid-3">
              <div>
                <h3>Decisions</h3>
                {t.decisions.length === 0 ? (
                  <p className="small muted">No changes</p>
                ) : (
                  <div className="chips">
                    {t.decisions.map((d) => (
                      <span key={d.type} className="chip">
                        {DECISION_LABELS[d.type]}{' '}
                        {d.type === 'HIRING' ? d.value : formatInrCompact(d.value)}
                      </span>
                    ))}
                  </div>
                )}
                <h3>Events</h3>
                {t.events.length === 0 ? (
                  <p className="small muted">None started</p>
                ) : (
                  <ul className="plain">
                    {t.events.map((e) => (
                      <li key={e.type} className={`polarity-${e.polarity}`}>
                        {' '}
                        {e.title ?? e.type} <span className="muted">· {e.description}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3>Market reaction</h3>
                <ul className="plain">
                  <li>
                    <strong>Customers:</strong> {t.agentEffects.customer.reasoningSummary}
                  </li>
                  <li>
                    <strong>Competitors:</strong> {t.agentEffects.competitor.reasoningSummary}
                  </li>
                  {moves.map((a) => (
                    <li key={a.competitorId}>
                      {names.get(a.competitorId)}: {a.reason.toLowerCase()}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>AI CEO</h3>
                <p className="small">
                  {t.advice?.available ? (
                    t.advice.summary
                  ) : (
                    <span className="muted">{t.advice?.unavailableReason ?? 'No analysis'}</span>
                  )}
                </p>
                {t.forecast?.available && (
                  <p className="xs muted">
                    Forecast for turn {t.forecast.targetTurn}: revenue{' '}
                    {formatInrCompact(t.forecast.revenue ?? 0)},{' '}
                    {formatCount(t.forecast.customers ?? 0)} customers
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
