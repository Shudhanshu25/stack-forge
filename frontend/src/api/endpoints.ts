import type {
  AccountDeleteRequest,
  AuthOptions,
  LlmUsageSummary,
  PasswordResetConfirmRequest,
  PasswordResetVerifyResponse,
  SessionListResponse,
  AdminStats,
  ScenarioComparison,
  ScenarioRequest,
  SimulationAnalytics,
  User,
  AdviceRequest,
  AIAdvice,
  AuthResponse,
  Decision,
  DecisionPreview,
  Simulation,
  SimulationJob,
  SimulationListResponse,
  SimulationStartRequest,
  SimulationTurn,
  TurnListResponse,
  IndustryTemplateListResponse,
  LocationCatalog,
  LocationProfile,
  LocationProfileRequest,
  LoginRequest,
  RegisterRequest,
  Startup,
  StartupCreateRequest,
  StartupListResponse,
  StartupUpdateRequest,
} from '@stackforge/shared';
import { API_BASE_URL, api, download } from './client';

export const authApi = {
  register: (body: RegisterRequest) =>
    api<AuthResponse>('/auth/register', { method: 'POST', body }),
  login: (body: LoginRequest) => api<AuthResponse>('/auth/login', { method: 'POST', body }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  completeOnboarding: () => api<User>('/auth/me/onboarding', { method: 'POST' }),
  me: () => api<User>('/auth/me'),
  options: () => api<AuthOptions>('/auth/options'),
  verifyEmail: (token: string) =>
    api<User>('/auth/verify-email', { method: 'POST', body: { token } }),
  resendVerification: () => api<void>('/auth/verify-email/resend', { method: 'POST' }),
  requestPasswordReset: (email: string) =>
    api<void>('/auth/password-reset', { method: 'POST', body: { email } }),
  verifyResetCode: (email: string, code: string) =>
    api<PasswordResetVerifyResponse>('/auth/password-reset/verify', {
      method: 'POST',
      body: { email, code },
    }),
  confirmPasswordReset: (body: PasswordResetConfirmRequest) =>
    api<void>('/auth/password-reset/confirm', { method: 'POST', body }),
  sessions: () => api<SessionListResponse>('/auth/sessions').then((r) => r.sessions),
  revokeSession: (sessionId: string) =>
    api<void>(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
  /** Full-page navigation: the API redirects to Google and back. */
  googleStartUrl: () => `${API_BASE_URL}/auth/google/start`,
};

export const accountApi = {
  llmUsage: () => api<LlmUsageSummary>('/account/llm-usage'),
  exportData: () => download('/account/export'),
  remove: (body: AccountDeleteRequest) => api<void>('/account', { method: 'DELETE', body }),
};

export const startupApi = {
  list: () => api<StartupListResponse>('/startups').then((r) => r.startups),
  get: (id: string) => api<Startup>(`/startups/${encodeURIComponent(id)}`),
  create: (body: StartupCreateRequest) => api<Startup>('/startups', { method: 'POST', body }),
  update: (id: string, body: StartupUpdateRequest) =>
    api<Startup>(`/startups/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  remove: (id: string) => api<void>(`/startups/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  templates: () =>
    api<IndustryTemplateListResponse>('/industry-templates').then((r) => r.templates),
};

const id = encodeURIComponent;

export const simulationApi = {
  start: (startupId: string, body: SimulationStartRequest = {}) =>
    api<Simulation>(`/startups/${id(startupId)}/simulation`, { method: 'POST', body }),
  listForStartup: (startupId: string) =>
    api<SimulationListResponse>(`/startups/${id(startupId)}/simulations`).then(
      (r) => r.simulations,
    ),
  get: (simulationId: string) => api<Simulation>(`/simulations/${id(simulationId)}`),
  turns: (simulationId: string): Promise<SimulationTurn[]> =>
    api<TurnListResponse>(`/simulations/${id(simulationId)}/turns`).then((r) => r.turns),
  preview: (simulationId: string, decisions: Decision[]) =>
    api<DecisionPreview>(`/simulations/${id(simulationId)}/preview`, {
      method: 'POST',
      body: { decisions },
    }),
  /** One key per submission: the retry after a token refresh can never play a second turn. */
  playTurn: (simulationId: string, decisions: Decision[]) =>
    api<SimulationJob>(`/simulations/${id(simulationId)}/turns`, {
      method: 'POST',
      body: { decisions },
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    }),
  analytics: (simulationId: string) =>
    api<SimulationAnalytics>(`/simulations/${id(simulationId)}/analytics`),
  scenario: (simulationId: string, body: ScenarioRequest) =>
    api<ScenarioComparison>(`/simulations/${id(simulationId)}/scenarios`, { method: 'POST', body }),
  report: (simulationId: string, format: 'csv' | 'json' | 'pdf') =>
    download(`/simulations/${id(simulationId)}/report?format=${format}`),
  advise: (simulationId: string, body: AdviceRequest) =>
    api<AIAdvice>(`/simulations/${id(simulationId)}/advice`, { method: 'POST', body }),
  job: (jobId: string) => api<SimulationJob>(`/jobs/${id(jobId)}`),
  cancel: (jobId: string) => api<SimulationJob>(`/jobs/${id(jobId)}/cancel`, { method: 'POST' }),
};

export const locationApi = {
  catalog: () => api<LocationCatalog>('/locations'),
  profile: (body: LocationProfileRequest) =>
    api<LocationProfile>('/locations/profile', { method: 'POST', body }),
};

export const adminApi = {
  stats: () => api<AdminStats>('/admin/stats'),
};
