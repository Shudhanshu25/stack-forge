import type { Location, LocationCatalog, LocationProfile } from '@stackforge/shared';
import type { EngineClient } from '../../engine/engine-client.js';
import { engineFailure } from '../simulations/simulation.service.js';

/**
 * Location data comes from the simulation service, which owns the data file and resolves
 * profiles (a listed city's values, or a state's values with tier defaults).
 */
export class LocationService {
  constructor(private readonly engine: EngineClient) {}

  async catalog(): Promise<LocationCatalog> {
    try {
      return await this.engine.locations();
    } catch (err) {
      throw engineFailure(err);
    }
  }

  async profile(
    location: Pick<Location, 'state' | 'cityId' | 'city' | 'tier'>,
  ): Promise<LocationProfile> {
    try {
      return await this.engine.locationProfile({
        state: location.state,
        ...(location.cityId
          ? { cityId: location.cityId }
          : { city: location.city.trim(), tier: location.tier }),
      });
    } catch (err) {
      throw engineFailure(err);
    }
  }

  /** The location as stored on the startup: a listed city's name and tier come from the data. */
  static normalized(location: Location, profile: LocationProfile): Location {
    return {
      country: 'IN',
      state: location.state,
      city: profile.city ?? location.city.trim(),
      cityId: profile.cityId ?? null,
      tier: profile.tier ?? location.tier,
    };
  }
}

/**
 * The neutral profile: every index at the national baseline. Startups created before
 * locations existed get it (migration 005); the engine treats it as no location effect.
 */
export function neutralProfile(): LocationProfile {
  const index = {
    value: 1,
    isEstimate: false,
    source: 'National baseline (startup created before locations existed).',
  };
  return {
    dataVersion: 'neutral',
    basis: 'NEUTRAL',
    country: 'IN',
    state: null,
    stateName: null,
    city: null,
    cityId: null,
    tier: null,
    indices: {
      salaryIndex: { ...index },
      operatingCostIndex: { ...index },
      purchasingPower: { ...index },
      localMarketSize: { ...index },
      talentAvailability: { ...index },
      competitionDensity: { ...index },
      fundingAccess: { ...index },
      infrastructure: { ...index },
      regulatoryBurden: { ...index },
    },
  };
}
