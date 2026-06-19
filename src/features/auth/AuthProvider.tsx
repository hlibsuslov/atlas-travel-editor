import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clearCache } from '@/features/editor/cache';
import {
  atlasLogin,
  atlasLogout,
  atlasMe,
  atlasRegister,
  getAtlasUrl,
  getToken,
} from '@/lib/atlas/client';
import { env } from '@/lib/env';
import {
  getLocalSession,
  isDemoMode,
  signInDemo,
  signOutDemo,
  type LocalSession,
  type LocalUser,
} from './demo';

/**
 * Authentication context. Two modes, chosen at mount by whether a self-hostable
 * Atlas Server is connected (its URL is configured):
 *
 *  - **Local-first (no server connected):** a synthetic local session, no login
 *    wall. The default.
 *  - **Server connected:** real accounts against the Atlas Server — register /
 *    login / logout / session hydrate via the opaque Bearer token.
 *
 * Connecting or disconnecting a server reloads the app, so this provider always
 * re-reads a consistent mode at mount. The public surface is stable so consumers
 * (App routing, the editor, the login page) never change.
 */
const NO_BACKEND = 'No backend configured. Atlas runs locally; connect a server to sign in.';

/** Derive a server username from an email local-part (3–30 of [a-z0-9_]). */
function deriveUsername(email: string): string {
  const base = (email.split('@')[0] ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  return (base || 'user').slice(0, 30).padEnd(3, '0');
}

interface AuthContextValue {
  session: LocalSession | null;
  user: LocalUser | null;
  loading: boolean;
  /** True when running with a local synthetic session (no server connected). */
  demo: boolean;
  /** True for the no-backend local-first mode (no login wall). */
  localOnly: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
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
  const connected = !!getAtlasUrl();
  // The demo login form only applies when no real server is connected.
  const demo = !connected && (env.demoAuth || isDemoMode());
  const localOnly = !connected;

  const [session, setSession] = useState<LocalSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!connected) {
      // Local-first: resolve the synthetic session locally (no network).
      setSession(getLocalSession());
      setLoading(false);
      return;
    }
    // Server connected: hydrate the session from the token, if any.
    if (!getToken()) {
      setSession(null);
      setLoading(false);
      return;
    }
    void atlasMe().then((me) => {
      if (!active) return;
      setSession(me ? { user: { id: me.user.id, email: me.user.email } } : null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [connected]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      demo,
      localOnly,
      signInWithPassword: async (login, password) => {
        if (connected) {
          try {
            const u = await atlasLogin(login, password);
            setSession({ user: { id: u.id, email: u.email } });
            return { error: null };
          } catch (e) {
            return { error: e instanceof Error ? e.message : 'Sign-in failed.' };
          }
        }
        if (demo) {
          const next = signInDemo(login, password);
          if (!next) return { error: 'Invalid demo credentials.' };
          setSession(next);
          return { error: null };
        }
        return { error: NO_BACKEND };
      },
      signUpWithPassword: async (email, password) => {
        if (connected) {
          try {
            const u = await atlasRegister(email, deriveUsername(email), password);
            setSession({ user: { id: u.id, email: u.email } });
            return { error: null, needsConfirmation: false };
          } catch (e) {
            return {
              error: e instanceof Error ? e.message : 'Sign-up failed.',
              needsConfirmation: false,
            };
          }
        }
        if (demo) {
          const next = signInDemo(email, password);
          if (next) setSession(next);
          return { error: null, needsConfirmation: false };
        }
        return { error: NO_BACKEND, needsConfirmation: false };
      },
      signInWithOtp: () =>
        Promise.resolve({
          error: connected ? 'Magic-link sign-in is not available yet.' : NO_BACKEND,
        }),
      signInWithGoogle: () =>
        Promise.resolve({
          error: connected ? 'Google sign-in is not available yet.' : NO_BACKEND,
        }),
      signOut: async () => {
        const uid = session?.user?.id;
        if (uid) clearCache(uid);
        if (connected) await atlasLogout();
        else signOutDemo();
        setSession(null);
      },
    }),
    [session, loading, demo, localOnly, connected],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider.');
  return ctx;
}
