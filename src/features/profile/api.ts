import { env } from '@/lib/env';

/**
 * Profile data access. A profile is the public identity (display name + avatar
 * color, and later a `handle`) that friends see on shared maps. Profiles are a
 * social capability: in pure local-first mode there is no backend, so reads return
 * empty and writes echo the input (so optimistic UI still works) instead of
 * throwing. Real profiles arrive with the self-hostable Atlas Server (later sprint).
 */

/** The signed-in user's own profile. */
export interface MyProfile {
  display_name: string;
  accent_color: string;
  /** Public handle for the `/u/:handle` address. Reserved; wired with the backend. */
  public_handle: string | null;
}

/** The publicly visible slice of a profile, resolved from a share slug. */
export interface SharedProfile {
  display_name: string;
  accent_color: string;
}

const socialAvailable = (): boolean => env.socialBackendConfigured;

/** Fetch the signed-in user's profile, or `null` if none / no backend. */
export function getMyProfile(): Promise<MyProfile | null> {
  return Promise.resolve(null);
}

/** Create or update the signed-in user's profile. */
export function saveMyProfile(displayName: string, accentColor: string): Promise<MyProfile> {
  // No backend to persist to — echo the values back so optimistic UI still works.
  void socialAvailable();
  return Promise.resolve({
    display_name: displayName.trim(),
    accent_color: accentColor,
    public_handle: null,
  });
}

/** Resolve a public share slug to its owner's display name + avatar color. */
export function fetchSharedProfile(_slug: string): Promise<SharedProfile | null> {
  void _slug;
  return Promise.resolve(null);
}
