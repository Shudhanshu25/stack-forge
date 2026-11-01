import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { GuestHeader } from './AppShell';

/**
 * Sign-in, sign-up and account recovery: a branded panel beside the form on wide screens, the
 * form alone on phones. The panel is decoration; everything it says is repeated nowhere that
 * matters, so it is hidden from assistive technology.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-art" aria-hidden>
        <div className="auth-grid" />
        <div className="auth-art-inner">
          <div className="auth-preview card">
            <div className="auth-preview-head">
              <span className="muted small">Revenue · this month</span>
              <span className="pill good">+13.6%</span>
            </div>
            <div className="auth-preview-value num">₹12,50,000</div>
            <svg viewBox="0 0 400 80" preserveAspectRatio="none" className="auth-spark">
              <path d="M0 70 C40 66 70 58 110 60 C150 62 170 44 210 42 C250 40 270 30 310 24 C350 18 370 12 400 6" />
            </svg>
          </div>
          <div className="auth-insight card">
            <span className="auth-insight-icon">
              <Sparkles size={16} />
            </span>
            <span>A ₹100 price rise is projected to add ₹62,000 of monthly profit.</span>
          </div>
          <p className="auth-quote">Every great company starts with a first decision.</p>
          <p className="muted">Practise yours in a simulator that runs on real market data.</p>
        </div>
      </aside>
      <div className="auth-side">
        <GuestHeader />
        <main className="auth-form" id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
