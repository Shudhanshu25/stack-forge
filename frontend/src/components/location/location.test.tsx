// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocationProfile, Simulation, SimulationAnalytics } from '@stackforge/shared';
import { placeOf } from '../../pages/SimulationLayout';
import { analyticsFixture, simulationFixture } from '../../test/dom';
import { emptyForm, OTHER_CITY, type StartupForm } from '../../lib/wizard';
import { LocationAnalytics } from './LocationAnalytics';
import { LocationPicker, forgetLocationCatalog } from './LocationPicker';
import { LocationProfileCard, describeIndex } from './LocationProfileCard';

const index = (value: number, isEstimate = false) => ({ value, isEstimate, source: 'test source' });
const profile: LocationProfile = {
  dataVersion: 'test',
  basis: 'LISTED_CITY',
  country: 'IN',
  state: 'KA',
  stateName: 'Karnataka',
  city: 'Bengaluru',
  cityId: 'bengaluru',
  tier: 'METRO',
  indices: {
    salaryIndex: index(1.26),
    operatingCostIndex: index(1.29),
    purchasingPower: index(1.8),
    localMarketSize: index(1.52),
    talentAvailability: index(1.38, true),
    competitionDensity: index(1.5, true),
    fundingAccess: index(1.8, true),
    infrastructure: index(1.0, true),
    regulatoryBurden: index(0.9, true),
  },
};

const api = vi.hoisted(() => ({ catalog: vi.fn(), profile: vi.fn() }));
vi.mock('../../api/endpoints', () => ({ locationApi: api }));

beforeEach(() => {
  forgetLocationCatalog();
  api.catalog.mockResolvedValue({
    dataVersion: 'test',
    country: 'IN',
    tiers: [
      { tier: 'METRO', label: 'Metro', description: 'Class X' },
      { tier: 'TIER_2', label: 'Tier 2', description: 'Class Y' },
      { tier: 'TIER_3', label: 'Tier 3', description: 'Class Z' },
    ],
    states: [
      {
        code: 'KA',
        name: 'Karnataka',
        cities: [{ id: 'bengaluru', name: 'Bengaluru', tier: 'METRO' }],
      },
      { code: 'MH', name: 'Maharashtra', cities: [{ id: 'pune', name: 'Pune', tier: 'METRO' }] },
    ],
  });
  api.profile.mockResolvedValue(profile);
});
afterEach(cleanup);

function mountPicker(initial: StartupForm = emptyForm) {
  let form = initial;
  const view = render(<LocationPicker form={form} errors={{}} onChange={(f) => (form = f)} />);
  const rerender = () =>
    view.rerender(<LocationPicker form={form} errors={{}} onChange={(f) => (form = f)} />);
  return {
    get form() {
      return form;
    },
    rerender,
  };
}

describe('location picker', () => {
  it('filters cities by state and fills a listed city with its tier', async () => {
    const picker = mountPicker();
    const state = await screen.findByLabelText('State or union territory');
    fireEvent.change(state, { target: { value: 'MH' } });
    picker.rerender();
    const city = screen.getByLabelText('City') as HTMLSelectElement;
    const options = [...city.options].map((o) => o.textContent);
    expect(options).toEqual(['Choose…', 'Pune', 'Another city in Maharashtra']);
    fireEvent.change(city, { target: { value: 'pune' } });
    expect(picker.form).toMatchObject({
      locationState: 'MH',
      locationCityId: 'pune',
      locationCity: 'Pune',
      locationTier: 'METRO',
    });
  });

  it('asks for the name and size of a city that is not listed', async () => {
    const picker = mountPicker({ ...emptyForm, locationState: 'MH', locationCityId: OTHER_CITY });
    await screen.findByLabelText('City name');
    fireEvent.click(screen.getByLabelText(/Tier 2/));
    expect(picker.form.locationTier).toBe('TIER_2');
  });

  it('shows the profile card for a complete choice', async () => {
    mountPicker({
      ...emptyForm,
      locationState: 'KA',
      locationCityId: 'bengaluru',
      locationCity: 'Bengaluru',
      locationTier: 'METRO',
    });
    await screen.findByRole('region', { name: /Location profile: Bengaluru, Karnataka/ });
    expect(api.profile).toHaveBeenCalledWith({ state: 'KA', cityId: 'bengaluru' });
  });

  it('a failed catalog shows an error with a retry', async () => {
    api.catalog.mockRejectedValueOnce(new Error('offline'));
    mountPicker();
    await screen.findByRole('heading', { name: '✕ Locations could not be loaded' });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(api.catalog).toHaveBeenCalledTimes(2));
  });
});

describe('location profile card', () => {
  it('reads each index in plain language, against the national baseline', () => {
    expect(describeIndex(1.26, 'high', 'low')).toBe('high');
    expect(describeIndex(0.8, 'high', 'low')).toBe('low');
    expect(describeIndex(1.04, 'high', 'low')).toBe('near the national average');
    render(
      <LocationProfileCard
        profile={profile}
        localDemandWeight={0.9}
        industryName="Food & Beverage"
      />,
    );
    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(items.find((t) => t.startsWith('Salaries'))).toMatch(/high/);
    expect(items.find((t) => t.startsWith('Talent'))).toMatch(/easy to hire/);
    expect(items.find((t) => t.startsWith('State compliance'))).toMatch(/light/);
    expect(items.find((t) => t.startsWith('Infrastructure'))).toMatch(/near the national average/);
    // Estimates are labelled; measured values are not.
    expect(items.find((t) => t.startsWith('Talent'))).toMatch(/estimate/);
    expect(items.find((t) => t.startsWith('Salaries'))).not.toMatch(/estimate/);
    expect(screen.getByText(/count 90% for Food & Beverage/)).toBeTruthy();
  });
});

describe('location in the simulation views', () => {
  it('the header shows city and state, or that no location is set', () => {
    const located = {
      ...simulationFixture,
      configuration: { ...simulationFixture.configuration, locationProfile: profile },
    } as Simulation;
    expect(placeOf(located)).toBe('Bengaluru, Karnataka');
    const legacy = {
      ...simulationFixture,
      configuration: { ...simulationFixture.configuration, locationProfile: undefined },
    } as Simulation;
    expect(placeOf(legacy)).toBe('Location not set');
  });

  it('analytics show what the location costs against the baseline', () => {
    const impact = (analyticsFixture as SimulationAnalytics).location!;
    render(<LocationAnalytics impact={impact} />);
    expect(screen.getByRole('region', { name: 'Location costs' })).toBeTruthy();
    const costs = screen.getByRole('region', { name: 'Location costs' });
    expect(within(costs).getByText('Salaries')).toBeTruthy();
    expect(screen.getByText('Local market size')).toBeTruthy();
  });

  it('a startup on the neutral baseline says so', () => {
    const impact = {
      ...(analyticsFixture as SimulationAnalytics).location!,
      profile: { ...profile, basis: 'NEUTRAL' as const, city: null, stateName: null },
    };
    render(<LocationAnalytics impact={impact} />);
    expect(screen.getByText(/created before locations existed/)).toBeTruthy();
  });
});
