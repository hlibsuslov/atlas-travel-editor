import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { MyProfile, SharedProfile } from '@/lib/database.types';

/**
 * Profile data access. The owner reads/writes their own profile; the public
 * slice (name + color) of a friend is resolved from their share slug. All
 * scoping is enforced server-side (auth.uid()) and by RLS.
 *
 * Profiles are a server-only capability: in backendless (local-only / demo) mode
 * there is no cloud profile, so reads return empty and writes no-op gracefully
 * instead of throwing.
 */

export type { MyProfile, SharedProfile };

const cloudAvailable = (): boolean => env.supabaseConfigured && !env.backendOptional;

/** Fetch the signed-in user's profile, or `null` if they haven't set one. */
export async function getMyProfile(): Promise<MyProfile | null> {
  if (!cloudAvailable()) return null;
  const { data, error } = await supabase.rpc('get_my_profile');
  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Create or update the signed-in user's profile. */
export async function saveMyProfile(displayName: string, accentColor: string): Promise<MyProfile> {
  if (!cloudAvailable()) {
    // No cloud to persist to — echo the values back so optimistic UI still works.
    return { display_name: displayName.trim(), accent_color: accentColor, public_handle: null };
  }
  const { data, error } = await supabase.rpc('save_my_profile', {
    p_display_name: displayName.trim(),
    p_accent_color: accentColor,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Resolve a public share slug to its owner's display name + avatar color. */
export async function fetchSharedProfile(slug: string): Promise<SharedProfile | null> {
  if (!cloudAvailable()) return null;
  const { data, error } = await supabase.rpc('get_shared_profile', { p_slug: slug });
  if (error) throw new Error(error.message);
  return data ?? null;
}
