import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clearCache } from '@/features/editor/cache';
import {
  getLocalSession,
  isLocalMode,
  isLocalOnlyMode,
  signInDemo,
  signOutDemo,
  type LocalSession,
  type LocalUser,
} from './demo';

/**
 * Authentication context. The app is local-first: by default it runs with a
 * synthetic local session and NO login wall. Real accounts arrive when a
 * self-hostable Atlas Server is wired up (a later sprint); until then the
 * password / OTP / OAuth methods are graceful no-ops that report that no backend
 * is configured. The public surface is kept stable so consumers never change.
 */
const NO_BACKEND = 'No backend configured. Atlas runs locally; connect a server to sign in.';

interface AuthContextValue {
  session: LocalSession | null;
  user: LocalUser | null;
  loading: boolean;
  /** True when running with a local synthetic session (local-only OR demo auth). */
  demo: boolean;
  /** True for the no-backend local-first mode (no login wall). */
  localOnly: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  /**
   * Register a new account. `needsConfirmation` is reserved for a future server
   * flow that requires email confirmation before a session is issued.
   */
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LocalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const demo = isLocalMode();
  const localOnly = isLocalOnlyMode();

  useEffect(() => {
    // Local/demo mode: resolve the synthetic session locally. Local-only is always
    // signed in; demo waits for the `1/1` form. With no backend configured there is
    // nothing async to wait for.
    setSession(getLocalSession());
    setLoading(false);
  }, [demo]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      demo,
      localOnly,
      signInWithPassword: (login, password) => {
        if (demo) {
          const next = signInDemo(login, password);
          if (!next) return Promise.resolve({ error: 'Invalid demo credentials.' });
          setSession(next);
          return Promise.resolve({ error: null });
        }
        return Promise.resolve({ error: NO_BACKEND });
      },
      signUpWithPassword: (email, password) => {
        if (demo) {
          // No real registration in demo mode — accept and sign in locally.
          const next = signInDemo(email, password);
          if (next) setSession(next);
          return Promise.resolve({ error: null, needsConfirmation: false });
        }
        return Promise.resolve({ error: NO_BACKEND, needsConfirmation: false });
      },
      signInWithOtp: () => Promise.resolve({ error: NO_BACKEND }),
      signInWithGoogle: () => Promise.resolve({ error: NO_BACKEND }),
      signOut: () => {
        // Purge the signed-in user's local cache so it never leaks to the next
        // person on a shared device.
        const uid = session?.user?.id;
        if (uid) clearCache(uid);
        signOutDemo();
        setSession(null);
        return Promise.resolve();
      },
    }),
    [session, loading, demo, localOnly],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider.');
  return ctx;
}
