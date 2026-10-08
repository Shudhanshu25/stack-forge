import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LlmUsageSummary, Session } from '@stackforge/shared';
import { ApiError } from '../api/client';
import { accountApi, authApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { Field, FormError } from '../components/Field';
import { TableSkeleton } from '../components/feedback/Skeletons';
import { ErrorState, Spinner } from '../components/feedback/States';
import { useToast } from '../components/feedback/Toaster';

const CONFIRM = 'DELETE MY ACCOUNT';
const when = (iso: string) =>
  new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function SessionsCard() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoadError(null);
    authApi
      .sessions()
      .then(setSessions)
      .catch((err: unknown) =>
        setLoadError(err instanceof ApiError ? err.message : 'Check your connection and retry.'),
      );
  }, []);
  useEffect(load, [load]);

  async function revoke(id: string) {
    setError(null);
    try {
      await authApi.revokeSession(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign that session out');
    }
  }

  return (
    <section className="card" aria-labelledby="sessions-title">
      <h2 id="sessions-title">Signed-in devices</h2>
      <FormError message={error} />
      {loadError ? (
        <ErrorState
          card={false}
          title="Devices could not be loaded"
          message={loadError}
          onRetry={load}
        />
      ) : !sessions ? (
        <TableSkeleton label="Loading signed-in devices" />
      ) : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Active sessions">
          <table>
            <caption className="sr-only">Active sessions</caption>
            <thead>
              <tr>
                <th scope="col">Device</th>
                <th scope="col">Signed in</th>
                <th scope="col">Last used</th>
                <th scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.device}
                    {s.current && <span className="badge">This device</span>}
                  </td>
                  <td>{when(s.signedInAt)}</td>
                  <td>{when(s.lastUsedAt)}</td>
                  <td>
                    {!s.current && (
                      <button
                        type="button"
                        className="link"
                        onClick={() => revoke(s.id)}
                        aria-label={`Sign out ${s.device}, last used ${when(s.lastUsedAt)}`}
                      >
                        Sign out
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function UsageCard() {
  const [usage, setUsage] = useState<LlmUsageSummary | null>(null);
  useEffect(() => {
    accountApi
      .llmUsage()
      .then(setUsage)
      .catch(() => setUsage(null));
  }, []);
  if (!usage) return null;
  return (
    <section className="card" aria-labelledby="usage-title">
      <h2 id="usage-title">AI usage today</h2>
      {usage.dailyQuota ? (
        <>
          <p>
            {usage.usedToday.toLocaleString('en-IN')} of {usage.dailyQuota.toLocaleString('en-IN')}{' '}
            tokens used. Resets {when(usage.resetsAt)}.
          </p>
          <meter
            className="meter"
            min={0}
            max={usage.dailyQuota}
            value={Math.min(usage.usedToday, usage.dailyQuota)}
            aria-label="Share of today's AI quota used"
          />
          {usage.exhausted && (
            <p role="status">
              The quota is used up: turns run on rule-based agents and the AI CEO is unavailable
              until the reset.
            </p>
          )}
        </>
      ) : (
        <p>{usage.usedToday.toLocaleString('en-IN')} tokens used today. No daily limit is set.</p>
      )}
    </section>
  );
}

function DataCard() {
  const { user, clear } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { notify } = useToast();

  async function exportData() {
    setExporting(true);
    try {
      await accountApi.exportData();
      notify({
        kind: 'success',
        title: 'Your data export is ready',
        body: 'Saved to your downloads as JSON.',
      });
    } catch (err) {
      notify({
        kind: 'error',
        title: 'Your data could not be exported',
        body: err instanceof ApiError ? err.message : 'Check your connection and try again.',
      });
    } finally {
      setExporting(false);
    }
  }

  async function remove(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await accountApi.remove({
        confirm: CONFIRM,
        ...(user?.hasPassword ? { password } : {}),
      });
      clear();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the account');
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="data-title">
      <h2 id="data-title">Your data</h2>
      <p>
        Download everything we store about you as JSON: your profile, startups, simulations, every
        turn, AI CEO answers, sessions and AI usage. See the <Link to="/privacy">privacy page</Link>{' '}
        for what is stored and why.
      </p>
      <button type="button" onClick={exportData} disabled={exporting}>
        {exporting && <Spinner />}
        Download my data
      </button>

      <form className="danger-zone" onSubmit={remove}>
        <h3>Delete account</h3>
        <p>
          Deletes your account, startups, simulations and AI CEO answers, and signs you out
          everywhere. This cannot be undone. Only anonymous totals (such as the number of turns
          played on the platform) are kept.
        </p>
        <FormError message={error} />
        {user?.hasPassword && (
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        <Field label={`Type ${CONFIRM} to confirm`}>
          <input
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <button className="danger" disabled={busy || confirm !== CONFIRM}>
          {busy && <Spinner />}
          {busy ? 'Deleting' : 'Delete my account'}
        </button>
      </form>
    </section>
  );
}

/** /account — profile, AI usage, sessions, export and deletion. */
export function AccountPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Account</h1>
      </div>
      <section className="card" aria-labelledby="profile-title">
        <h2 id="profile-title">Profile</h2>
        <dl className="facts">
          <dt>Name</dt>
          <dd>{user.name}</dd>
          <dt>Email</dt>
          <dd>
            {user.email}{' '}
            {user.emailVerified ? (
              <span className="badge">Confirmed</span>
            ) : (
              <span className="badge warn">Not confirmed</span>
            )}
          </dd>
          <dt>Sign-in</dt>
          <dd>
            {[user.hasPassword && 'Password', user.googleLinked && 'Google']
              .filter(Boolean)
              .join(' and ')}
            {!user.hasPassword && (
              <>
                {' '}
                (<Link to="/forgot-password">set a password</Link>)
              </>
            )}
          </dd>
        </dl>
      </section>
      <UsageCard />
      <SessionsCard />
      <DataCard />
    </div>
  );
}
