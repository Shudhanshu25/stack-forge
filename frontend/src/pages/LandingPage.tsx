import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  RefreshCw,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import { GuestHeader } from '../components/shell/AppShell';
import { Logo } from '../components/shell/Logo';

const STEPS = [
  [
    'Create your startup',
    'Pick an industry, a city and your starting capital. Each industry template is calibrated on Indian market data.',
  ],
  [
    'Make strategic decisions',
    'Set your price, split the marketing budget, hire and invest in product quality.',
  ],
  [
    'Simulate the market',
    'The engine computes demand, churn, revenue and cash, then adds competitors and market shocks.',
  ],
  [
    'Learn and adapt',
    'The AI advisor explains what happened and why, so next month goes better than the last.',
  ],
] as const;

/** Plans. Only Explorer exists today; the others are announced without prices. */
const PLANS = [
  {
    name: 'Explorer',
    price: 'Free',
    desc: 'Everything you need to run your first startup.',
    feats: [
      'Create and run your own startups',
      'AI Business Advisor with a daily limit',
      'Dashboards, scenarios and reports',
    ],
    cta: 'Start building',
    featured: false,
  },
  {
    name: 'Founder',
    price: 'Coming soon',
    desc: 'For founders rehearsing real decisions.',
    feats: [
      'Everything in Explorer',
      'Higher daily AI limits',
      'LLM-driven market agents by default',
    ],
    cta: 'Join with a free account',
    featured: true,
  },
  {
    name: 'Campus',
    price: 'Contact us',
    desc: 'For instructors running a cohort.',
    feats: [
      'Shared seeded scenarios',
      'Every student faces the same market',
      'Compare strategies fairly',
    ],
    cta: 'Create an account',
    featured: false,
  },
] as const;

const FAQ = [
  [
    'Is any real money involved?',
    'No. Every rupee in Brevio is simulated. Go bankrupt, restart and try another strategy as often as you like.',
  ],
  [
    'How realistic is the simulation?',
    'Industry templates are calibrated on Indian market data for 20 cities: salaries, rent, acquisition costs and demand. The engine is deterministic, so results are reproducible and explainable.',
  ],
  [
    'Does the AI decide what happens?',
    'No. The simulation engine calculates every financial number. The AI reads those numbers, explains them and suggests decisions, which only take effect if you apply them.',
  ],
  [
    'Can I use Brevio in a classroom?',
    'Yes. Simulations are seeded, so a class can face the same market and compare results.',
  ],
  [
    'Can I stop and come back later?',
    'Yes. Every month is saved as a turn. Leave at any time and continue from where you stopped.',
  ],
] as const;

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="faq">
      {FAQ.map(([q, a], i) => (
        <div key={q} className="faq-item">
          <h3>
            <button
              type="button"
              aria-expanded={open === i}
              aria-controls={`faq-${i}`}
              onClick={() => setOpen(open === i ? -1 : i)}
            >
              {q}
              <ChevronDown size={18} aria-hidden className={open === i ? 'rot' : ''} />
            </button>
          </h3>
          {open === i && (
            <p id={`faq-${i}`} className="faq-a">
              {a}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/** The public home page: what Brevio is and a way in. */
export function LandingPage() {
  return (
    <div className="landing">
      <GuestHeader>
        <nav aria-label="Site" className="landing-nav hide-sm">
          <a href="#how">How it works</a>
          <a href="#advisor">AI Advisor</a>
          <a href="#plans">Plans</a>
          <a href="#faq">FAQ</a>
        </nav>
        <Link to="/login" className="button ghost hide-sm">
          Log in
        </Link>
        <Link to="/register" className="button primary">
          Start building
        </Link>
      </GuestHeader>
      <main id="main" tabIndex={-1}>
        <section className="hero">
          <span className="pill accent">
            <Sparkles size={13} aria-hidden /> Now with the AI Business Advisor
          </span>
          <h1>
            Build Your Startup. Test Your Decisions.{' '}
            <span className="accent-text">Master the Business.</span>
          </h1>
          <p className="hero-sub">
            Experience the challenges of entrepreneurship in an AI-powered startup simulator. Make
            strategic decisions, manage resources, and discover what it takes to build a successful
            business.
          </p>
          <div className="hero-ctas">
            <Link to="/register" className="button primary lg">
              Start building <ArrowRight size={16} aria-hidden />
            </Link>
            <a href="#how" className="button lg">
              Explore platform
            </a>
          </div>
          <p className="muted small">
            Free to start · No real money at risk · Same seed, same results
          </p>
          <div
            className="hero-preview card"
            role="img"
            aria-label="Preview of the Brevio dashboard: revenue, profit, cash and customers, a rising revenue chart and an AI insight"
          >
            <div className="hero-preview-bar" aria-hidden>
              <i />
              <i />
              <i />
              <span className="pill good">
                <span className="sim-live on" /> Month 8 · Auto-playing 2x
              </span>
            </div>
            <div className="hero-preview-body" aria-hidden>
              <div className="hero-kpis">
                {[
                  ['Revenue', '₹12.5 L', '+13.6%'],
                  ['Net profit', '₹4.7 L', '+30.6%'],
                  ['Cash', '₹25.0 L', '+7.8%'],
                  ['Customers', '1,250', '+16.2%'],
                ].map(([l, v, d]) => (
                  <div key={l} className="well">
                    <div className="muted xs">{l}</div>
                    <div className="hero-kpi num">{v}</div>
                    <span className="pill good">{d}</span>
                  </div>
                ))}
              </div>
              <div className="hero-row">
                <div className="well hero-chart">
                  <div className="muted xs">Revenue · last 8 months</div>
                  <svg viewBox="0 0 600 150" preserveAspectRatio="none">
                    <path
                      className="area"
                      d="M0 120 C40 118 60 104 100 108 C140 112 160 92 200 90 C240 88 260 96 300 80 C340 64 360 72 400 58 C440 44 470 52 500 36 C530 22 560 30 600 14 L600 150 L0 150 Z"
                    />
                    <path
                      className="line"
                      d="M0 120 C40 118 60 104 100 108 C140 112 160 92 200 90 C240 88 260 96 300 80 C340 64 360 72 400 58 C440 44 470 52 500 36 C530 22 560 30 600 14"
                    />
                  </svg>
                </div>
                <div className="well hero-insight">
                  <span className="pill accent">
                    <Sparkles size={12} /> AI insight
                  </span>
                  <p className="small">
                    Acquisition cost rose 12% this month. Moving ₹30,000 from social to search keeps
                    spend flat and adds about 24 customers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="band">
          <div className="landing-inner">
            <p className="eyebrow">How Brevio works</p>
            <h2 className="section-title">
              One month at a time, every decision has a consequence.
            </h2>
            <ol className="steps">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="card">
                  <span className="step-no num">0{i + 1}</span>
                  <h3 className="card-title">{t}</h3>
                  <p className="muted small">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-inner feature-rows">
          <div className="feature">
            <div>
              <p className="eyebrow">Create your startup</p>
              <h2 className="section-title">From idea to launch in under two minutes.</h2>
              <p className="muted">
                Eight industries including SaaS, fintech, edtech and food &amp; beverage, across 20
                Indian cities. Rent, salaries and demand change with the location you choose.
              </p>
              <ul className="checks">
                <li>
                  <Check size={16} aria-hidden /> Realistic starting numbers for every industry
                </li>
                <li>
                  <Check size={16} aria-hidden /> Choose your city, capital and team
                </li>
                <li>
                  <Check size={16} aria-hidden /> Save and resume at any time
                </li>
              </ul>
            </div>
            <div className="card feature-art" aria-hidden>
              <div className="muted xs">Industry</div>
              <div className="feature-opts">
                {['SaaS', 'Fintech', 'Edtech', 'E-commerce'].map((x, i) => (
                  <span key={x} className={`opt-chip ${i === 0 ? 'on' : ''}`}>
                    {x}
                  </span>
                ))}
              </div>
              <div className="well feature-cap">
                <span className="muted small">Starting capital</span>
                <span className="num strong">₹20,00,000</span>
              </div>
            </div>
          </div>
          <div className="feature reverse">
            <div>
              <p className="eyebrow">Make strategic decisions</p>
              <h2 className="section-title">See the trade-off before you commit.</h2>
              <p className="muted">
                Preview any plan before you play it. Each month is recorded as a turn, so you can
                trace exactly what changed and why.
              </p>
            </div>
            <div className="card feature-art" aria-hidden>
              <div className="feature-cap">
                <span className="muted small">Price</span>
                <span className="num strong">₹1,399 / month</span>
              </div>
              <div className="bar">
                <i style={{ width: '62%' }} />
              </div>
              <div className="feature-trio">
                <div className="well">
                  <div className="muted xs">Demand</div>
                  <div className="num bad-text strong">▼ small</div>
                </div>
                <div className="well">
                  <div className="muted xs">Revenue</div>
                  <div className="num good-text strong">▲ medium</div>
                </div>
                <div className="well">
                  <div className="muted xs">Profit</div>
                  <div className="num good-text strong">▲ medium</div>
                </div>
              </div>
            </div>
          </div>
          <div className="feature">
            <div>
              <p className="eyebrow">Simulate real business challenges</p>
              <h2 className="section-title">Markets don&apos;t wait for you.</h2>
              <p className="muted">
                Competitors cut prices, costs rise and demand swings with the season. Events are
                seeded, so a class can replay the same scenario and compare strategies fairly.
              </p>
            </div>
            <div className="event-stack" aria-hidden>
              <div className="card">
                <span className="ic warn">
                  <Zap size={16} />
                </span>
                <div>
                  <strong>A competitor entered the market</strong>
                  <div className="muted small">Demand falls for two months</div>
                </div>
              </div>
              <div className="card shift">
                <span className="ic good">
                  <TrendingUp size={16} />
                </span>
                <div>
                  <strong>Market demand increased</strong>
                  <div className="muted small">Demand rises for three months</div>
                </div>
              </div>
              <div className="card">
                <span className="ic bad">
                  <TriangleAlert size={16} />
                </span>
                <div>
                  <strong>Supplier costs increased</strong>
                  <div className="muted small">Operating costs go up</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="advisor" className="band">
          <div className="landing-inner feature">
            <div>
              <p className="eyebrow">AI Business Advisor</p>
              <h2 className="section-title">A strategy partner that shows its working.</h2>
              <p className="muted">
                Ask why profit fell or what to do next. The advisor reads your simulation&apos;s
                computed numbers and explains them in plain language. It never invents financials.
              </p>
            </div>
            <div className="card chat-art" aria-hidden>
              <div className="bubble-user">Should I hire more employees?</div>
              <div className="bubble-ai">
                <span className="ic accent">
                  <Sparkles size={14} />
                </span>
                <div>
                  <p className="small">
                    Support load per employee doubled since month 5. One more hire pays back within
                    a quarter at your current growth.
                  </p>
                  <div className="rec">
                    <span className="pill accent">Recommendation</span>
                    <strong className="small">Hire one support employee</strong>
                    <span className="muted xs">Payroll up, churn down</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-inner">
          <div className="center-head">
            <p className="eyebrow">Performance analytics</p>
            <h2 className="section-title">Measure everything. Replay anything.</h2>
            <p className="muted">
              Profit and loss, cash runway, customer growth and market share for every month,
              exportable as a report.
            </p>
          </div>
          <div className="three">
            <div className="card">
              <span className="ic accent">
                <BarChart3 size={16} aria-hidden />
              </span>
              <h3 className="card-title">Financial statements</h3>
              <p className="muted small">Revenue, costs, profit and runway month by month.</p>
            </div>
            <div className="card">
              <span className="ic info">
                <TrendingUp size={16} aria-hidden />
              </span>
              <h3 className="card-title">Growth analytics</h3>
              <p className="muted small">
                Customers, churn and market share against simulated competitors.
              </p>
            </div>
            <div className="card">
              <span className="ic good">
                <RefreshCw size={16} aria-hidden />
              </span>
              <h3 className="card-title">Deterministic replays</h3>
              <p className="muted small">
                The same seed and decisions always give the same result.
              </p>
            </div>
          </div>
        </section>

        <section id="plans" className="band">
          <div className="landing-inner">
            <div className="center-head">
              <p className="eyebrow">Plans</p>
              <h2 className="section-title">Start free. Grow when you&apos;re ready.</h2>
            </div>
            <div className="three plans">
              {PLANS.map((p) => (
                <div key={p.name} className={`card plan ${p.featured ? 'featured' : ''}`}>
                  <div className="plan-head">
                    <h3 className="card-title">{p.name}</h3>
                    {p.featured && <span className="pill accent">Most requested</span>}
                  </div>
                  <div className="plan-price">{p.price}</div>
                  <p className="muted small">{p.desc}</p>
                  <ul className="checks">
                    {p.feats.map((f) => (
                      <li key={f}>
                        <Check size={16} aria-hidden /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register" className={`button ${p.featured ? 'primary' : ''}`}>
                    {p.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="landing-inner narrow-col">
          <h2 className="section-title center">Frequently asked questions</h2>
          <Faq />
        </section>

        <section className="landing-inner">
          <div className="card final-cta">
            <h2 className="section-title">Your first startup is one click away.</h2>
            <p className="muted">
              Launch a company, run a year in an afternoon, and learn from every decision.
            </p>
            <div className="hero-ctas">
              <Link to="/register" className="button primary lg">
                Start building
              </Link>
              <Link to="/login" className="button lg">
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <div className="landing-inner footer-grid">
          <div>
            <div className="guest-brand">
              <span className="brand-mark" aria-hidden>
                <Logo size={16} />
              </span>
              <span className="brand-title">Brevio</span>
            </div>
            <p className="muted small">Build. Simulate. Scale.</p>
          </div>
          <nav aria-label="Footer" className="footer-links">
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
            <Link to="/privacy">Privacy</Link>
            <Link to="/login">Log in</Link>
          </nav>
        </div>
        <p className="landing-inner muted xs footer-note">
          Simulated results are for learning and do not predict real outcomes.
        </p>
      </footer>
    </div>
  );
}
