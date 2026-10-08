import type {
  BusinessModel,
  Difficulty,
  Industry,
  IndustryTemplate,
  Location,
  LocationTier,
  Startup,
  StartupCreateRequest,
} from '@stackforge/shared';
import { paiseToRupees, rupeesToPaise } from './money';

/** Form state for the creation wizard and the edit page. Money in rupees. */
export interface StartupForm {
  name: string;
  industry: Industry | '';
  businessModel: BusinessModel | '';
  initialCapitalRupees: number;
  productName: string;
  productDescription: string;
  initialPriceRupees: number;
  marketSize: number;
  difficulty: Difficulty;
  /** ISO state code, e.g. KA. */
  locationState: string;
  /** A listed city's id, OTHER_CITY for any other city, or '' before choosing. */
  locationCityId: string;
  /** The city's name: a listed city's, or the one typed for any other city. */
  locationCity: string;
  locationTier: LocationTier | '';
}

/** The city select's value for "a city that is not listed". */
export const OTHER_CITY = '__other';

export const emptyForm: StartupForm = {
  name: '',
  industry: '',
  businessModel: '',
  initialCapitalRupees: 0,
  productName: '',
  productDescription: '',
  initialPriceRupees: 0,
  marketSize: 0,
  difficulty: 'NORMAL',
  locationState: '',
  locationCityId: '',
  locationCity: '',
  locationTier: '',
};

export const STEPS = [
  'name',
  'industry',
  'location',
  'businessModel',
  'initialCapital',
  'product',
  'initialPrice',
  'marketSize',
  'difficulty',
] as const;
export type Step = (typeof STEPS)[number];

export const STEP_TITLES: Record<Step, string> = {
  name: 'Name your startup',
  industry: 'Choose an industry',
  location: 'Where is it based?',
  businessModel: 'Business model',
  initialCapital: 'Initial capital',
  product: 'Your product',
  initialPrice: 'Initial pricing',
  marketSize: 'Market size',
  difficulty: 'Difficulty',
};

// Mirrors the bounds in startup-create-request.schema.json (which is in paise).
export const LIMITS = {
  capitalMin: 1_00_000,
  capitalMax: 1_000_00_00_000,
  priceMin: 1,
  priceMax: 1_00_00_000,
  marketMin: 100,
  marketMax: 2_000_000_000,
};

export type FormErrors = Partial<Record<keyof StartupForm, string>>;

/** Validates the fields shown on one wizard step. */
export function validateStep(step: Step, form: StartupForm): FormErrors {
  const errors: FormErrors = {};
  switch (step) {
    case 'name':
      if (!form.name.trim()) errors.name = 'Give your startup a name.';
      else if (form.name.trim().length > 80) errors.name = 'Keep the name under 80 characters.';
      break;
    case 'industry':
      if (!form.industry) errors.industry = 'Pick an industry.';
      break;
    case 'location':
      if (!form.locationState) errors.locationState = 'Pick a state or union territory.';
      else if (!form.locationCityId) errors.locationCityId = 'Pick a city, or "Another city".';
      else if (form.locationCityId === OTHER_CITY) {
        if (form.locationCity.trim().length < 2) errors.locationCity = 'Type the city name.';
        if (!form.locationTier) errors.locationTier = 'Pick the size of the city.';
      }
      break;
    case 'businessModel':
      if (!form.businessModel) errors.businessModel = 'Pick a business model.';
      break;
    case 'initialCapital':
      if (
        !Number.isFinite(form.initialCapitalRupees) ||
        form.initialCapitalRupees < LIMITS.capitalMin ||
        form.initialCapitalRupees > LIMITS.capitalMax
      ) {
        errors.initialCapitalRupees = 'Capital must be between ₹1,00,000 and ₹1,000 crore.';
      }
      break;
    case 'product':
      if (!form.productName.trim()) errors.productName = 'Name your product.';
      if (form.productDescription.length > 1000) {
        errors.productDescription = 'Keep the description under 1000 characters.';
      }
      break;
    case 'initialPrice':
      if (
        !Number.isFinite(form.initialPriceRupees) ||
        form.initialPriceRupees < LIMITS.priceMin ||
        form.initialPriceRupees > LIMITS.priceMax
      ) {
        errors.initialPriceRupees = 'Price must be at least ₹1.';
      }
      break;
    case 'marketSize':
      if (
        !Number.isInteger(form.marketSize) ||
        form.marketSize < LIMITS.marketMin ||
        form.marketSize > LIMITS.marketMax
      ) {
        errors.marketSize = 'Market size must be a whole number of at least 100 customers.';
      }
      break;
    case 'difficulty':
      break;
  }
  return errors;
}

export function validateAll(form: StartupForm): FormErrors {
  return Object.assign({}, ...STEPS.map((step) => validateStep(step, form)));
}

/** Pre-fills economics from the chosen industry's template defaults. */
export function applyTemplateDefaults(form: StartupForm, template: IndustryTemplate): StartupForm {
  return {
    ...form,
    industry: template.industry,
    businessModel: template.defaults.businessModel,
    initialCapitalRupees: paiseToRupees(template.defaults.initialCapital),
    initialPriceRupees: paiseToRupees(template.defaults.initialPrice),
    marketSize: template.defaults.marketSize,
  };
}

/** "Nashik, MH (tier 2)" for summaries. */
export function formatLocation(form: StartupForm): string {
  if (!form.locationState || !form.locationCity.trim()) return 'Not set';
  const tier = form.locationTier ? ` (${form.locationTier.replace('_', ' ').toLowerCase()})` : '';
  return `${form.locationCity.trim()}, ${form.locationState}${tier}`;
}

/** The location as the API takes it. */
export function toLocation(form: StartupForm): Location {
  if (!form.locationState || !form.locationCityId || !form.locationTier) {
    throw new Error('Location is incomplete');
  }
  const other = form.locationCityId === OTHER_CITY;
  return {
    country: 'IN',
    state: form.locationState,
    city: form.locationCity.trim(),
    cityId: other ? null : form.locationCityId,
    tier: form.locationTier,
  };
}

export function toCreateRequest(form: StartupForm): StartupCreateRequest {
  if (!form.industry || !form.businessModel) throw new Error('Form is incomplete');
  return {
    name: form.name.trim(),
    industry: form.industry,
    businessModel: form.businessModel,
    initialCapital: rupeesToPaise(form.initialCapitalRupees),
    product: { name: form.productName.trim(), description: form.productDescription.trim() },
    initialPrice: rupeesToPaise(form.initialPriceRupees),
    marketSize: form.marketSize,
    difficulty: form.difficulty,
    location: toLocation(form),
  };
}

export function fromStartup(startup: Startup): StartupForm {
  const c = startup.configuration;
  return {
    name: startup.name,
    industry: c.industry,
    businessModel: c.businessModel,
    initialCapitalRupees: paiseToRupees(c.initialCapital),
    productName: startup.product.name,
    productDescription: startup.product.description,
    initialPriceRupees: paiseToRupees(c.initialPrice),
    marketSize: c.marketSize,
    difficulty: c.difficulty,
    locationState: startup.location?.state ?? '',
    locationCityId: startup.location ? (startup.location.cityId ?? OTHER_CITY) : '',
    locationCity: startup.location?.city ?? '',
    locationTier: startup.location?.tier ?? '',
  };
}

/** Only the fields that changed, for a PATCH. A location is compared once one is chosen. */
export function diffForUpdate(
  original: StartupForm,
  edited: StartupForm,
): Partial<StartupCreateRequest> {
  const fields = (f: StartupForm): Partial<StartupCreateRequest> => {
    const { location: _location, ...rest } = toCreateRequest({
      ...f,
      locationState: f.locationState || 'XX',
      locationCityId: f.locationCityId || OTHER_CITY,
      locationTier: f.locationTier || 'TIER_3',
    });
    void _location;
    return f.locationState && f.locationCityId ? { ...rest, location: toLocation(f) } : rest;
  };
  const before = fields(original);
  const after = fields(edited);
  const patch: Partial<StartupCreateRequest> = {};
  for (const key of Object.keys(after) as (keyof StartupCreateRequest)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      (patch as Record<string, unknown>)[key] = after[key];
    }
  }
  return patch;
}
