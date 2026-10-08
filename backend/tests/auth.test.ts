import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { UserModel } from '../src/modules/auth/user.model.js';
import { STRONG_PASSWORD, refreshCookieOf, register, testApp, uniqueEmail } from './helpers.js';

const app = testApp();

describe('registration', () => {
  it('creates a user, returns an access token and sets an httpOnly refresh cookie', async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: STRONG_PASSWORD, name: 'Asha' })
      .expect(201);

    expect(res.body.user).toMatchObject({ email, name: 'Asha', role: 'USER' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.accessToken).toEqual(expect.any(String));
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';');
    expect(cookie).toMatch(/sf_refresh=.+HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);

    const stored = await UserModel.findOne({ email });
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects a duplicate email, ignoring case', async () => {
    const { email } = await register(app);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: email.toUpperCase(), password: STRONG_PASSWORD, name: 'Again' })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a weak password and names each broken rule', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail(), password: 'password', name: 'Weak' })
      .expect(400);
    expect(res.body.error.code).toBe('WEAK_PASSWORD');
    const messages = res.body.error.details.map((d: { message: string }) => d.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        'must be at least 10 characters',
        'must contain an upper-case letter',
        'must contain a digit',
      ]),
    );
  });

  it('rejects an invalid email format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: STRONG_PASSWORD, name: 'X' })
      .expect(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(res.body.error.details[0].path).toBe('/email');
  });
});

describe('login', () => {
  it('logs in with correct credentials', async () => {
    const { email } = await register(app);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: STRONG_PASSWORD })
      .expect(200);
    expect(res.body.user.email).toBe(email);
    expect(refreshCookieOf(res)).toMatch(/^sf_refresh=/);
  });

  it('rejects a wrong password and an unknown email with the same error', async () => {
    const { email } = await register(app);
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Wrong-Password-1' })
      .expect(401);
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: STRONG_PASSWORD })
      .expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.error).toEqual(wrong.body.error);
  });

  it('rejects MongoDB operator injection', async () => {
    await register(app);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('protected endpoints', () => {
  it('returns the current user with a valid token', async () => {
    const user = await register(app);
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(user.email);
  });

  it('rejects a request without a token', async () => {
    const res = await request(app).get('/api/v1/startups').expect(401);
    expect(res.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required', details: null },
    });
  });

  it('rejects an expired token with TOKEN_EXPIRED', async () => {
    const user = await register(app);
    const expired = jwt.sign({ role: 'USER' }, process.env.JWT_ACCESS_SECRET!, {
      subject: user.body.user.id,
      issuer: 'stack-forge',
      audience: 'stack-forge-api',
      expiresIn: -10,
    });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a token signed with another secret', async () => {
    const forged = jwt.sign({ role: 'ADMIN' }, 'some-other-secret-of-at-least-32-characters!', {
      subject: '000000000000000000000000',
      issuer: 'stack-forge',
      audience: 'stack-forge-api',
    });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('refresh token rotation', () => {
  it('issues a new refresh token and rejects reuse of the old one, revoking the family', async () => {
    const user = await register(app);

    const first = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', user.refreshCookie)
      .expect(200);
    const rotated = refreshCookieOf(first);
    expect(rotated).not.toBe(user.refreshCookie);
    expect(first.body.accessToken).toEqual(expect.any(String));

    // Replaying the old token is treated as theft: rejected, and the whole family revoked.
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', user.refreshCookie)
      .expect(401);
    expect(replay.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    await request(app).post('/api/v1/auth/refresh').set('Cookie', rotated).expect(401);
  });

  it('rejects a refresh without a cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').expect(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

describe('logout', () => {
  it('revokes the refresh token and clears the cookie', async () => {
    const user = await register(app);
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', user.refreshCookie)
      .expect(204);
    expect(([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';')).toMatch(
      /sf_refresh=;/,
    );
    await request(app).post('/api/v1/auth/refresh').set('Cookie', user.refreshCookie).expect(401);
  });
});

describe('request hardening', () => {
  it('rate limits credential endpoints', async () => {
    const limited = testApp({ authRateLimitMax: 3 });
    for (let i = 0; i < 3; i++) {
      await request(limited)
        .post('/api/v1/auth/login')
        .send({ email: 'a@example.com', password: 'x' })
        .expect(401);
    }
    const res = await request(limited)
      .post('/api/v1/auth/login')
      .send({ email: 'a@example.com', password: 'x' })
      .expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error.message).toMatch(
      /Too many sign-in attempts\. Try again in \d+ minutes?\./,
    );
    expect(res.body.error.details).toMatchObject({ action: 'sign-in' });
    expect(res.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(Number(res.headers['retry-after'])).toBe(res.body.error.details.retryAfterSeconds);
  });

  it('failed logins never block the password reset that recovers from them', async () => {
    const limited = testApp({ authRateLimitMax: 3 });
    for (let i = 0; i < 4; i++) {
      await request(limited)
        .post('/api/v1/auth/login')
        .send({ email: 'locked@example.com', password: 'wrong' });
    }
    await request(limited)
      .post('/api/v1/auth/login')
      .send({ email: 'locked@example.com', password: 'wrong' })
      .expect(429);
    await request(limited)
      .post('/api/v1/auth/password-reset')
      .send({ email: 'locked@example.com' })
      .expect(202);
  });

  it('only failed logins count towards the sign-in limit', async () => {
    const limited = testApp({ authRateLimitMax: 2 });
    const user = await register(limited);
    for (let i = 0; i < 4; i++) {
      await request(limited)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: STRONG_PASSWORD })
        .expect(200);
    }
  });

  it('rejects oversized bodies', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail(), password: STRONG_PASSWORD, name: 'x'.repeat(200_000) })
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('allows CORS only from the frontend origin and sets security headers', async () => {
    const allowed = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['x-content-type-options']).toBe('nosniff');

    const other = await request(app).get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });
});
