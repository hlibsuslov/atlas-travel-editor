import type { Session, User } from '@supabase/supabase-js';

/**
 * Local demo authentication. Lets the app be explored end-to-end without a live
 * Supabase project: when VITE_DEMO_AUTH is enabled, a username/password form
 * accepts the configured demo credentials (default `1` / `1`) and creates a
 * synthetic session. Data then lives in the per-user localStorage cache, so the
 * editor, map and import/export all work; server-only actions degrade
 * gracefully. This is a development convenience and is OFF by default.
 */
const KEY = 'travel-editor:demo-session';

export const DEMO_LOGIN = import.meta.env.VITE_DEMO_LOGIN ?? '1';
export const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD ?? '1';

export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_AUTH === '1';
}

/** Build a minimal Supabase-shaped session for the demo user. */
function makeDemoSession(): Session {
  const user = {
    id: 'demo-user',
    email: 'demo@local',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: { demo: true },
    created_at: new Date(0).toISOString(),
  } as unknown as User;

  return {
    access_token: 'demo',
    refresh_token: 'demo',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  } as unknown as Session;
}

export function getDemoSession(): Session | null {
  if (!isDemoMode()) return null;
  try {
    return localStorage.getItem(KEY) ? makeDemoSession() : null;
  } catch {
    return null;
  }
}

export function signInDemo(login: string, password: string): Session | null {
  if (login.trim() === DEMO_LOGIN && password === DEMO_PASSWORD) {
    localStorage.setItem(KEY, '1');
    return makeDemoSession();
  }
  return null;
}

export function signOutDemo(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
