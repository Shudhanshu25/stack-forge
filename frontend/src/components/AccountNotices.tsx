import { useEffect, useState } from 'react';
import type { LlmUsageSummary } from '@stackforge/shared';
import { ApiError } from '../api/client';
import { accountApi, authApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

/** "Continue with Google", shown only when the deployment has Google sign-in configured. */
export function GoogleButton({ label = 'Continue with Google' }: { label?: string }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    authApi
      .options()
      .then((o) => setEnabled(o.google))
      .catch(() => setEnabled(false));
  }, []);
  if (!enabled) return null;
  return (
    <a className="button secondary google" href={authApi.googleStartUrl()}>
      {label}
    </a>
  );
}

/** Until the email is confirmed the user can look around but not start simulations. */
export function VerifyEmailBanner() {
  const { user } = useAuth();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  if (!user || user.emailVerified) return null;

  async function resend() {
    setState('sending');
    try {
      await authApi.resendVerification();
      setState('sent');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="notice banner" role="status">
      <span>
        Confirm your email address to start simulations. We sent a link to{' '}
        <strong>{user.email}</strong>.
      </span>
      {state === 'sent' ? (
        <span className="muted">A new link is on its way.</span>
      ) : (
        <button type="button" className="link" onClick={resend} disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : state === 'error' ? 'Try again' : 'Resend link'}
        </button>
      )}
    </div>
  );
}

/**
 * Shown on the dashboard once the daily AI quota is used up: turns still run, on rule-based
 * agents, and the AI CEO is unavailable until the reset.
 */
export function QuotaNotice({ exhaustedOnLastTurn }: { exhaustedOnLastTurn: boolean }) {
  const [usage, setUsage] = useState<LlmUsageSummary | null>(null);
  useEffect(() => {
    accountApi
      .llmUsage()
      .then(setUsage)
      .catch((err: unknown) => {
        if (!(err instanceof ApiError)) throw err;
      });
  }, [exhaustedOnLastTurn]);
  if (!usage?.exhausted && !exhaustedOnLastTurn) return null;
  const resets = usage
    ? new Date(usage.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <div className="notice banner" role="status">
      <span>
        <strong>Daily AI quota reached.</strong> Turns run on rule-based customer and competitor
        agents, and the AI CEO is unavailable{resets ? ` until ${resets}` : ' until tomorrow'}.
      </span>
    </div>
  );
}
