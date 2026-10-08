import { useEffect, useState } from 'react';
import type {
  IndustryTemplate,
  LocationCatalog,
  LocationProfile,
  LocationTier,
} from '@stackforge/shared';
import { ApiError } from '../../api/client';
import { locationApi } from '../../api/endpoints';
import { OTHER_CITY, type FormErrors, type StartupForm } from '../../lib/wizard';
import { Field } from '../Field';
import { ErrorState } from '../feedback/States';
import { TableSkeleton } from '../feedback/Skeletons';
import { Term } from '../Term';
import { LocationProfileCard } from './LocationProfileCard';

let cachedCatalog: Promise<LocationCatalog> | null = null;

/** Forgets the cached catalog (tests). */
export function forgetLocationCatalog() {
  cachedCatalog = null;
}

/** The states, listed cities and tiers (fetched once per page load). */
export function useLocationCatalog() {
  const [catalog, setCatalog] = useState<LocationCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    cachedCatalog ??= locationApi.catalog();
    cachedCatalog.then(setCatalog).catch((err: unknown) => {
      cachedCatalog = null;
      setError(err instanceof ApiError ? err.message : 'Check your connection and retry.');
    });
  }, [attempt]);
  return {
    catalog,
    error,
    retry: () => {
      setError(null);
      setAttempt((a) => a + 1);
    },
  };
}

/** The profile the current choice resolves to, for the card shown before confirming. */
function useProfilePreview(form: StartupForm) {
  const [profile, setProfile] = useState<LocationProfile | null>(null);
  const complete =
    form.locationState &&
    form.locationCityId &&
    (form.locationCityId !== OTHER_CITY || form.locationTier);
  const key = complete
    ? `${form.locationState}|${form.locationCityId}|${form.locationCityId === OTHER_CITY ? form.locationTier : ''}`
    : '';
  useEffect(() => {
    if (!key) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    const [state, cityId, tier] = key.split('|');
    locationApi
      .profile(
        cityId === OTHER_CITY
          ? { state: state!, tier: tier as LocationTier }
          : { state: state!, cityId: cityId! },
      )
      .then((p) => !cancelled && setProfile(p))
      .catch(() => !cancelled && setProfile(null));
    return () => {
      cancelled = true;
    };
  }, [key]);
  return profile;
}

/** The location step: state, then city filtered by state, or "Another city" with its tier. */
export function LocationPicker({
  form,
  errors,
  onChange,
  template,
}: {
  form: StartupForm;
  errors: FormErrors;
  onChange: (form: StartupForm) => void;
  template?: IndustryTemplate;
}) {
  const { catalog, error, retry } = useLocationCatalog();
  const profile = useProfilePreview(form);
  if (error) {
    return (
      <ErrorState
        card={false}
        title="Locations could not be loaded"
        message={error}
        onRetry={retry}
      />
    );
  }
  if (!catalog) return <TableSkeleton label="Loading locations" rows={2} />;

  const state = catalog.states.find((s) => s.code === form.locationState);
  const other = form.locationCityId === OTHER_CITY;
  return (
    <>
      <p className="muted small">
        <Term k="location">Location</Term> changes your costs (salaries, rent, compliance) and, for
        businesses with local customers, your market. It is fixed once a simulation starts.
      </p>
      <Field label="State or union territory" error={errors.locationState}>
        <select
          value={form.locationState}
          onChange={(e) =>
            onChange({
              ...form,
              locationState: e.target.value,
              locationCityId: '',
              locationCity: '',
              locationTier: '',
            })
          }
        >
          <option value="">Choose…</option>
          {catalog.states.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      {state && (
        <Field label="City" error={errors.locationCityId}>
          <select
            value={form.locationCityId}
            onChange={(e) => {
              const id = e.target.value;
              const listed = state.cities.find((c) => c.id === id);
              onChange({
                ...form,
                locationCityId: id,
                locationCity: listed ? listed.name : '',
                locationTier: listed ? listed.tier : '',
              });
            }}
          >
            <option value="">Choose…</option>
            {state.cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={OTHER_CITY}>Another city in {state.name}</option>
          </select>
        </Field>
      )}
      {other && (
        <>
          <Field label="City name" error={errors.locationCity}>
            <input
              maxLength={60}
              value={form.locationCity}
              onChange={(e) => onChange({ ...form, locationCity: e.target.value })}
            />
          </Field>
          <fieldset className="choices">
            <legend className="field-label">How big is the city?</legend>
            {catalog.tiers.map((t) => (
              <label
                key={t.tier}
                className={`choice ${form.locationTier === t.tier ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="tier"
                  checked={form.locationTier === t.tier}
                  onChange={() => onChange({ ...form, locationTier: t.tier })}
                />
                <strong>{t.label}</strong>
                <span className="xs muted">{t.description}</span>
              </label>
            ))}
            {errors.locationTier && <span className="field-error">{errors.locationTier}</span>}
          </fieldset>
        </>
      )}
      {profile && (
        <LocationProfileCard
          profile={profile}
          localDemandWeight={template?.parameters.localDemandWeight ?? undefined}
          industryName={template?.displayName}
        />
      )}
    </>
  );
}
