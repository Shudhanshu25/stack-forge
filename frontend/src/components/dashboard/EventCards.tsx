import { useState } from 'react';
import type { MarketSnapshot, SimulationTurn } from '@stackforge/shared';

const ICON = { POSITIVE: '▲', NEGATIVE: '▼', NEUTRAL: '●' } as const;
const WORD = { POSITIVE: 'Good news', NEGATIVE: 'Bad news', NEUTRAL: 'Market news' } as const;

const storageKey = (simulationId: string) => `sf-dismissed-events-${simulationId}`;

function readDismissed(simulationId: string): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(simulationId)) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/**
 * A card for each market event that fired in the latest turn. Cards slide in, can be
 * dismissed (remembered for this browser session), and show how many turns the event still
 * runs; active events also stay listed in the market panel after their card is dismissed.
 */
export function EventCards({
  simulationId,
  latest,
  market,
}: {
  simulationId: string;
  latest: SimulationTurn | null;
  market: MarketSnapshot | null;
}) {
  const [dismissed, setDismissed] = useState(() => readDismissed(simulationId));
  if (!latest) return null;
  const id = (type: string) => `${latest.turnNumber}:${type}`;
  const cards = latest.events.filter((e) => !dismissed.includes(id(e.type)));
  if (cards.length === 0) return null;

  function dismiss(type: string) {
    const next = [...dismissed, id(type)];
    setDismissed(next);
    try {
      sessionStorage.setItem(storageKey(simulationId), JSON.stringify(next));
    } catch {
      // Storage unavailable: the card stays dismissed until the page reloads.
    }
  }

  return (
    <section className="event-cards" aria-label={`Market events in turn ${latest.turnNumber}`}>
      {cards.map((e) => {
        const title = e.title ?? e.type.replaceAll('_', ' ').toLowerCase();
        const active = market?.activeEvents.find((a) => a.type === e.type);
        return (
          <article key={e.type} className={`event-card ${e.polarity}`}>
            <span className="event-icon" aria-hidden>
              {ICON[e.polarity]}
            </span>
            <div>
              <strong>
                <span className="sr-only">{WORD[e.polarity]}: </span>
                {title}
              </strong>
              {e.description && <p>{e.description}</p>}
              <p className="xs muted">
                Started in turn {latest.turnNumber}
                {active
                  ? ` · ${active.turnsLeft} more turn${active.turnsLeft === 1 ? '' : 's'}`
                  : e.duration > 1
                    ? ` · lasts ${e.duration} turns`
                    : ' · this turn only'}
              </p>
            </div>
            <button
              type="button"
              className="link"
              onClick={() => dismiss(e.type)}
              aria-label={`Dismiss ${title}`}
            >
              Dismiss
            </button>
          </article>
        );
      })}
    </section>
  );
}
