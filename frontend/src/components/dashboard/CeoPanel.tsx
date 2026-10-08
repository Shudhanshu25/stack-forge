import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { AdviceMode, AIAdvice, SimulationTurn } from '@stackforge/shared';
import { ApiError } from '../../api/client';
import { simulationApi } from '../../api/endpoints';
import { useCommandSource } from '../../commands/registry';
import { EmptyState, ErrorState, Spinner } from '../feedback/States';

export const ADVICE_MODES: { value: AdviceMode; label: string; placeholder: string }[] = [
  { value: 'EXPLAIN', label: 'Explain', placeholder: 'Why did my profit decrease?' },
  { value: 'ANALYZE', label: 'Analyze', placeholder: "What caused this month's performance?" },
  {
    value: 'SCENARIO',
    label: 'Scenario',
    placeholder: 'What should I consider before increasing marketing?',
  },
];

/**
 * The AI CEO could not answer (no LLM key, daily quota used up, provider down). Says what
 * would appear and offers the one action that can fill it: asking again.
 */
function AdvisorUnavailable({ reason, onRetry }: { reason?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      card={false}
      headingLevel={3}
      title="AI CEO unavailable"
      action={
        onRetry ? (
          <button type="button" onClick={onRetry}>
            Ask again
          </button>
        ) : (
          <Link to="/account" className="button">
            See today&apos;s AI usage
          </Link>
        )
      }
    >
      {reason ? `${reason}. ` : ''}When it is available, its analysis of your results appears here:
      what is working, what is not, the key risk and a recommendation.
    </EmptyState>
  );
}

export function AdviceView({ advice, onRetry }: { advice: AIAdvice; onRetry?: () => void }) {
  if (!advice.available) {
    return <AdvisorUnavailable reason={advice.unavailableReason} onRetry={onRetry} />;
  }
  return (
    <div className="advice">
      <p>{advice.summary}</p>
      {advice.positiveFactors.length > 0 && (
        <>
          <h3>Working</h3>
          <ul className="plain">
            {advice.positiveFactors.map((f) => (
              <li key={f}>▲ {f}</li>
            ))}
          </ul>
        </>
      )}
      {advice.negativeFactors.length > 0 && (
        <>
          <h3>Not working</h3>
          <ul className="plain">
            {advice.negativeFactors.map((f) => (
              <li key={f}>▼ {f}</li>
            ))}
          </ul>
        </>
      )}
      <h3>Key risk</h3>
      <p>{advice.keyRisk}</p>
      <h3>Key opportunity</h3>
      <p>{advice.keyOpportunity}</p>
      <h3>Recommendation</h3>
      <p>{advice.recommendation}</p>
      <p className="xs muted">
        {advice.reasoning} · confidence {Math.round(advice.confidence * 100)}%
      </p>
    </div>
  );
}

/** The AI CEO side panel: the latest turn's analysis, and questions in three modes. */
export function CeoPanel({
  simulationId,
  latest,
  turnsError,
  onRetryTurns,
}: {
  simulationId: string;
  latest: SimulationTurn | null;
  turnsError?: string | null;
  onRetryTurns?: () => void;
}) {
  const [mode, setMode] = useState<AdviceMode>('EXPLAIN');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AIAdvice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const current = ADVICE_MODES.find((m) => m.value === mode)!;

  async function ask(askMode: AdviceMode = mode) {
    setBusy(true);
    setError(null);
    try {
      const q = question.trim();
      setAnswer(
        await simulationApi.advise(simulationId, { mode: askMode, ...(q ? { question: q } : {}) }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The AI CEO could not answer');
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask();
  }

  useCommandSource(
    'ceo-panel',
    ADVICE_MODES.map((m) => ({
      id: `ceo.${m.value.toLowerCase()}`,
      group: 'AI CEO' as const,
      label: `Ask the AI CEO: ${m.label}`,
      keywords: `advisor advice question ${m.placeholder}`,
      disabledReason: !latest
        ? 'Play a turn first; the AI CEO interprets computed results'
        : busy
          ? 'The AI CEO is already answering'
          : null,
      run: () => {
        setMode(m.value);
        panel.current?.scrollIntoView({ block: 'nearest' });
        void ask(m.value);
      },
    })),
  );

  let body;
  if (turnsError) {
    body = (
      <ErrorState
        card={false}
        title="The latest analysis could not be loaded"
        message={turnsError}
        onRetry={onRetryTurns}
      />
    );
  } else if (answer) {
    body = (
      <>
        <h3>{current.label}</h3>
        <AdviceView advice={answer} onRetry={() => void ask()} />
      </>
    );
  } else if (latest?.advice) {
    body = (
      <>
        <h3>Turn {latest.turnNumber} analysis</h3>
        <AdviceView advice={latest.advice} onRetry={() => void ask('ANALYZE')} />
      </>
    );
  } else if (latest) {
    // The turn ran without an analysis (rules mode, no LLM key, quota or provider down).
    body = (
      <AdvisorUnavailable
        reason={`No analysis was produced for turn ${latest.turnNumber}`}
        onRetry={() => void ask('ANALYZE')}
      />
    );
  } else {
    body = <p className="small muted">Play a turn and the AI CEO will analyse it here.</p>;
  }

  return (
    <section className="card" data-tour="ceo" ref={panel} aria-labelledby="ceo-title">
      <h2 id="ceo-title">AI CEO</h2>
      <div className="segmented" role="tablist" aria-label="Advice mode">
        {ADVICE_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            className={mode === m.value ? 'active' : ''}
            onClick={() => {
              setMode(m.value);
              setAnswer(null);
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <form className="ask-row" onSubmit={submit}>
        <input
          aria-label="Question"
          maxLength={500}
          placeholder={current.placeholder}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={!latest}
        />
        <button className="primary" disabled={busy || !latest}>
          {busy && <Spinner />}
          {busy ? 'Asking' : 'Ask'}
        </button>
      </form>
      {error && (
        <div className="mt-12">
          <ErrorState
            card={false}
            title="The AI CEO could not answer"
            message={error}
            onRetry={() => void ask()}
          />
        </div>
      )}
      <div className="mt-12">{body}</div>
      <p className="xs muted mt-8">
        The AI CEO only interprets results the engine computed, and may cite only figures from them.
      </p>
    </section>
  );
}
