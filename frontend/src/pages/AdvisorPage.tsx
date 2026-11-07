import { ShieldCheck, Sparkles } from 'lucide-react';
import { CeoPanel } from '../components/dashboard/CeoPanel';
import { PanelBoundary } from '../components/feedback/States';
import { useSimulationContext } from './SimulationLayout';

/** The AI Business Advisor: the AI CEO's analysis and questions, given the whole page. */
export function AdvisorPage() {
  const { simulation, turns, turnsError, reload } = useSimulationContext();
  return (
    <div className="advisor">
      <div className="advisor-main">
        <div className="advisor-id">
          <span className="advisor-mark" aria-hidden>
            <Sparkles size={18} />
          </span>
          <div>
            <h2 className="section-h">Brevio AI Advisor</h2>
            <p className="muted small">Your intelligent business strategy companion.</p>
          </div>
        </div>
        <PanelBoundary name="AI advisor">
          <CeoPanel
            simulationId={simulation.id}
            latest={turns.at(-1) ?? null}
            turnsError={turnsError}
            onRetryTurns={() => void reload()}
          />
        </PanelBoundary>
      </div>
      <aside className="card advisor-note">
        <h2>
          <ShieldCheck size={16} aria-hidden /> How the advisor works
        </h2>
        <p className="muted small">
          Every number comes from the simulation engine. The advisor reads the latest turn, explains
          what happened and suggests what to try; it never changes your financials. Decisions only
          take effect when you play the next month.
        </p>
        <p className="muted small">Try asking:</p>
        <ul className="prompt-list small">
          <li>How can I increase my revenue?</li>
          <li>Why did my profit decrease?</li>
          <li>Should I hire more employees?</li>
          <li>Is my pricing competitive?</li>
          <li>How should I allocate my marketing budget?</li>
          <li>What should my next strategic move be?</li>
        </ul>
      </aside>
    </div>
  );
}
