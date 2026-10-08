import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger.js';
import { MIGRATIONS } from '../src/migrations/index.js';
import { migrate } from '../src/migrations/runner.js';
import { ActionTokenModel } from '../src/modules/auth/action-token.model.js';
import { OTP_MAX_ATTEMPTS, OtpCodeModel } from '../src/modules/auth/otp-code.model.js';
import { HttpGoogleOAuth } from '../src/modules/auth/google.js';
import { UserModel } from '../src/modules/auth/user.model.js';
import {
  STRONG_PASSWORD,
  authHeader,
  harness,
  novaTech,
  refreshCookieOf,
  register,
  registerUnverified,
  uniqueEmail,
} from './helpers.js';

let h: ReturnType<typeof harness>;
beforeEach(() => {
  h = harness();
});

const tokenFrom = (link: string | undefined) => new URL(link!).searchParams.get('token')!;

async function startSimulation(user: { accessToken: string }) {
  const startup = await request(h.app)
    .post('/api/v1/startups')
    .set(authHeader(user as never))
    .send(novaTech)
    .expect(201);
  return request(h.app)
    .post(`/api/v1/startups/${startup.body.id}/simulation`)
    .set(authHeader(user as never))
    .send({ seed: 1 });
}

describe('email verification', () => {
  it('unverified accounts can sign in and set up startups but not start simulations', async () => {
    const user = await registerUnverified(h.app);
    expect(user.body.user).toMatchObject({ emailVerified: false, hasPassword: true });
    expect(h.email.sent).toHaveLength(1);
    expect(h.email.sent[0]!.subject).toContain('Confirm your email');

    const blocked = await startSimulation(user);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const link = h.email.lastLinkTo(user.email);
    expect(link).toMatch(/^http:\/\/localhost:5173\/verify-email\?token=/);
    const verified = await request(h.app)
      .post('/api/v1/auth/verify-email')
      .send({ token: tokenFrom(link) })
      .expect(200);
    expect(verified.body.emailVerified).toBe(true);
    expect((await startSimulation(user)).status).toBe(201);
  });

  it('links are single-use, expire, and a resend replaces the previous link', async () => {
    const user = await registerUnverified(h.app);
    const first = tokenFrom(h.email.lastLinkTo(user.email));

    await request(h.app).post('/api/v1/auth/verify-email/resend').set(authHeader(user)).expect(202);
    const second = tokenFrom(h.email.lastLinkTo(user.email));
    expect(second).not.toBe(first);
    const stale = await request(h.app).post('/api/v1/auth/verify-email').send({ token: first });
    expect(stale.status).toBe(400);
    expect(stale.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');

    await ActionTokenModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await request(h.app).post('/api/v1/auth/verify-email').send({ token: second }).expect(400);

    await request(h.app).post('/api/v1/auth/verify-email/resend').set(authHeader(user));
    const third = tokenFrom(h.email.lastLinkTo(user.email));
    await request(h.app).post('/api/v1/auth/verify-email').send({ token: third }).expect(200);
    await request(h.app).post('/api/v1/auth/verify-email').send({ token: third }).expect(400);
  });

  it('verified accounts get no further verification emails', async () => {
    const user = await register(h.app);
    const before = h.email.sent.length;
    await request(h.app).post('/api/v1/auth/verify-email/resend').set(authHeader(user)).expect(202);
    expect(h.email.sent).toHaveLength(before);
  });
});

describe('password reset by emailed code', () => {
  const ask = (email: string) =>
    request(h.app).post('/api/v1/auth/password-reset').send({ email }).expect(202);
  const verify = (email: string, code: string) =>
    request(h.app).post('/api/v1/auth/password-reset/verify').send({ email, code });
  /** A code that is certainly not the live one. */
  const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

  it('never reveals whether an email has an account', async () => {
    await ask('nobody@example.com');
    expect(h.email.sent).toHaveLength(0);
    const res = await verify('nobody@example.com', '123456').expect(400);
    expect(res.body.error.code).toBe('INVALID_CODE');
  });

  it('emails a 6-digit code (never a link) and stores only its hash', async () => {
    const user = await register(h.app);
    await ask(user.email);
    const message = h.email.sent.at(-1)!;
    const code = h.email.lastCodeTo(user.email)!;
    expect(code).toMatch(/^\d{6}$/);
    expect(message.subject).toContain(code);
    expect(message.text).not.toMatch(/https?:\/\//);
    const stored = await OtpCodeModel.findOne({
      userId: (await UserModel.findOne({ email: user.email }))!._id,
    });
    expect(stored?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(code);
  });

  it('a right code gives a single-use token for the new password, which signs out everywhere', async () => {
    const user = await registerUnverified(h.app);
    const otherSession = await request(h.app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: STRONG_PASSWORD })
      .expect(200);

    await ask(user.email);
    const code = h.email.lastCodeTo(user.email)!;
    expect((await verify(user.email, wrong(code)).expect(400)).body.error.code).toBe(
      'INVALID_CODE',
    );
    // Email case does not matter.
    const ok = await verify(user.email.toUpperCase(), code).expect(200);
    expect(ok.body.expiresInSeconds).toBeGreaterThan(0);
    const token = ok.body.resetToken as string;
    // The code works once.
    await verify(user.email, code).expect(400);

    const weak = await request(h.app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token, password: 'short' });
    expect(weak.body.error.code).toBe('WEAK_PASSWORD');
    await request(h.app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token, password: 'New-Password-123' })
      .expect(204);
    await request(h.app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token, password: 'Another-Password-9' })
      .expect(400);

    await request(h.app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: STRONG_PASSWORD })
      .expect(401);
    const fresh = await request(h.app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'New-Password-123' })
      .expect(200);
    expect(fresh.body.user.emailVerified).toBe(true);
    for (const cookie of [user.refreshCookie, refreshCookieOf(otherSession)]) {
      await request(h.app).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
    }
  });

  it('five wrong tries end the code, even for the right code afterwards', async () => {
    const user = await register(h.app);
    await ask(user.email);
    const code = h.email.lastCodeTo(user.email)!;
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) await verify(user.email, wrong(code)).expect(400);
    await verify(user.email, code).expect(400);
  });

  it('parallel guesses cannot exceed the attempt limit', async () => {
    const user = await register(h.app);
    await ask(user.email);
    const code = h.email.lastCodeTo(user.email)!;
    await Promise.all(Array.from({ length: 12 }, () => verify(user.email, wrong(code))));
    const live = await OtpCodeModel.findOne({ usedAt: null });
    expect(live).toBeNull();
    await verify(user.email, code).expect(400);
  });

  it('a new code cancels the previous one', async () => {
    const user = await register(h.app);
    await ask(user.email);
    const first = h.email.lastCodeTo(user.email)!;
    await ask(user.email);
    const second = h.email.lastCodeTo(user.email)!;
    if (first !== second) await verify(user.email, first).expect(400);
    await verify(user.email, second).expect(200);
  });

  it('expired codes and expired reset tokens are refused', async () => {
    const user = await register(h.app);
    await ask(user.email);
    await OtpCodeModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1) } });
    await verify(user.email, h.email.lastCodeTo(user.email)!).expect(400);

    await ask(user.email);
    const ok = await verify(user.email, h.email.lastCodeTo(user.email)!).expect(200);
    await ActionTokenModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1) } });
    const res = await request(h.app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: ok.body.resetToken, password: 'New-Password-123' });
    expect(res.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
  });

  it('rejects malformed codes before checking them', async () => {
    const user = await register(h.app);
    await ask(user.email);
    for (const code of ['12345', '1234567', 'abcdef', ' 123456']) {
      const res = await verify(user.email, code).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    // Malformed requests do not use up the code's attempts.
    await verify(user.email, h.email.lastCodeTo(user.email)!).expect(200);
  });
});

describe('Google sign-in', () => {
  /** Follows /google/start -> (Google) -> /google/callback like a browser would. */
  async function googleFlow(tamperState = false) {
    const start = await request(h.app).get('/api/v1/auth/google/start').expect(302);
    const oauthCookie = (start.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('sf_oauth='),
    )!;
    expect(oauthCookie).toContain('SameSite=Lax');
    const google = new URL(start.headers.location!);
    const state = tamperState ? 'forged-state' : google.searchParams.get('state')!;
    return request(h.app)
      .get(`/api/v1/auth/google/callback?code=${google.searchParams.get('code')}&state=${state}`)
      .set('Cookie', oauthCookie.split(';')[0]!);
  }

  it('creates a verified, password-less account and signs it in', async () => {
    const callback = await googleFlow();
    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe('http://localhost:5173/auth/google/done');
    const session = await request(h.app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookieOf(callback))
      .expect(200);
    expect(session.body.user).toMatchObject({
      email: 'googler@example.com',
      emailVerified: true,
      hasPassword: false,
      googleLinked: true,
    });
    // No password: password login is refused like any wrong password.
    await request(h.app)
      .post('/api/v1/auth/login')
      .send({ email: 'googler@example.com', password: STRONG_PASSWORD })
      .expect(401);
  });

  it('links to an existing account with the same (Google-verified) email', async () => {
    const existing = await registerUnverified(h.app, 'googler@example.com');
    const callback = await googleFlow();
    const session = await request(h.app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookieOf(callback))
      .expect(200);
    expect(session.body.user.id).toBe(existing.body.user.id);
    expect(session.body.user).toMatchObject({
      googleLinked: true,
      emailVerified: true,
      hasPassword: true,
    });
    expect(await UserModel.countDocuments({ email: 'googler@example.com' })).toBe(1);
  });

  it('refuses a forged state and an email Google has not verified', async () => {
    const forged = await googleFlow(true);
    expect(forged.headers.location).toBe('http://localhost:5173/login?error=google');
    expect(forged.headers['set-cookie']?.toString() ?? '').not.toContain('sf_refresh=ey');

    h.google.identity = { ...h.google.identity, emailVerified: false };
    const unverified = await googleFlow();
    expect(unverified.headers.location).toBe('http://localhost:5173/login?error=google');
    expect(await UserModel.countDocuments({})).toBe(0);
  });

  it('is advertised only when configured', async () => {
    expect((await request(h.app).get('/api/v1/auth/options')).body).toEqual({ google: true });
    h.google.enabled = false;
    expect((await request(h.app).get('/api/v1/auth/options')).body).toEqual({ google: false });
    await request(h.app).get('/api/v1/auth/google/start').expect(404);
  });

  it('checks the id_token claims', () => {
    const google = new HttpGoogleOAuth('client-1', 'secret', 'http://cb');
    const token = (claims: object) =>
      `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;
    const ok = {
      iss: 'https://accounts.google.com',
      aud: 'client-1',
      exp: 2e9,
      sub: 's',
      email: 'A@x.com',
      email_verified: true,
    };
    expect(google.identityFrom(token(ok), 1e12)).toMatchObject({
      email: 'a@x.com',
      emailVerified: true,
    });
    expect(() => google.identityFrom(token({ ...ok, aud: 'other' }), 1e12)).toThrow('audience');
    expect(() => google.identityFrom(token({ ...ok, iss: 'https://evil' }), 1e12)).toThrow(
      'issuer',
    );
    expect(() => google.identityFrom(token({ ...ok, exp: 1 }), 1e12)).toThrow('expired');
  });
});

describe('sessions', () => {
  it('lists each sign-in with its device and revokes one at a time', async () => {
    const email = uniqueEmail();
    const laptop = await request(h.app)
      .post('/api/v1/auth/register')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/140.0 Safari/537.36')
      .send({ email, password: STRONG_PASSWORD, name: 'Two Devices' })
      .expect(201);
    const phone = await request(h.app)
      .post('/api/v1/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Safari/604.1')
      .send({ email, password: STRONG_PASSWORD })
      .expect(200);
    const token = laptop.body.accessToken as string;

    const list = await request(h.app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', refreshCookieOf(laptop))
      .expect(200);
    expect(list.body.sessions.map((s: { device: string }) => s.device).sort()).toEqual([
      'Chrome on Windows',
      'Safari on iOS',
    ]);
    const current = list.body.sessions.find((s: { current: boolean }) => s.current);
    expect(current.device).toBe('Chrome on Windows');
    const other = list.body.sessions.find((s: { current: boolean }) => !s.current);

    await request(h.app)
      .delete(`/api/v1/auth/sessions/${other.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    await request(h.app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookieOf(phone))
      .expect(401);
    await request(h.app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookieOf(laptop))
      .expect(200);

    // Unknown, or someone else's: 404.
    const stranger = await register(h.app);
    await request(h.app)
      .delete(`/api/v1/auth/sessions/${current.id}`)
      .set(authHeader(stranger))
      .expect(404);
  });
});

describe('migration 003: existing users count as verified', () => {
  it('verifies users created before the field existed, and only those', async () => {
    const users = mongoose.connection.db!.collection('users');
    const created = new Date('2026-01-02T03:04:05Z');
    await users.insertOne({
      email: 'old@example.com',
      name: 'Old',
      passwordHash: 'x',
      role: 'USER',
      createdAt: created,
    });
    await users.insertOne({
      email: 'new@example.com',
      name: 'New',
      passwordHash: 'x',
      role: 'USER',
      createdAt: new Date(),
      emailVerifiedAt: null,
    });
    await migrate(mongoose.connection.db!, MIGRATIONS, createLogger('silent'));
    expect((await users.findOne({ email: 'old@example.com' }))!.emailVerifiedAt).toEqual(created);
    expect((await users.findOne({ email: 'new@example.com' }))!.emailVerifiedAt).toBeNull();
  });
});
