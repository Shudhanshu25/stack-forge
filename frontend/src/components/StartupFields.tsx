import type { Industry, IndustryTemplate } from '@stackforge/shared';
import {
  BUSINESS_MODELS,
  BUSINESS_MODEL_LABELS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  INDUSTRIES,
} from '../lib/enums';
import { formatCount, formatInr, rupeesToPaise } from '../lib/money';
import type { FormErrors, Step, StartupForm } from '../lib/wizard';
import { Field } from './Field';
import { LocationPicker } from './location/LocationPicker';

interface Props {
  step: Step;
  form: StartupForm;
  errors: FormErrors;
  templates: IndustryTemplate[];
  onChange: (form: StartupForm) => void;
  onIndustry: (industry: Industry) => void;
  /** Shown read-only (the edit page, once a simulation has started). */
  locationLocked?: boolean;
}

const num = (value: string) => (value === '' ? 0 : Number(value));

/** Renders the inputs for one step of the startup form; shared by the wizard and the edit page. */
export function StartupFields({
  step,
  form,
  errors,
  templates,
  onChange,
  onIndustry,
  locationLocked = false,
}: Props) {
  const set = <K extends keyof StartupForm>(key: K, value: StartupForm[K]) =>
    onChange({ ...form, [key]: value });
  const template = templates.find((t) => t.industry === form.industry);

  switch (step) {
    case 'name':
      return (
        <Field label="Startup name" error={errors.name}>
          <input
            autoFocus
            maxLength={80}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
      );

    case 'industry':
      return (
        <fieldset className="choices">
          <legend className="field-label">Industry</legend>
          {INDUSTRIES.map((industry) => {
            const t = templates.find((x) => x.industry === industry);
            return (
              <label
                key={industry}
                className={`choice${form.industry === industry ? ' selected' : ''}`}
              >
                <input
                  type="radio"
                  name="industry"
                  checked={form.industry === industry}
                  onChange={() => onIndustry(industry)}
                />
                <strong>{t?.displayName ?? industry}</strong>
                {t && <span className="muted">{t.description}</span>}
              </label>
            );
          })}
          {errors.industry && <span className="field-error">{errors.industry}</span>}
        </fieldset>
      );

    case 'location':
      if (locationLocked) {
        return (
          <div className="field">
            <span className="field-label">Location</span>
            <span>
              {form.locationCity ? `${form.locationCity} (${form.locationState})` : 'Not set'}
            </span>
            <span className="field-hint">
              Fixed: a simulation has started with this location&apos;s economics.
            </span>
          </div>
        );
      }
      return <LocationPicker form={form} errors={errors} onChange={onChange} template={template} />;

    case 'businessModel':
      return (
        <Field label="How do you charge customers?" error={errors.businessModel}>
          <select
            value={form.businessModel}
            onChange={(e) => set('businessModel', e.target.value as StartupForm['businessModel'])}
          >
            <option value="" disabled>
              Choose…
            </option>
            {BUSINESS_MODELS.map((m) => (
              <option key={m} value={m}>
                {BUSINESS_MODEL_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>
      );

    case 'initialCapital':
      return (
        <Field
          label="Initial capital (₹)"
          error={errors.initialCapitalRupees}
          hint={`${formatInr(rupeesToPaise(form.initialCapitalRupees))}${
            template
              ? ` · typical for ${template.displayName}: ${formatInr(template.defaults.initialCapital)}`
              : ''
          }`}
        >
          <input
            type="number"
            min={0}
            step="any"
            value={form.initialCapitalRupees || ''}
            onChange={(e) => set('initialCapitalRupees', num(e.target.value))}
          />
        </Field>
      );

    case 'product':
      return (
        <>
          <Field label="Product name" error={errors.productName}>
            <input
              maxLength={80}
              value={form.productName}
              onChange={(e) => set('productName', e.target.value)}
            />
          </Field>
          <Field label="What does it do?" error={errors.productDescription}>
            <textarea
              rows={4}
              maxLength={1000}
              value={form.productDescription}
              onChange={(e) => set('productDescription', e.target.value)}
            />
          </Field>
        </>
      );

    case 'initialPrice':
      return (
        <Field
          label={
            form.businessModel === 'SUBSCRIPTION' ? 'Price per month (₹)' : 'Price per purchase (₹)'
          }
          error={errors.initialPriceRupees}
          hint={
            template
              ? `Typical market price for ${template.displayName}: ${formatInr(template.parameters.referencePrice)}`
              : undefined
          }
        >
          <input
            type="number"
            min={1}
            step="any"
            value={form.initialPriceRupees || ''}
            onChange={(e) => set('initialPriceRupees', num(e.target.value))}
          />
        </Field>
      );

    case 'marketSize':
      return (
        <Field
          label="Potential customers in your market"
          error={errors.marketSize}
          hint={form.marketSize ? `${formatCount(form.marketSize)} customers` : undefined}
        >
          <input
            type="number"
            min={100}
            step={1}
            value={form.marketSize || ''}
            onChange={(e) => set('marketSize', num(e.target.value))}
          />
        </Field>
      );

    case 'difficulty':
      return (
        <fieldset className="choices">
          <legend className="field-label">Difficulty</legend>
          {DIFFICULTIES.map((d) => (
            <label key={d} className={`choice${form.difficulty === d ? ' selected' : ''}`}>
              <input
                type="radio"
                name="difficulty"
                checked={form.difficulty === d}
                onChange={() => set('difficulty', d)}
              />
              <strong>{DIFFICULTY_LABELS[d].label}</strong>
              <span className="muted">{DIFFICULTY_LABELS[d].hint}</span>
            </label>
          ))}
        </fieldset>
      );
  }
}
