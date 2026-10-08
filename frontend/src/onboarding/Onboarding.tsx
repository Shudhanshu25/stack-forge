import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

/** The first-launch walkthrough, in the order the specification lists. */
export const TOUR_STEPS = [
  {
    id: 'create',
    target: 'wizard',
    title: 'Create your startup',
    text: 'Name it, pick an industry and a city, and keep or adjust the starting numbers. Each industry comes with realistic defaults; the city changes your costs and, for local businesses, your market (see "Why location matters").',
  },
  {
    id: 'pricing',
    target: 'pricing',
    title: 'Set your price',
    text: 'Price decides how many customers choose you and how much each pays. Keep it or change it.',
  },
  {
    id: 'marketing',
    target: 'marketing',
    title: 'Allocate marketing',
    text: 'The monthly marketing budget buys new customers and builds brand awareness. Try something like ₹50,000.',
  },
  {
    id: 'hiring',
    target: 'hiring',
    title: 'Hire',
    text: 'Employees serve customers and keep product quality up, but each costs a monthly salary. Raise the headcount if you can afford it.',
  },
  {
    id: 'play',
    target: 'play',
    title: 'Play the turn and watch the market react',
    text: 'Press Play turn. Customers, competitors, events and the financial model are processed live, step by step.',
  },
  {
    id: 'analyze',
    target: 'analyze',
    title: 'Analyze your results',
    text: 'KPI cards show the change since last month; the market panel shows how customers and competitors reacted; the AI CEO explains why. Hover underlined terms such as CAC or runway for definitions.',
  },
] as const;

export type TourStepId = (typeof TOUR_STEPS)[number]['id'];

interface Tour {
  active: boolean;
  stepId: TourStepId | null;
  /** Moves on if the tour is currently at `stepId` (no-op otherwise). */
  advance: (stepId: TourStepId) => void;
  finish: () => Promise<void>;
  restart: () => void;
}

const TourContext = createContext<Tour | null>(null);
const storageKey = (userId: string) => `sf-tour-step-${userId}`;

function readStep(userId: string): number {
  try {
    return Number(localStorage.getItem(storageKey(userId)) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(0);
  const [restarted, setRestarted] = useState(false);
  const active = Boolean(user && (!user.onboardingCompleted || restarted));

  useEffect(() => {
    if (user) setStep(readStep(user.id));
  }, [user]);

  const save = useCallback(
    (next: number) => {
      setStep(next);
      try {
        if (user) localStorage.setItem(storageKey(user.id), String(next));
      } catch {
        // Storage unavailable: progress lasts for this page only.
      }
    },
    [user],
  );

  const finish = useCallback(async () => {
    setRestarted(false);
    save(0);
    if (user && !user.onboardingCompleted) updateUser(await authApi.completeOnboarding());
  }, [user, save, updateUser]);

  const value = useMemo<Tour>(
    () => ({
      active,
      stepId: active ? (TOUR_STEPS[Math.min(step, TOUR_STEPS.length - 1)]!.id as TourStepId) : null,
      advance: (stepId) => {
        if (active && TOUR_STEPS[step]?.id === stepId && step < TOUR_STEPS.length - 1)
          save(step + 1);
      },
      finish,
      restart: () => {
        save(0);
        setRestarted(true);
      },
    }),
    [active, step, save, finish],
  );
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): Tour {
  const tour = useContext(TourContext);
  if (!tour) throw new Error('useTour must be used inside OnboardingProvider');
  return tour;
}

/** The coach card: current step, what to do, and an outline around the relevant control. */
export function CoachPanel() {
  const tour = useTour();
  const location = useLocation();
  const index = TOUR_STEPS.findIndex((s) => s.id === tour.stepId);
  const step = TOUR_STEPS[index];

  useEffect(() => {
    if (!step) return;
    const mark = () => {
      document.querySelectorAll('.tour-target').forEach((el) => el.classList.remove('tour-target'));
      document.querySelector(`[data-tour="${step.target}"]`)?.classList.add('tour-target');
    };
    mark();
    const timer = setInterval(mark, 400); // targets mount after data loads
    return () => {
      clearInterval(timer);
      document.querySelectorAll('.tour-target').forEach((el) => el.classList.remove('tour-target'));
    };
  }, [step, location.pathname]);

  if (!step) return null;
  const onDashboard = /^\/simulations\/[^/]+$/.test(location.pathname);
  const needsDashboard = index > 0 && !onDashboard;
  const isFieldStep = step.id === 'pricing' || step.id === 'marketing' || step.id === 'hiring';

  return (
    <aside className="coach" role="dialog" aria-label="Getting started">
      <div className="step">
        Getting started · step {index + 1} of {TOUR_STEPS.length}
      </div>
      <h2>{step.title}</h2>
      <p>{step.text}</p>
      {step.id === 'create' && location.pathname !== '/startups/new' && (
        <p>
          <Link to="/startups/new">Open the startup wizard</Link>
        </p>
      )}
      {needsDashboard && (
        <p>Open your startup&apos;s dashboard from the startups page (Play) to continue.</p>
      )}
      <div className="actions">
        <button type="button" className="link" onClick={() => void tour.finish()}>
          Skip tour
        </button>
        {isFieldStep && (
          <button type="button" onClick={() => tour.advance(step.id)}>
            Next
          </button>
        )}
        {step.id === 'analyze' && (
          <button type="button" className="primary" onClick={() => void tour.finish()}>
            Finish
          </button>
        )}
      </div>
    </aside>
  );
}
