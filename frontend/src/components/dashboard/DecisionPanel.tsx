import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DecisionPreview, Simulation } from '@stackforge/shared';
import { ApiError } from '../../api/client';
import { simulationApi } from '../../api/endpoints';
import { useCommandSource } from '../../commands/registry';
import type { TurnRunner } from '../../hooks/useSimulation';
import { formatInrWhole } from '../../lib/format';
import {
  DECISION_LABELS,
  METRIC_LABELS,
  STAGE_LABELS,
  formFromState,
  pipelineSteps,
  toDecisions,
  type DecisionForm,
} from '../../lib/play';
import { useTour, type TourStepId } from '../../onboarding/Onboarding';
import { Field } from '../Field';
import { Spinner } from '../feedback/States';

/** Why a turn cannot be played right now, or null when it can. */
export function turnBlockedReason(simulation: Simulation, running: boolean): string | null {
  if (simulation.status === 'BANKRUPT') return 'The startup is bankrupt';
  if (simulation.status !== 'ACTIVE') return `The simulation is ${simulation.status.toLowerCase()}`;
  if (running) return 'A turn is already running';
  return null;
}

/** The live pipeline: ticks off each stage as its WebSocket event arrives. */
function PipelineChecklist({ runner }: { runner: TurnRunner }) {
  const job = runner.job!;
  const steps = pipelineSteps(runner.stages, job.status);
  const active = steps.find((s) => s.state === 'active');
  return (
    <div className="mt-12">
      <div className="stat-row">
        <strong>
          Turn {job.turnNumber}: {job.status.toLowerCase()}
        </strong>
        {runner.running && (
          <button type="button" className="link" onClick={() => void runner.cancel()}>
            Cancel
          </button>
        )}
      </div>
      <progress max={100} value={job.progress} aria-label="Turn progress" />
      <ol className="pipeline" aria-label="Turn pipeline">
        {steps.map(({ stage, state }) => (
          <li key={stage} className={state}>
            <span className="mark" aria-hidden>
              {state === 'done' ? '✓' : ''}
            </span>
            <span>
              {STAGE_LABELS[stage]}
              <span className="sr-only">
                {state === 'done' ? ', done' : state === 'active' ? ', in progress' : ', waiting'}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        {active ? `${STAGE_LABELS[active.stage]}…` : runner.running ? 'Queued' : ''}
      </p>
    </div>
  );
}

/** Pricing, marketing, hiring and product decisions, with preview and live turn progress. */
export function DecisionPanel({
  simulation,
  runner,
}: {
  simulation: Simulation;
  runner: TurnRunner;
}) {
  const state = simulation.currentState;
  const tour = useTour();
  const [form, setForm] = useState<DecisionForm>(() => formFromState(state));
  const [preview, setPreview] = useState<DecisionPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const playButton = useRef<HTMLButtonElement>(null);

  // A new turn resets the form to the new state.
  useEffect(() => {
    setForm(formFromState(simulation.currentState));
    setPreview(null);
  }, [simulation.currentState]);

  const blocked = turnBlockedReason(simulation, runner.running);
  const playable = blocked === null;
  const update =
    (key: keyof DecisionForm, step?: TourStepId) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm({ ...form, [key]: e.target.value === '' ? 0 : Number(e.target.value) });
      setPreview(null);
      if (step) tour.advance(step);
    };

  async function runPreview() {
    setError(null);
    setPreviewing(true);
    try {
      setPreview(await simulationApi.preview(simulation.id, toDecisions(form, state)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  }

  async function play() {
    setPreview(null);
    await runner.play(toDecisions(form, state));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void play();
  }

  useCommandSource('decision-panel', [
    {
      id: 'turn.submit',
      group: 'Simulation',
      label: `Submit turn ${state.turn + 1}`,
      keywords: 'play turn next month decisions',
      disabledReason: blocked,
      run: () => {
        playButton.current?.scrollIntoView({ block: 'nearest' });
        void play();
      },
    },
  ]);

  return (
    <form className="card" onSubmit={submit} aria-labelledby="decisions-title">
      <div className="card-head">
        <h2 id="decisions-title">Decisions for turn {state.turn + 1}</h2>
        <span className="xs muted">current price {formatInrWhole(state.price)}</span>
      </div>
      <div className="decision-grid">
        <div data-tour="pricing">
          <Field label="Price (₹)">
            <input
              type="number"
              min={1}
              step="any"
              value={form.priceRupees || ''}
              onChange={update('priceRupees', 'pricing')}
            />
          </Field>
        </div>
        <div data-tour="marketing">
          <Field label="Marketing / month (₹)">
            <input
              type="number"
              min={0}
              step="any"
              value={form.marketingRupees}
              onChange={update('marketingRupees', 'marketing')}
            />
          </Field>
        </div>
        <div data-tour="hiring">
          <Field label="Employees" hint="Reducing headcount isn't available yet.">
            <input
              type="number"
              min={state.employees}
              step={1}
              value={form.employees}
              onChange={update('employees', 'hiring')}
            />
          </Field>
        </div>
        <div>
          <Field label="Product investment (₹)" hint="One-off, this turn only.">
            <input
              type="number"
              min={0}
              step="any"
              value={form.productInvestmentRupees}
              onChange={update('productInvestmentRupees')}
            />
          </Field>
        </div>
      </div>
      <div className="actions">
        <button type="button" onClick={() => void runPreview()} disabled={!playable || previewing}>
          {previewing && <Spinner />}
          Preview
        </button>
        <button className="primary" disabled={!playable} data-tour="play" ref={playButton}>
          {runner.running && <Spinner />}
          Play turn
        </button>
      </div>
      {simulation.status === 'BANKRUPT' && (
        <p className="field-error">
          ✕ The startup ran out of cash. No further turns can be played.
        </p>
      )}
      {(error ?? runner.error) && (
        <p className="field-error" role="alert">
          {error ?? runner.error}
        </p>
      )}

      {runner.job && <PipelineChecklist runner={runner} />}

      {preview && (
        <div className="mt-12">
          <h3>{preview.label}</h3>
          <p className="xs muted">
            Direction and rough size against changing nothing, rules agents.
          </p>
          {preview.decisionResults.map((r, i) => {
            const moved = r.effects.filter((e) => e.direction !== 'FLAT');
            return (
              <div key={i} className="small preview-row">
                <strong>{DECISION_LABELS[r.decision.type]}</strong>{' '}
                {r.status === 'REJECTED' ? (
                  <span className="field-error">rejected: {r.rejection?.reason}</span>
                ) : moved.length === 0 ? (
                  <span className="muted">no noticeable effect</span>
                ) : (
                  <span className="chips inline">
                    {moved.map((e) => (
                      <span key={e.metric} className="chip">
                        {e.direction === 'UP' ? '▲' : '▼'} {METRIC_LABELS[e.metric] ?? e.metric}{' '}
                        <span className="muted">{e.magnitude.toLowerCase()}</span>
                      </span>
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </form>
  );
}
