import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getDemoSession, isDemoMode, signInDemo, signOutDemo } from './demo';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** True when running with the local demo auth bypass. */
  demo: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  /**
   * Register a new email/password account. `needsConfirmation` is true when the
   * Supabase project requires email confirmation (no session yet — the user must
   * click the link in their inbox before they can sign in).
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const demo = isDemoMode();

  useEffect(() => {
    let mounted = true;

    // Demo mode: resolve a synthetic session locally, skip Supabase entirely.
    if (demo) {
      setSession(getDemoSession());
      setLoading(false);
      return;
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setSession(data.session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [demo]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      demo,
      signInWithPassword: async (login, password) => {
        if (demo) {
          const next = signInDemo(login, password);
          if (!next) return { error: 'Invalid demo credentials.' };
          setSession(next);
          return { error: null };
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: login,
          password,
        });
        return { error: error?.message ?? null };
      },
      signUpWithPassword: async (email, password) => {
        if (demo) {
          // No real registration in demo mode — accept and sign in locally.
          const next = signInDemo(email, password);
          if (next) setSession(next);
          return { error: null, needsConfirmation: false };
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) return { error: error.message, needsConfirmation: false };
        // When email confirmation is enabled, signUp returns a user but no
        // session until the link is clicked. Otherwise the session arrives via
        // onAuthStateChange and the app proceeds straight to the editor.
        return { error: null, needsConfirmation: !data.session };
      },
      signInWithOtp: async (email) => {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        return { error: error?.message ?? null };
      },
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        if (demo) {
          signOutDemo();
          setSession(null);
          return;
        }
        await supabase.auth.signOut();
      },
    }),
    [session, loading, demo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider.');
  return ctx;
}
