import { describe, expect, it } from 'vitest';
import type { IndustryTemplate } from '@stackforge/shared';
import saas from '@stackforge/shared/templates/industries/saas.json';
import {
  OTHER_CITY,
  STEPS,
  applyTemplateDefaults,
  diffForUpdate,
  emptyForm,
  formatLocation,
  fromStartup,
  toCreateRequest,
  validateAll,
  validateStep,
  type StartupForm,
} from './wizard';

const complete: StartupForm = {
  ...applyTemplateDefaults(emptyForm, saas as IndustryTemplate),
  name: 'NovaTech',
  productName: 'Nova CRM',
  productDescription: 'CRM for small businesses',
  locationState: 'KA',
  locationCityId: 'bengaluru',
  locationCity: 'Bengaluru',
  locationTier: 'METRO',
};

describe('wizard', () => {
  it('has the eight steps from the spec plus location, in order', () => {
    expect(STEPS).toEqual([
      'name',
      'industry',
      'location',
      'businessModel',
      'initialCapital',
      'product',
      'initialPrice',
      'marketSize',
      'difficulty',
    ]);
  });

  it('pre-fills economics from the industry template', () => {
    expect(complete).toMatchObject({
      industry: 'SAAS',
      businessModel: 'SUBSCRIPTION',
      initialCapitalRupees: 1_000_000,
      initialPriceRupees: 499,
      marketSize: 200_000,
    });
  });

  it('validates each step', () => {
    expect(validateStep('name', emptyForm)).toHaveProperty('name');
    expect(validateStep('industry', emptyForm)).toHaveProperty('industry');
    expect(
      validateStep('initialCapital', { ...complete, initialCapitalRupees: 500 }),
    ).toHaveProperty('initialCapitalRupees');
    expect(validateStep('initialPrice', { ...complete, initialPriceRupees: -1 })).toHaveProperty(
      'initialPriceRupees',
    );
    expect(validateStep('marketSize', { ...complete, marketSize: 10.5 })).toHaveProperty(
      'marketSize',
    );
    expect(validateAll(complete)).toEqual({});
  });

  it('validates the location step: state, then city, or another city with its tier', () => {
    expect(validateStep('location', emptyForm)).toHaveProperty('locationState');
    expect(validateStep('location', { ...emptyForm, locationState: 'MH' })).toHaveProperty(
      'locationCityId',
    );
    const other = { ...emptyForm, locationState: 'MH', locationCityId: OTHER_CITY };
    expect(validateStep('location', other)).toMatchObject({
      locationCity: expect.any(String),
      locationTier: expect.any(String),
    });
    expect(
      validateStep('location', { ...other, locationCity: 'Nashik', locationTier: 'TIER_2' }),
    ).toEqual({});
  });

  it('sends another city without an id, and a listed one with its id', () => {
    const nashik = {
      ...complete,
      locationState: 'MH',
      locationCityId: OTHER_CITY,
      locationCity: ' Nashik ',
      locationTier: 'TIER_2' as const,
    };
    expect(toCreateRequest(nashik).location).toEqual({
      country: 'IN',
      state: 'MH',
      city: 'Nashik',
      cityId: null,
      tier: 'TIER_2',
    });
    expect(formatLocation(nashik)).toBe('Nashik, MH (tier 2)');
  });

  it('builds a create request in paise', () => {
    expect(toCreateRequest(complete)).toEqual({
      name: 'NovaTech',
      industry: 'SAAS',
      businessModel: 'SUBSCRIPTION',
      initialCapital: 100_000_000,
      product: { name: 'Nova CRM', description: 'CRM for small businesses' },
      initialPrice: 49_900,
      marketSize: 200_000,
      difficulty: 'NORMAL',
      location: {
        country: 'IN',
        state: 'KA',
        city: 'Bengaluru',
        cityId: 'bengaluru',
        tier: 'METRO',
      },
    });
  });

  it('a startup from before locations sends no location until one is chosen', () => {
    const legacy = fromStartup({
      id: 's1',
      ownerId: 'u1',
      name: 'Old',
      product: { name: 'P', description: '' },
      location: null,
      configuration: {
        ...toCreateRequest(complete),
        templateVersion: '1',
        parameters: saas.parameters,
        difficultyModifiers: {},
        eventsVersion: '1',
        events: [],
      },
      createdAt: '',
      updatedAt: '',
    } as never);
    expect(legacy.locationState).toBe('');
    expect(diffForUpdate(legacy, { ...legacy, name: 'Renamed' })).toEqual({ name: 'Renamed' });
    const located = {
      ...legacy,
      locationState: 'KA',
      locationCityId: 'bengaluru',
      locationCity: 'Bengaluru',
      locationTier: 'METRO' as const,
    };
    expect(diffForUpdate(legacy, located)).toHaveProperty('location.cityId', 'bengaluru');
  });

  it('sends only changed fields on update', () => {
    const edited = { ...complete, initialPriceRupees: 799, productDescription: 'Updated' };
    expect(diffForUpdate(complete, edited)).toEqual({
      initialPrice: 79_900,
      product: { name: 'Nova CRM', description: 'Updated' },
    });
  });
});
