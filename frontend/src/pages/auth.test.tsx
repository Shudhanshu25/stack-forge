// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { LoginPage, loginErrorMessage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

const auth = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../components/AccountNotices', () => ({ GoogleButton: () => null }));

const page = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { selector: 'input' }), { target: { value } });
const submit = (name: string) =>
  act(async () => fireEvent.click(screen.getByRole('button', { name })));

beforeEach(() => {
  auth.login.mockReset();
  auth.register.mockReset();
});
afterEach(cleanup);

describe('register', () => {
  function fill(password: string, confirm: string) {
    page(<RegisterPage />);
    type('Your name', 'Asha');
    type('Email', 'asha@example.com');
    type(/^Password$/, password);
    type('Repeat the password', confirm);
  }

  it('does not create the account when the two passwords differ', async () => {
    fill('Correct-Horse-42', 'Correct-Hrose-42');
    await submit('Create account');
    expect(auth.register).not.toHaveBeenCalled();
    expect(screen.getByText(/passwords do not match/i)).toBeTruthy();
  });

  it('sends the password exactly as typed when both match', async () => {
    fill('Correct-Horse-42', 'Correct-Horse-42');
    await submit('Create account');
    expect(auth.register).toHaveBeenCalledWith({
      name: 'Asha',
      email: 'asha@example.com',
      password: 'Correct-Horse-42',
    });
  });

  it('can show the password to check it for typos', () => {
    page(<RegisterPage />);
    const input = screen.getByLabelText(/^Password$/, { selector: 'input' }) as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input.type).toBe('password');
  });
});

describe('login', () => {
  it('warns when Caps Lock is on', () => {
    page(<LoginPage />);
    const input = screen.getByLabelText(/^Password$/, { selector: 'input' });
    // Keyboard events carry the modifier state (KeyboardEventInit.modifierCapsLock).
    fireEvent.keyUp(input, { key: 'A', modifierCapsLock: true });
    expect(screen.getByText(/Caps Lock is on/)).toBeTruthy();
  });

  it('explains a wrong email or password and points to the reset', async () => {
    auth.login.mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect', null),
    );
    page(<LoginPage />);
    type('Email', ' Asha@Example.com ');
    type(/^Password$/, 'Correct-Horse-42');
    await submit('Log in');
    expect(auth.login).toHaveBeenCalledWith({
      email: 'Asha@Example.com',
      password: 'Correct-Horse-42',
    });
    expect(screen.getByRole('alert').textContent).toMatch(/reset your password/);
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toBeTruthy();
  });

  it('says how long to wait after too many attempts', () => {
    const message = loginErrorMessage(
      new ApiError(429, 'RATE_LIMITED', 'Too many sign-in attempts. Try again in 12 minutes.', {
        action: 'sign-in',
        retryAfterSeconds: 700,
      }),
    );
    expect(message).toMatch(/Try again in 12 minutes/);
    expect(message).toMatch(/reset your password/);
  });
});
