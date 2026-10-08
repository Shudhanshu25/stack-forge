import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * An empty state: what will appear here, and the one action that fills it. A card of its own
 * by default; with card={false} it sits inside an existing panel.
 */
export function EmptyState({
  title,
  children,
  action,
  card = true,
  headingLevel = 2,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  card?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section className={`state ${card ? 'card centered' : 'inline'}`} data-state="empty">
      <Heading>{title}</Heading>
      <p>{children}</p>
      {action && <div className="actions">{action}</div>}
    </section>
  );
}

/** A panel that failed to load: says what failed and offers a retry, without blanking the page. */
export function ErrorState({
  title,
  message,
  onRetry,
  card = true,
}: {
  title: string;
  message?: string | null;
  onRetry?: () => void;
  card?: boolean;
}) {
  return (
    <section className={`state error ${card ? 'card' : ''}`} role="alert" data-state="error">
      <h2>✕ {title}</h2>
      {message && <p>{message}</p>}
      {onRetry && (
        <div className="actions flush">
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
    </section>
  );
}

/** Contains a rendering failure to one panel, with a retry that renders it again. */
export class PanelBoundary extends Component<
  { name: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Panel "${this.props.name}" failed to render`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <ErrorState
        title={`${this.props.name} could not be shown`}
        message="Something went wrong while showing this panel. The rest of the page still works."
        onRetry={() => this.setState({ failed: false })}
      />
    );
  }
}

/** A spinner, only ever inside a busy button next to its label. */
export function Spinner() {
  return <span className="spinner" aria-hidden />;
}
