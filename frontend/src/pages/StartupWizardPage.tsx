import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Industry } from '@stackforge/shared';
import { ApiError } from '../api/client';
import { simulationApi, startupApi } from '../api/endpoints';
import { useTour } from '../onboarding/Onboarding';
import { FormError } from '../components/Field';
import { StartupFields } from '../components/StartupFields';
import { useTemplates } from '../hooks/useTemplates';
import { BUSINESS_MODEL_LABELS, DIFFICULTY_LABELS } from '../lib/enums';
import { formatCount, formatInr, rupeesToPaise } from '../lib/money';
import {
  STEPS,
  STEP_TITLES,
  applyTemplateDefaults,
  emptyForm,
  formatLocation,
  toCreateRequest,
  validateAll,
  validateStep,
  type FormErrors,
  type StartupForm,
} from '../lib/wizard';

export function StartupWizardPage() {
  const navigate = useNavigate();
  const tour = useTour();
  const { templates, error: templateError } = useTemplates();
  const [index, setIndex] = useState(0);
  const [form, setForm] = useState<StartupForm>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const step = STEPS[index]!;
  const isLast = index === STEPS.length - 1;

  function chooseIndustry(industry: Industry) {
    const template = templates.find((t) => t.industry === industry);
    // Choosing an industry pre-fills its typical economics; later steps can override them.
    setForm(template ? applyTemplateDefaults(form, template) : { ...form, industry });
  }

  async function next(e: FormEvent) {
    e.preventDefault();
    const stepErrors = validateStep(step, form);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    if (!isLast) {
      setIndex(index + 1);
      return;
    }
    const allErrors = validateAll(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      setIndex(STEPS.findIndex((s) => Object.keys(validateStep(s, form)).length > 0));
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      const startup = await startupApi.create(toCreateRequest(form));
      if (tour.stepId === 'create') {
        // Onboarding continues on the new startup's dashboard.
        const simulation = await simulationApi.start(startup.id);
        tour.advance('create');
        navigate(`/simulations/${simulation.id}`);
      } else {
        navigate('/startups');
      }
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not create startup');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card wizard" onSubmit={next} data-tour="wizard">
      <p className="muted">
        Step {index + 1} of {STEPS.length}
      </p>
      <ol className="progress" aria-hidden>
        {STEPS.map((s, i) => (
          <li key={s} className={i <= index ? 'done' : ''} />
        ))}
      </ol>
      <h1>{STEP_TITLES[step]}</h1>
      <FormError message={templateError ?? submitError} />

      <StartupFields
        step={step}
        form={form}
        errors={errors}
        templates={templates}
        onChange={setForm}
        onIndustry={chooseIndustry}
      />

      {isLast && form.industry && form.businessModel && (
        <dl className="facts summary">
          <dt>Startup</dt>
          <dd>{form.name}</dd>
          <dt>Industry</dt>
          <dd>
            {templates.find((t) => t.industry === form.industry)?.displayName ?? form.industry}
          </dd>
          <dt>Location</dt>
          <dd>{formatLocation(form)}</dd>
          <dt>Model</dt>
          <dd>{BUSINESS_MODEL_LABELS[form.businessModel]}</dd>
          <dt>Capital</dt>
          <dd>{formatInr(rupeesToPaise(form.initialCapitalRupees))}</dd>
          <dt>Product</dt>
          <dd>{form.productName}</dd>
          <dt>Price</dt>
          <dd>{formatInr(rupeesToPaise(form.initialPriceRupees))}</dd>
          <dt>Market</dt>
          <dd>{formatCount(form.marketSize)} customers</dd>
          <dt>Difficulty</dt>
          <dd>{DIFFICULTY_LABELS[form.difficulty].label}</dd>
        </dl>
      )}

      <div className="actions">
        {index === 0 ? (
          <Link to="/startups" className="button">
            Cancel
          </Link>
        ) : (
          <button type="button" onClick={() => setIndex(index - 1)}>
            Back
          </button>
        )}
        <button className="primary" disabled={busy}>
          {isLast ? (busy ? 'Creating…' : 'Create startup') : 'Next'}
        </button>
      </div>
    </form>
  );
}
