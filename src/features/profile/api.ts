import { atlasGetPublic, atlasMe, atlasUpdateProfile, getAtlasUrl } from '@/lib/atlas/client';

/**
 * Profile data access. A profile is the public identity (display name + avatar
 * color + a unique handle) that others see on shared maps. When an Atlas Server is
 * connected these go to the server; in pure local-first mode there is no shared
 * profile, so reads return empty and writes echo the input (optimistic UI).
 */

/** The signed-in user's own profile. */
export interface MyProfile {
  display_name: string;
  accent_color: string;
  /** Public handle for the `/u/:handle` address (null until claimed). */
  public_handle: string | null;
}

/** The publicly visible slice of a profile, resolved from a share slug. */
export interface SharedProfile {
  display_name: string;
  accent_color: string;
}

const connected = (): boolean => !!getAtlasUrl();

/** Fetch the signed-in user's profile, or `null` if none / no server. */
export async function getMyProfile(): Promise<MyProfile | null> {
  if (!connected()) return null;
  const me = await atlasMe();
  if (!me?.profile) return null;
  return {
    display_name: me.profile.display_name,
    accent_color: me.profile.accent_color,
    public_handle: me.profile.handle,
  };
}

/** Create or update the signed-in user's profile (name, color, optional handle). */
export async function saveMyProfile(
  displayName: string,
  accentColor: string,
  handle: string | null = null,
): Promise<MyProfile> {
  if (!connected()) {
    // No server — echo the values back so optimistic UI still works locally.
    return { display_name: displayName.trim(), accent_color: accentColor, public_handle: handle };
  }
  const p = await atlasUpdateProfile({
    display_name: displayName.trim(),
    accent_color: accentColor,
    handle,
  });
  return { display_name: p.display_name, accent_color: p.accent_color, public_handle: p.handle };
}

/** Resolve a public share slug to its owner's display name + avatar color. */
export async function fetchSharedProfile(slug: string): Promise<SharedProfile | null> {
  if (!connected()) return null;
  const view = await atlasGetPublic(slug);
  return view
    ? { display_name: view.profile.display_name, accent_color: view.profile.accent_color }
    : null;
}
