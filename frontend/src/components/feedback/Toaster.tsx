import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onNetworkChange, probeApi } from '../../api/client';

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

export interface ToastInput {
  kind: ToastKind;
  title: string;
  body?: string;
  /** A toast with the same key replaces the previous one (e.g. offline, then back online). */
  key?: string;
}

interface Toast extends ToastInput {
  id: number;
}

interface Toasts {
  notify: (toast: ToastInput) => void;
  dismiss: (key: string) => void;
}

/** How long a non-error toast stays; errors stay until dismissed. */
export const TOAST_MS = 6000;
const MAX_VISIBLE = 4;
const PROBE_MS = 5000;
const ICONS: Record<ToastKind, string> = { success: '✓', info: 'i', warning: '!', error: '✕' };

const ToastContext = createContext<Toasts | null>(null);

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (toast.kind === 'error' || paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast.kind, toast.id, paused, onDismiss]);
  return (
    <div
      className={`toast ${toast.kind}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast-icon" aria-hidden>
        {ICONS[toast.kind]}
      </span>
      <div>
        <strong>{toast.title}</strong>
        {toast.body && <p>{toast.body}</p>}
      </div>
      <button
        type="button"
        className="close"
        onClick={() => onDismiss(toast.id)}
        aria-label={`Dismiss: ${toast.title}`}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Toast notifications. Errors go in an assertive live region and persist until dismissed;
 * the rest are announced politely and leave after a few seconds (paused while hovered or
 * focused). The stack sits over the right-hand column, clear of the decision panel.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const notify = useCallback((input: ToastInput) => {
    setToasts((list) => {
      const kept = input.key ? list.filter((t) => t.key !== input.key) : list;
      const next = [...kept, { ...input, id: nextId.current++ }];
      // Over the limit, the oldest non-error toasts go first.
      while (next.length > MAX_VISIBLE) {
        const i = next.findIndex((t) => t.kind !== 'error');
        next.splice(i === -1 ? 0 : i, 1);
      }
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);
  const dismiss = useCallback((key: string) => {
    setToasts((list) => list.filter((t) => t.key !== key));
  }, []);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);
  const render = (kind: 'errors' | 'others') =>
    toasts
      .filter((t) => (t.kind === 'error') === (kind === 'errors'))
      .map((t) => <ToastItem key={t.id} toast={t} onDismiss={remove} />);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <section className="toasts" aria-label="Notifications">
        <div role="alert">{render('errors')}</div>
        <div role="status" aria-live="polite">
          {render('others')}
        </div>
      </section>
      <NetworkWatcher notify={notify} />
    </ToastContext.Provider>
  );
}

export function useToast(): Toasts {
  const toasts = useContext(ToastContext);
  if (!toasts) throw new Error('useToast must be used inside ToastProvider');
  return toasts;
}

/** Network loss (browser offline, or the API unreachable) and recovery. */
function NetworkWatcher({ notify }: { notify: (toast: ToastInput) => void }) {
  const down = useRef(false);
  useEffect(() => {
    const change = (online: boolean) => {
      if (online === !down.current) return;
      down.current = !online;
      notify(
        online
          ? { key: 'network', kind: 'success', title: 'Back online' }
          : {
              key: 'network',
              kind: 'error',
              title: 'Connection lost',
              body: 'Nothing can be saved until the connection returns. This updates by itself.',
            },
      );
    };
    const offline = () => change(false);
    const online = () => change(true);
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    const stop = onNetworkChange(change);
    // While the API is unreachable, check every few seconds so recovery is announced promptly.
    const probe = setInterval(() => {
      if (down.current) void probeApi();
    }, PROBE_MS);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      clearInterval(probe);
      stop();
    };
  }, [notify]);
  return null;
}
