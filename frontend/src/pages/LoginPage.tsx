import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { GoogleButton } from '../components/AccountNotices';
import { Field, FormError } from '../components/Field';
import { PasswordField } from '../components/PasswordField';

/** What a failed login means and what to do about it. */
export function loginErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Login failed. Check your connection and try again.';
  if (err.code === 'INVALID_CREDENTIALS') {
    return 'That email and password do not match an account. Check the email address, look for typos (use Show to see the password) and Caps Lock, or reset your password below.';
  }
  if (err.code === 'RATE_LIMITED') {
    // The server says how long to wait; resetting the password is never blocked by this.
    return `${err.message} You can reset your password below in the meantime.`;
  }
  return err.message;
}

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(
    params.get('error') === 'google' ? 'Google sign-in did not complete. Try again.' : null,
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login({ email: email.trim(), password }); // GuestOnly redirects once signed in
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>Log in</h1>
      <FormError message={error} />
      <Field label="Email">
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <PasswordField
        label="Password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />
      <button className="primary" disabled={busy}>
        {busy ? 'Logging in…' : 'Log in'}
      </button>
      <p className="muted">
        <Link to="/forgot-password">Forgot your password?</Link>
      </p>
      <GoogleButton />
      <p className="muted">
        New here? <Link to="/register">Create an account</Link>
      </p>
    </form>
  );
}
