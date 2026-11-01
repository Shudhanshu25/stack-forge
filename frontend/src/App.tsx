import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { VerifyEmailBanner } from './components/AccountNotices';
import { PageSkeleton } from './components/feedback/Skeletons';
import { ForgotPasswordPage, GoogleDonePage, VerifyEmailPage } from './pages/AccountFlowPages';
import { PrivacyPage } from './pages/PrivacyPage';
import { CoachPanel } from './onboarding/Onboarding';
import { AppShell, GuestHeader } from './components/shell/AppShell';
import { AuthLayout } from './components/shell/AuthLayout';
import { ShellProvider } from './components/shell/SimulationController';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { StartupEditPage } from './pages/StartupEditPage';
import { StartupListPage } from './pages/StartupListPage';
import { StartupWizardPage } from './pages/StartupWizardPage';

// Chart-heavy views load on demand, so sign-in and the wizard stay light.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(async () => ({ default: (await load())[name] }));
const AccountPage = page(() => import('./pages/AccountPage'), 'AccountPage');
const AdminPage = page(() => import('./pages/AdminPage'), 'AdminPage');
const AnalyticsPage = page(() => import('./pages/AnalyticsPage'), 'AnalyticsPage');
const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage');
const ScenariosPage = page(() => import('./pages/ScenariosPage'), 'ScenariosPage');
const DecisionsPage = page(() => import('./pages/DecisionsPage'), 'DecisionsPage');
const AdvisorPage = page(() => import('./pages/AdvisorPage'), 'AdvisorPage');
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

const auth = (node: ReactNode) => <RequireAuth>{node}</RequireAuth>;

/** Fade between pages; within a simulation the layout fades its own views. */
const sectionKey = (pathname: string) => pathname.split('/').slice(0, 3).join('/');

/** Which frame a path uses: the landing page, the sign-in layout, or the signed-in app. */
function frameFor(pathname: string, signedIn: boolean): 'landing' | 'auth' | 'app' | 'plain' {
  if (pathname === '/') return signedIn ? 'app' : 'landing';
  if (/^\/(login|register|forgot-password|reset-password)$/.test(pathname)) return 'auth';
  if (/^\/(verify-email|auth\/google\/done|privacy)$/.test(pathname))
    return signedIn ? 'app' : 'plain';
  return signedIn ? 'app' : 'plain';
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
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
        <Route path="decisions" element={<DecisionsPage />} />
        <Route path="advisor" element={<AdvisorPage />} />
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
  );
}

/** "/" is the landing page for guests and the startup list once signed in. */
function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton label="Loading" />;
  return user ? <Navigate to="/startups" replace /> : <LandingPage />;
}

export function App() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const frame = frameFor(pathname, Boolean(user));
  const content = (
    <Suspense fallback={<PageSkeleton />}>
      <div key={sectionKey(pathname)} className="view-fade">
        <AppRoutes />
      </div>
    </Suspense>
  );
  return (
    <ShellProvider>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {frame === 'landing' && content}
      {frame === 'auth' && <AuthLayout>{content}</AuthLayout>}
      {frame === 'plain' && (
        <>
          <GuestHeader />
          <main className="container" id="main" tabIndex={-1}>
            {content}
          </main>
        </>
      )}
      {frame === 'app' && (
        <AppShell>
          <main className="container app-content" id="main" tabIndex={-1}>
            <VerifyEmailBanner />
            {content}
          </main>
        </AppShell>
      )}
      {user && <CoachPanel />}
    </ShellProvider>
  );
}
