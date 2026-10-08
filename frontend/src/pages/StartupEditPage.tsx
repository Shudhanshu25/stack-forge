import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Industry } from '@stackforge/shared';
import { ApiError } from '../api/client';
import { simulationApi, startupApi } from '../api/endpoints';
import { PageSkeleton } from '../components/feedback/Skeletons';
import { FormError } from '../components/Field';
import { StartupFields } from '../components/StartupFields';
import { useTemplates } from '../hooks/useTemplates';
import {
  STEPS,
  diffForUpdate,
  fromStartup,
  validateAll,
  type FormErrors,
  type StartupForm,
} from '../lib/wizard';

export function StartupEditPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { templates } = useTemplates();
  const [original, setOriginal] = useState<StartupForm | null>(null);
  const [form, setForm] = useState<StartupForm | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locationLocked, setLocationLocked] = useState(false);

  useEffect(() => {
    Promise.all([startupApi.get(id), simulationApi.listForStartup(id)])
      .then(([startup, simulations]) => {
        setOriginal(fromStartup(startup));
        setForm(fromStartup(startup));
        setLocationLocked(simulations.length > 0);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load startup'));
  }, [id]);

  if (!form || !original) {
    return error ? <FormError message={error} /> : <PageSkeleton label="Loading the startup" />;
  }

  const resetsParameters =
    form.industry !== original.industry || form.difficulty !== original.difficulty;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form || !original) return;
    const formErrors = validateAll(form);
    // A locked location is not edited here; a startup from before locations may stay without one.
    const keepsNoLocation = !original.locationState && !form.locationState;
    if (locationLocked || keepsNoLocation) {
      delete formErrors.locationState;
      delete formErrors.locationCityId;
      delete formErrors.locationCity;
      delete formErrors.locationTier;
    }
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) return;
    const patch = diffForUpdate(original, form);
    if (Object.keys(patch).length === 0) {
      navigate('/startups');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await startupApi.update(id, patch);
      navigate('/startups');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save changes');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card wizard" onSubmit={save}>
      <h1>Edit {original.name}</h1>
      <FormError message={error} />
      {STEPS.map((step) => (
        <StartupFields
          key={step}
          step={step}
          form={form}
          errors={errors}
          templates={templates}
          onChange={setForm}
          onIndustry={(industry: Industry) => setForm({ ...form, industry })}
          locationLocked={locationLocked}
        />
      ))}
      {resetsParameters && (
        <p className="notice">
          Changing the industry or difficulty resets this startup&apos;s simulation parameters to
          the new template.
        </p>
      )}
      <div className="actions">
        <Link to="/startups" className="button">
          Cancel
        </Link>
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
