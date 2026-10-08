// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { ForgotPasswordPage } from './AccountFlowPages';

const api = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  verifyResetCode: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));
const clear = vi.fn();
vi.mock('../api/endpoints', () => ({ authApi: api }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ clear }) }));

const input = (label: string | RegExp) =>
  screen.getByLabelText(label, { selector: 'input' }) as HTMLInputElement;
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(input(label), { target: { value } });
const click = (name: string | RegExp) =>
  act(async () => fireEvent.click(screen.getByRole('button', { name })));
const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.requestPasswordReset.mockResolvedValue(undefined);
  clear.mockReset();
  render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
});
afterEach(cleanup);

async function toCodeStep() {
  type('Email', ' asha@example.com ');
  await click('Send code');
  expect(api.requestPasswordReset).toHaveBeenCalledWith('asha@example.com');
  expect(heading()).toBe('Enter the code');
}

describe('forgot password by emailed code', () => {
  it('walks email → code → new password → done', async () => {
    await toCodeStep();
    api.verifyResetCode.mockResolvedValue({
      resetToken: 'reset-token-123456789012',
      expiresInSeconds: 1800,
    });
    type('6-digit code', '04 21-73');
    expect(input('6-digit code').value).toBe('042173'); // digits only
    await click('Verify code');
    expect(api.verifyResetCode).toHaveBeenCalledWith('asha@example.com', '042173');
    expect(heading()).toBe('Choose a new password');

    type(/^New password$/, 'New-Password-123');
    type(/^Repeat the new password$/, 'New-Password-123');
    api.confirmPasswordReset.mockResolvedValue(undefined);
    await click('Set new password');
    expect(api.confirmPasswordReset).toHaveBeenCalledWith({
      token: 'reset-token-123456789012',
      password: 'New-Password-123',
    });
    expect(clear).toHaveBeenCalled();
    expect(heading()).toBe('Password changed');
  });

  it('cannot verify until six digits are entered', async () => {
    await toCodeStep();
    type('6-digit code', '123');
    expect(
      (screen.getByRole('button', { name: 'Verify code' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('shows a wrong code and stays on the code step', async () => {
    await toCodeStep();
    api.verifyResetCode.mockRejectedValue(
      new ApiError(400, 'INVALID_CODE', 'That code is not valid or has expired.', null),
    );
    type('6-digit code', '111111');
    await click('Verify code');
    expect(screen.getByRole('alert').textContent).toContain('not valid or has expired');
    expect(heading()).toBe('Enter the code');
  });

  it('a new code can be requested after a short wait', async () => {
    vi.useFakeTimers();
    try {
      await toCodeStep();
      const resend = screen.getByRole('button', {
        name: /Send a new code in/,
      }) as HTMLButtonElement;
      expect(resend.disabled).toBe(true);
      for (let i = 0; i < 31; i++) await act(async () => vi.advanceTimersByTime(1000));
      await click('Send a new code');
      expect(api.requestPasswordReset).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('status').textContent).toMatch(/Earlier codes no longer work/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses mismatched new passwords without calling the API', async () => {
    await toCodeStep();
    api.verifyResetCode.mockResolvedValue({
      resetToken: 'reset-token-123456789012',
      expiresInSeconds: 1800,
    });
    type('6-digit code', '123456');
    await click('Verify code');
    type(/^New password$/, 'New-Password-123');
    type(/^Repeat the new password$/, 'New-Password-124');
    await click('Set new password');
    expect(api.confirmPasswordReset).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/do not match/);
  });
});
