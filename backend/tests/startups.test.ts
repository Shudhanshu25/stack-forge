import { readFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { sharedDir } from '../src/contracts.js';
import { novaTech, register, testApp, type RegisteredUser } from './helpers.js';

const app = testApp();
const readTemplate = (file: string) =>
  JSON.parse(readFileSync(path.join(sharedDir, 'templates', file), 'utf8'));

const auth = (user: RegisteredUser) => ({ Authorization: `Bearer ${user.accessToken}` });

describe('startup CRUD', () => {
  let user: RegisteredUser;
  beforeEach(async () => {
    user = await register(app);
  });

  it('creates a startup with a configuration snapshotted from the industry template', async () => {
    const res = await request(app)
      .post('/api/v1/startups')
      .set(auth(user))
      .send(novaTech)
      .expect(201);
    const saas = readTemplate('industries/saas.json');
    const presets = readTemplate('difficulty.json');
    const catalog = readTemplate('events.json');

    expect(res.body).toMatchObject({
      name: 'NovaTech',
      ownerId: user.body.user.id,
      product: novaTech.product,
    });
    expect(res.body.configuration).toEqual({
      industry: 'SAAS',
      businessModel: 'SUBSCRIPTION',
      difficulty: 'NORMAL',
      initialCapital: 100_000_000,
      initialPrice: 49_900,
      marketSize: 200_000,
      templateVersion: saas.templateVersion,
      parameters: saas.parameters,
      difficultyModifiers: presets.NORMAL,
      eventsVersion: catalog.eventsVersion,
      events: catalog.events,
      locationProfile: expect.objectContaining({ basis: 'LISTED_CITY', cityId: 'bengaluru' }),
    });
    expect(res.body.location).toEqual(novaTech.location);
  });

  it('lists, reads, updates and deletes own startups', async () => {
    const created = (await request(app).post('/api/v1/startups').set(auth(user)).send(novaTech))
      .body;

    const list = await request(app).get('/api/v1/startups').set(auth(user)).expect(200);
    expect(list.body.startups.map((s: { id: string }) => s.id)).toEqual([created.id]);

    await request(app).get(`/api/v1/startups/${created.id}`).set(auth(user)).expect(200);

    const updated = await request(app)
      .patch(`/api/v1/startups/${created.id}`)
      .set(auth(user))
      .send({ name: 'NovaTech Labs', initialPrice: 79_900 })
      .expect(200);
    expect(updated.body.name).toBe('NovaTech Labs');
    expect(updated.body.configuration.initialPrice).toBe(79_900);
    expect(updated.body.configuration.parameters).toEqual(created.configuration.parameters);

    await request(app).delete(`/api/v1/startups/${created.id}`).set(auth(user)).expect(204);
    await request(app).get(`/api/v1/startups/${created.id}`).set(auth(user)).expect(404);
  });

  it('re-snapshots parameters when the industry or difficulty changes', async () => {
    const created = (await request(app).post('/api/v1/startups').set(auth(user)).send(novaTech))
      .body;
    const res = await request(app)
      .patch(`/api/v1/startups/${created.id}`)
      .set(auth(user))
      .send({ industry: 'GAMING', difficulty: 'HARD' })
      .expect(200);
    expect(res.body.configuration.parameters).toEqual(
      readTemplate('industries/gaming.json').parameters,
    );
    expect(res.body.configuration.difficultyModifiers).toEqual(
      readTemplate('difficulty.json').HARD,
    );
  });

  it('validates the create request against the shared schema', async () => {
    const bad = await request(app)
      .post('/api/v1/startups')
      .set(auth(user))
      .send({ ...novaTech, industry: 'CRYPTO', initialPrice: -5, extra: true })
      .expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    const paths = bad.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['/industry', '/initialPrice', '/']));
  });

  it('rejects an empty update', async () => {
    const created = (await request(app).post('/api/v1/startups').set(auth(user)).send(novaTech))
      .body;
    await request(app).patch(`/api/v1/startups/${created.id}`).set(auth(user)).send({}).expect(400);
  });

  it('returns 404 for a malformed id', async () => {
    await request(app).get('/api/v1/startups/not-an-id').set(auth(user)).expect(404);
  });

  it('serves the eight industry templates', async () => {
    const res = await request(app).get('/api/v1/industry-templates').set(auth(user)).expect(200);
    expect(res.body.templates).toHaveLength(8);
  });
});

describe('startup ownership', () => {
  let alice: RegisteredUser;
  let bob: RegisteredUser;
  let bobsStartupId: string;

  beforeEach(async () => {
    alice = await register(app);
    bob = await register(app);
    bobsStartupId = (await request(app).post('/api/v1/startups').set(auth(bob)).send(novaTech)).body
      .id;
  });

  it("user A cannot read user B's startup", async () => {
    const res = await request(app)
      .get(`/api/v1/startups/${bobsStartupId}`)
      .set(auth(alice))
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    const list = await request(app).get('/api/v1/startups').set(auth(alice)).expect(200);
    expect(list.body.startups).toEqual([]);
  });

  it("user A cannot update user B's startup", async () => {
    await request(app)
      .patch(`/api/v1/startups/${bobsStartupId}`)
      .set(auth(alice))
      .send({ name: 'Hijacked' })
      .expect(404);
    const res = await request(app)
      .get(`/api/v1/startups/${bobsStartupId}`)
      .set(auth(bob))
      .expect(200);
    expect(res.body.name).toBe('NovaTech');
  });

  it("user A cannot delete user B's startup", async () => {
    await request(app).delete(`/api/v1/startups/${bobsStartupId}`).set(auth(alice)).expect(404);
    await request(app).get(`/api/v1/startups/${bobsStartupId}`).set(auth(bob)).expect(200);
  });
});
