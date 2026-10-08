import { Suspense, lazy, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { CommandPaletteButton } from './commands/CommandPalette';
import { VerifyEmailBanner } from './components/AccountNotices';
import { PageSkeleton } from './components/feedback/Skeletons';
import { ForgotPasswordPage, GoogleDonePage, VerifyEmailPage } from './pages/AccountFlowPages';
import { PrivacyPage } from './pages/PrivacyPage';
import { CoachPanel, useTour } from './onboarding/Onboarding';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { StartupEditPage } from './pages/StartupEditPage';
import { StartupListPage } from './pages/StartupListPage';
import { StartupWizardPage } from './pages/StartupWizardPage';
import { ThemeToggle } from './theme/ThemeContext';

// Chart-heavy views load on demand, so sign-in and the wizard stay light.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(async () => ({ default: (await load())[name] }));
const AccountPage = page(() => import('./pages/AccountPage'), 'AccountPage');
const AdminPage = page(() => import('./pages/AdminPage'), 'AdminPage');
const AnalyticsPage = page(() => import('./pages/AnalyticsPage'), 'AnalyticsPage');
const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage');
const ScenariosPage = page(() => import('./pages/ScenariosPage'), 'ScenariosPage');
const SimulationLayout = page(() => import('./pages/SimulationLayout'), 'SimulationLayout');
const TimelinePage = page(() => import('./pages/TimelinePage'), 'TimelinePage');

function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageSkeleton label="Signing you in" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/startups" replace />;
  return children;
}

/** Login and register pages. Once signed in, this is the only place that redirects onward. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageSkeleton label="Loading" />;
  if (!user) return children;
  const from = (location.state as { from?: string } | null)?.from;
  const next = from ?? (location.pathname === '/register' ? '/startups/new' : '/startups');
  return <Navigate to={next} replace />;
}

function Header() {
  const { user, logout } = useAuth();
  const tour = useTour();
  return (
    <header className="topbar">
      <Link to="/" className="brand">
        Stack<span>Forge</span>
      </Link>
      <div className="topbar-tools">
        {user && (
          <nav aria-label="Main">
            <Link to="/startups">Startups</Link>
            <Link to="/account">Account</Link>
            {user.role === 'ADMIN' && <Link to="/admin">Admin</Link>}
            {!tour.active && (
              <button type="button" className="link" onClick={tour.restart}>
                Tour
              </button>
            )}
            <span className="muted user-name">{user.name}</span>
            <button type="button" className="link" onClick={() => void logout()}>
              Log out
            </button>
          </nav>
        )}
        {user && <CommandPaletteButton />}
        <ThemeToggle />
      </div>
    </header>
  );
}

const auth = (node: ReactNode) => <RequireAuth>{node}</RequireAuth>;

/** Fade between pages; within a simulation the layout fades its own views. */
const sectionKey = (pathname: string) => pathname.split('/').slice(0, 3).join('/');

export function App() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main className="container" id="main" tabIndex={-1}>
        <VerifyEmailBanner />
        <Suspense fallback={<PageSkeleton />}>
          <div key={sectionKey(pathname)} className="view-fade">
            <Routes>
              <Route
                path="/login"
                element={
                  <GuestOnly>
                    <LoginPage />
                  </GuestOnly>
                }
              />
              <Route
                path="/register"
                element={
                  <GuestOnly>
                    <RegisterPage />
                  </GuestOnly>
                }
              />
              <Route
                path="/forgot-password"
                element={
                  <GuestOnly>
                    <ForgotPasswordPage />
                  </GuestOnly>
                }
              />
              {/* Reset is by emailed code now; old reset links land on the code flow. */}
              <Route path="/reset-password" element={<Navigate to="/forgot-password" replace />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/auth/google/done" element={<GoogleDonePage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/account" element={auth(<AccountPage />)} />
              <Route path="/startups" element={auth(<StartupListPage />)} />
              <Route path="/startups/new" element={auth(<StartupWizardPage />)} />
              <Route path="/startups/:id/edit" element={auth(<StartupEditPage />)} />
              <Route path="/simulations/:id" element={auth(<SimulationLayout />)}>
                <Route index element={<DashboardPage />} />
                <Route path="scenarios" element={<ScenariosPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="analytics/:tab" element={<AnalyticsPage />} />
                <Route path="timeline" element={<TimelinePage />} />
              </Route>
              <Route
                path="/admin"
                element={
                  <RequireAuth admin>
                    <AdminPage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/startups" replace />} />
            </Routes>
          </div>
        </Suspense>
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <span>
            <strong>Stack Forge</strong> · a startup simulator
          </span>
          <nav aria-label="Footer">
            <Link to="/privacy">Privacy</Link>
            {user && <Link to="/account">Your data</Link>}
          </nav>
        </div>
      </footer>
      {user && <CoachPanel />}
    </>
  );
}
