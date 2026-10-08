import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { authApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { Field, FormError } from '../components/Field';
import { PasswordField } from '../components/PasswordField';
import { Spinner } from '../components/feedback/States';

/** /verify-email?token=… — the link from the verification email. */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { user, updateUser } = useAuth();
  const [state, setState] = useState<'checking' | 'done' | 'failed'>('checking');
  const sent = useRef(false); // the token is single-use: never send it twice (StrictMode)

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const token = params.get('token') ?? '';
    authApi
      .verifyEmail(token)
      .then((verified) => {
        if (user && user.id === verified.id) updateUser(verified);
        setState('done');
      })
      .catch(() => setState('failed'));
  }, [params, user, updateUser]);

  return (
    <section className="card narrow" aria-live="polite">
      <h1>Confirm your email</h1>
      {state === 'checking' && <p className="muted">Checking your link…</p>}
      {state === 'done' && (
        <>
          <p>Your email is confirmed. You can now start simulations.</p>
          <Link className="button primary" to={user ? '/startups' : '/login'}>
            {user ? 'Go to your startups' : 'Log in'}
          </Link>
        </>
      )}
      {state === 'failed' && (
        <>
          <p className="form-error" role="alert">
            This link is invalid or has expired. Links work once and expire after a day.
          </p>
          <p className="muted">
            {user
              ? 'Use “Resend link” in the banner above to get a new one.'
              : 'Log in to request a new link.'}
          </p>
        </>
      )}
    </section>
  );
}

/** Code lifetime and attempts as the API applies them (shown to the user, not enforced here). */
export const CODE_MINUTES = 10;
const RESEND_SECONDS = 30;

type ResetStep = 'email' | 'code' | 'password' | 'done';

function errorText(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return `${fallback}. Check your connection and try again.`;
  if (err.code === 'WEAK_PASSWORD') {
    const rules = (err.details as { message: string }[]).map((d) => d.message);
    return `Password ${rules.join(', ')}.`;
  }
  return err.message;
}

/**
 * /forgot-password — reset by emailed one-time code, in three steps on one page:
 * 1. the email address (the answer never says whether it has an account);
 * 2. the 6-digit code from the email (expires in minutes; five wrong tries end it);
 * 3. the new password, twice. Setting it signs out every session.
 */
export function ForgotPasswordPage() {
  const { clear } = useAuth();
  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  // Each new step announces itself: focus moves to its heading (not on first arrival).
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(errorText(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      await authApi.requestPasswordReset(email.trim());
      setCode('');
      setStep('code');
      setResendIn(RESEND_SECONDS);
    }, 'Could not send the code');

  const verifyCode = () =>
    run(async () => {
      const result = await authApi.verifyResetCode(email.trim(), code);
      setResetToken(result.resetToken);
      setStep('password');
    }, 'Could not check the code');

  const setNewPassword = () => {
    if (password !== confirm) {
      setError('The passwords do not match. Type the same password twice.');
      return;
    }
    return run(async () => {
      await authApi.confirmPasswordReset({ token: resetToken, password });
      clear(); // every session, including this one, was signed out
      setStep('done');
    }, 'Could not set the password');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 'email') void sendCode();
    else if (step === 'code') void verifyCode();
    else if (step === 'password') void setNewPassword();
  };

  const steps: ResetStep[] = ['email', 'code', 'password'];
  const progress = (
    <ol className="progress" aria-label={`Step ${Math.min(steps.indexOf(step), 2) + 1} of 3`}>
      {steps.map((s, i) => (
        <li key={s} className={i <= steps.indexOf(step) || step === 'done' ? 'done' : ''} />
      ))}
    </ol>
  );

  if (step === 'done') {
    return (
      <section className="card narrow" aria-live="polite">
        {progress}
        <h1 ref={heading} tabIndex={-1}>
          Password changed
        </h1>
        <p>You have been signed out everywhere. Log in with your new password.</p>
        <Link className="button primary" to="/login">
          Log in
        </Link>
      </section>
    );
  }

  return (
    <form className="card narrow" onSubmit={submit} noValidate={step === 'code'}>
      {progress}
      {step === 'email' && (
        <>
          <h1 ref={heading} tabIndex={-1}>
            Reset your password
          </h1>
          <p className="muted">
            Enter your account&apos;s email. We will send a 6-digit code to confirm it is you.
          </p>
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
          <button className="primary" disabled={busy}>
            {busy && <Spinner />}
            Send code
          </button>
        </>
      )}

      {step === 'code' && (
        <>
          <h1 ref={heading} tabIndex={-1}>
            Enter the code
          </h1>
          <p className="muted">
            If an account exists for <strong>{email.trim()}</strong>, we emailed it a 6-digit code.
            It expires in {CODE_MINUTES} minutes, and five wrong tries cancel it.
          </p>
          <FormError message={error} />
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <Field label="6-digit code">
            <input
              className="otp-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </Field>
          <button className="primary" disabled={busy || code.length !== 6}>
            {busy && <Spinner />}
            Verify code
          </button>
          <div className="actions spread">
            <button
              type="button"
              className="link"
              disabled={busy || resendIn > 0}
              onClick={() =>
                void run(async () => {
                  await authApi.requestPasswordReset(email.trim());
                  setCode('');
                  setResendIn(RESEND_SECONDS);
                  setNotice('A new code is on its way. Earlier codes no longer work.');
                }, 'Could not send a new code')
              }
            >
              {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
            </button>
            <button
              type="button"
              className="link"
              onClick={() => {
                setStep('email');
                setError(null);
                setNotice(null);
              }}
            >
              Use a different email
            </button>
          </div>
        </>
      )}

      {step === 'password' && (
        <>
          <h1 ref={heading} tabIndex={-1}>
            Choose a new password
          </h1>
          <p className="muted">Code accepted. Setting a new password signs you out everywhere.</p>
          <FormError message={error} />
          <PasswordField
            label="New password"
            hint="At least 10 characters, with lower case, upper case and a digit."
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
          />
          <PasswordField
            label="Repeat the new password"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
          />
          <button className="primary" disabled={busy}>
            {busy && <Spinner />}
            Set new password
          </button>
        </>
      )}
      <p className="muted mt-12">
        <Link to="/login">Back to log in</Link>
      </p>
    </form>
  );
}

/** /auth/google/done — the API set the session cookie; restore the session and continue. */
export function GoogleDonePage() {
  const { resume } = useAuth();
  const navigate = useNavigate();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    resume().then((ok) => navigate(ok ? '/startups' : '/login?error=google', { replace: true }));
  }, [resume, navigate]);
  return <p className="muted center">Signing you in…</p>;
}
