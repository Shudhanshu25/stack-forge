import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger.js';
import { MIGRATIONS } from '../src/migrations/index.js';
import { migrate } from '../src/migrations/runner.js';
import { SimulationModel } from '../src/modules/simulations/simulation.model.js';
import { StartupModel } from '../src/modules/startups/startup.model.js';
import {
  authHeader,
  fixture,
  harness,
  novaTech,
  register,
  type RegisteredUser,
} from './helpers.js';

let h: ReturnType<typeof harness>;
let user: RegisteredUser;
beforeEach(async () => {
  h = harness();
  user = await register(h.app);
});

const create = (location: unknown) =>
  request(h.app)
    .post('/api/v1/startups')
    .set(authHeader(user))
    .send({ ...novaTech, location });

describe('locations', () => {
  it('serves the catalog and previews a profile', async () => {
    const catalog = await request(h.app).get('/api/v1/locations').set(authHeader(user)).expect(200);
    expect(catalog.body.states[0]).toMatchObject({ code: 'KA', cities: [{ id: 'bengaluru' }] });
    const profile = await request(h.app)
      .post('/api/v1/locations/profile')
      .set(authHeader(user))
      .send({ state: 'MH', city: 'Nashik', tier: 'TIER_2' })
      .expect(200);
    expect(profile.body).toMatchObject({ basis: 'STATE_AND_TIER', city: 'Nashik', tier: 'TIER_2' });
  });

  it('needs a signed-in user', async () => {
    await request(h.app).get('/api/v1/locations').expect(401);
  });

  it('creates a startup in another city from its state and tier', async () => {
    const res = await create({
      country: 'IN',
      state: 'MH',
      city: ' Nashik ',
      cityId: null,
      tier: 'TIER_2',
    }).expect(201);
    expect(res.body.location).toEqual({
      country: 'IN',
      state: 'MH',
      city: 'Nashik',
      cityId: null,
      tier: 'TIER_2',
    });
    expect(res.body.configuration.locationProfile).toMatchObject({ basis: 'STATE_AND_TIER' });
  });

  it('takes a listed city name and tier from the data, not the request', async () => {
    const res = await create({
      country: 'IN',
      state: 'KA',
      city: 'bangalore',
      cityId: 'bengaluru',
      tier: 'TIER_3',
    }).expect(201);
    expect(res.body.location).toMatchObject({ city: 'Bengaluru', tier: 'METRO' });
  });

  it('refuses an unknown place or a city in the wrong state', async () => {
    const unknown = await create({
      country: 'IN',
      state: 'ZZ',
      city: 'Nowhere',
      cityId: null,
      tier: 'TIER_3',
    }).expect(400);
    expect(unknown.body.error.code).toBe('UNKNOWN_LOCATION');
    const wrong = await create({
      country: 'IN',
      state: 'MH',
      city: 'Bengaluru',
      cityId: 'bengaluru',
      tier: 'METRO',
    }).expect(400);
    expect(wrong.body.error.code).toBe('UNKNOWN_LOCATION');
  });

  it('a location is required and must be in India', async () => {
    const { location: _omit, ...withoutLocation } = novaTech;
    void _omit;
    await request(h.app)
      .post('/api/v1/startups')
      .set(authHeader(user))
      .send(withoutLocation)
      .expect(400);
    await create({
      country: 'US',
      state: 'CA',
      city: 'San Francisco',
      cityId: null,
      tier: 'METRO',
    }).expect(400);
  });

  it('the location can change until a simulation starts, then it is locked', async () => {
    const startup = await create(novaTech.location).expect(201);
    const moved = await request(h.app)
      .patch(`/api/v1/startups/${startup.body.id}`)
      .set(authHeader(user))
      .send({
        location: { country: 'IN', state: 'MH', city: 'Nashik', cityId: null, tier: 'TIER_2' },
      })
      .expect(200);
    expect(moved.body.configuration.locationProfile).toMatchObject({
      basis: 'STATE_AND_TIER',
      state: 'MH',
    });

    await request(h.app)
      .post(`/api/v1/startups/${startup.body.id}/simulation`)
      .set(authHeader(user))
      .send({})
      .expect(201);
    const locked = await request(h.app)
      .patch(`/api/v1/startups/${startup.body.id}`)
      .set(authHeader(user))
      .send({ location: novaTech.location })
      .expect(409);
    expect(locked.body.error.code).toBe('LOCATION_LOCKED');
    // Other edits still work, and keep the location profile.
    const renamed = await request(h.app)
      .patch(`/api/v1/startups/${startup.body.id}`)
      .set(authHeader(user))
      .send({ name: 'NovaTech West', difficulty: 'HARD' })
      .expect(200);
    expect(renamed.body.configuration.locationProfile).toMatchObject({ state: 'MH' });
  });

  it('migration 005 gives earlier startups and simulations the neutral profile', async () => {
    const { locationProfile: _p, ...oldConfiguration } =
      fixture.configuration as typeof fixture.configuration & { locationProfile?: unknown };
    void _p;
    const legacy = await StartupModel.collection.insertOne({
      ownerId: new mongoose.Types.ObjectId(user.body.user.id as string),
      name: 'Legacy',
      product: { name: 'Old', description: '' },
      configuration: oldConfiguration,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const sim = await SimulationModel.collection.insertOne({
      ownerId: legacy.insertedId,
      startupId: legacy.insertedId,
      configuration: oldConfiguration,
    });
    await migrate(mongoose.connection.db!, MIGRATIONS, createLogger('silent'));
    const startup = await StartupModel.collection.findOne({ _id: legacy.insertedId });
    const simulation = await SimulationModel.collection.findOne({ _id: sim.insertedId });
    expect(startup?.location).toBeNull();
    for (const doc of [startup, simulation]) {
      expect(doc?.configuration.locationProfile.basis).toBe('NEUTRAL');
      expect(
        Object.values(doc?.configuration.locationProfile.indices).every(
          (i) => (i as { value: number }).value === 1,
        ),
      ).toBe(true);
    }
    // The legacy startup reads as "no location" through the API.
    const res = await request(h.app)
      .get(`/api/v1/startups/${legacy.insertedId.toString()}`)
      .set(authHeader(user))
      .expect(200);
    expect(res.body.location).toBeNull();
  });
});
