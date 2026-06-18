import type { Session, User } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * Local-first / demo authentication. Lets the app run end-to-end without a live
 * Supabase project, in two flavors:
 *
 *  - **Local-only** (`VITE_LOCAL_ONLY=1`): a first-class no-backend mode. A
 *    synthetic `local-user` session is established automatically — there is no
 *    login wall at all. Data lives in the active local backend (IndexedDB / a
 *    local file) and server-only features (sharing/friends/profile) degrade.
 *  - **Demo** (`VITE_DEMO_AUTH=1`): the explorable demo. A username/password form
 *    accepts the configured demo credentials (default `1` / `1`) and creates the
 *    same synthetic session.
 *
 * Both paths are OFF by default; the hosted build still uses real Supabase auth.
 */
const KEY = 'travel-editor:demo-session';

/** Stable synthetic user id used by both local-only and demo modes. */
export const LOCAL_USER_ID = 'local-user';

export const DEMO_LOGIN = import.meta.env.VITE_DEMO_LOGIN ?? '1';
export const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD ?? '1';

/** True for the explorable demo (login form with `1/1`). */
export function isDemoMode(): boolean {
  return env.demoAuth;
}

/** True for the no-backend local-first mode (no login wall). */
export function isLocalOnlyMode(): boolean {
  return env.localOnly;
}

/** True when running without a backend at all (either local-only or demo). */
export function isLocalMode(): boolean {
  return env.localOnly || env.demoAuth;
}

/** Build a minimal Supabase-shaped session for the synthetic local user. */
function makeLocalSession(): Session {
  const user = {
    id: LOCAL_USER_ID,
    email: 'local@local',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: { local: true },
    created_at: new Date(0).toISOString(),
  } as unknown as User;

  return {
    access_token: 'local',
    refresh_token: 'local',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  } as unknown as Session;
}

/**
 * Resolve the current local session.
 *  - Local-only: always signed in (no persisted flag needed — there's no login).
 *  - Demo: signed in only after the user submitted the demo credentials.
 */
export function getLocalSession(): Session | null {
  if (isLocalOnlyMode()) return makeLocalSession();
  if (!isDemoMode()) return null;
  try {
    return localStorage.getItem(KEY) ? makeLocalSession() : null;
  } catch {
    return null;
  }
}

/** @deprecated kept for back-compat — use {@link getLocalSession}. */
export const getDemoSession = getLocalSession;

export function signInDemo(login: string, password: string): Session | null {
  if (login.trim() === DEMO_LOGIN && password === DEMO_PASSWORD) {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    return makeLocalSession();
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
