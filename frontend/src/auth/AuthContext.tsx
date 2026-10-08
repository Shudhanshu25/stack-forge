import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '@stackforge/shared';
import { onSessionExpired, refreshSession, setAccessToken } from '../api/client';
import { authApi } from '../api/endpoints';

interface AuthState {
  user: User | null;
  /** True until the initial silent refresh has finished. */
  loading: boolean;
  login: (input: LoginRequest) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  /** Replaces the signed-in user, e.g. after finishing onboarding. */
  updateUser: (user: User) => void;
  /** Restores the session from the refresh cookie (after Google sign-in). */
  resume: () => Promise<boolean>;
  /** Forgets the session locally (the server already ended it, e.g. after deletion). */
  clear: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const accept = useCallback((session: AuthResponse) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
  }, []);

  useEffect(() => {
    onSessionExpired(() => setUser(null));
    // Restore the session from the refresh cookie on page load.
    refreshSession()
      .then((session) => session && setUser(session.user))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (input) => accept(await authApi.login(input)),
      register: async (input) => accept(await authApi.register(input)),
      updateUser: setUser,
      resume: async () => {
        const session = await refreshSession();
        if (session) setUser(session.user);
        return Boolean(session);
      },
      clear: () => {
        setAccessToken(null);
        setUser(null);
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          setAccessToken(null);
          setUser(null);
        }
      },
    }),
    [user, loading, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
