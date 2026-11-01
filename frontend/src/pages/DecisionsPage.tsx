import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Megaphone, Package, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { DecisionPanel } from '../components/dashboard/DecisionPanel';
import { PanelBoundary } from '../components/feedback/States';
import { formatCount, formatInrCompact, formatPercent } from '../lib/format';
import { useSimulationContext } from './SimulationLayout';

function Lever({
  id,
  icon,
  title,
  children,
  note,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
  note: string;
}) {
  return (
    <section id={id} className="card lever" aria-labelledby={`${id}-title`}>
      <div className="lever-head">
        <span className="ic accent" aria-hidden>
          {icon}
        </span>
        <h2 id={`${id}-title`}>{title}</h2>
      </div>
      <dl className="lever-stats">{children}</dl>
      <p className="muted xs">{note}</p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}

/**
 * Product & Pricing, Team & Hiring and Marketing: where each lever stands this month (engine
 * figures from the latest turn) and the decision form that changes them for the next one.
 */
export function DecisionsPage() {
  const { simulation, runner } = useSimulationContext();
  const s = simulation.currentState;
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);
  return (
    <div className="stack">
      <div className="page-intro">
        <h2 className="section-h">Decisions for month {s.turn + 1}</h2>
        <p className="muted small">
          Set your levers, preview the effect, then play the month. The simulation engine computes
          every result; nothing here changes until the turn is played.
        </p>
      </div>
      <div className="three">
        <Lever
          id="pricing"
          icon={<Package size={16} />}
          title="Product & Pricing"
          note="Higher quality lifts satisfaction and supports a higher price."
        >
          <Stat label="Price" value={formatInrCompact(s.price)} />
          <Stat label="Product quality" value={formatPercent(s.productQuality, 0)} />
          <Stat label="Customer satisfaction" value={formatPercent(s.customerSatisfaction, 0)} />
        </Lever>
        <Lever
          id="hiring"
          icon={<Users size={16} />}
          title="Team & Hiring"
          note="Each hire adds a monthly salary from the next turn on."
        >
          <Stat label="Employees" value={formatCount(s.employees)} />
          <Stat label="Payroll this month" value={formatInrCompact(s.expenses.employees)} />
          <Stat label="Product spend" value={formatInrCompact(s.expenses.product)} />
        </Lever>
        <Lever
          id="marketing"
          icon={<Megaphone size={16} />}
          title="Marketing"
          note="Marketing buys new customers and builds brand awareness over time."
        >
          <Stat label="Monthly budget" value={formatInrCompact(s.marketingBudget)} />
          <Stat label="New customers" value={formatCount(s.newCustomers)} />
          <Stat label="Brand awareness" value={formatPercent(s.brandAwareness, 0)} />
        </Lever>
      </div>
      <PanelBoundary name="Decisions">
        <DecisionPanel simulation={simulation} runner={runner} />
      </PanelBoundary>
    </div>
  );
}
