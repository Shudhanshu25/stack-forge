import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { GoogleButton } from '../components/AccountNotices';
import { Field, FormError } from '../components/Field';
import { PasswordField } from '../components/PasswordField';

export function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    if (form.password !== form.confirm) {
      // Caught here: a typo would otherwise become the account's password.
      setFieldErrors({ '/confirm': 'The passwords do not match. Type the same password twice.' });
      setBusy(false);
      return;
    }
    try {
      // GuestOnly sends the new user to the creation wizard once signed in.
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.code === 'WEAK_PASSWORD') {
          const rules = (err.details as { message: string }[]).map((d) => d.message);
          setFieldErrors({ '/password': `Password ${rules.join(', ')}.` });
        } else {
          setFieldErrors(err.fieldMessages());
        }
      } else {
        setError('Registration failed');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>Create your account</h1>
      <FormError message={error} />
      <Field label="Your name" error={fieldErrors['/name']}>
        <input
          autoComplete="name"
          required
          maxLength={100}
          value={form.name}
          onChange={set('name')}
        />
      </Field>
      <Field label="Email" error={fieldErrors['/email']}>
        <input
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={set('email')}
        />
      </Field>
      <PasswordField
        label="Password"
        autoComplete="new-password"
        error={fieldErrors['/password']}
        hint="At least 10 characters with upper case, lower case and a digit."
        value={form.password}
        onChange={(password) => setForm({ ...form, password })}
      />
      <PasswordField
        label="Repeat the password"
        autoComplete="new-password"
        error={fieldErrors['/confirm']}
        value={form.confirm}
        onChange={(confirm) => setForm({ ...form, confirm })}
      />
      <button className="primary" disabled={busy}>
        {busy ? 'Creating account…' : 'Create account'}
      </button>
      <GoogleButton label="Sign up with Google" />
      <p className="muted">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}
