import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './client';

const reply = (status: number, body = '') =>
  vi.fn(async () => new Response(body || null, { status }));

afterEach(() => vi.unstubAllGlobals());

describe('api client responses', () => {
  it('treats an empty 202 Accepted as success (password reset, resend confirmation)', async () => {
    vi.stubGlobal('fetch', reply(202));
    await expect(
      api('/auth/password-reset', { method: 'POST', body: {} }),
    ).resolves.toBeUndefined();
  });

  it('treats 204 No Content as success', async () => {
    vi.stubGlobal('fetch', reply(204));
    await expect(api('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('parses JSON bodies', async () => {
    vi.stubGlobal('fetch', reply(200, '{"ok":true}'));
    await expect(api('/x')).resolves.toEqual({ ok: true });
  });

  it('turns error bodies into ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      reply(400, '{"error":{"code":"INVALID_CODE","message":"Bad code","details":null}}'),
    );
    await expect(api('/auth/password-reset/verify')).rejects.toMatchObject({
      code: 'INVALID_CODE',
      status: 400,
    });
    await expect(api('/auth/password-reset/verify')).rejects.toBeInstanceOf(ApiError);
  });
});
