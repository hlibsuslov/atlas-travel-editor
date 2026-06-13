import { supabase } from '@/lib/supabase';
import type { MyProfile, SharedProfile } from '@/lib/database.types';

/**
 * Profile data access. The owner reads/writes their own profile; the public
 * slice (name + color) of a friend is resolved from their share slug. All
 * scoping is enforced server-side (auth.uid()) and by RLS.
 */

export type { MyProfile, SharedProfile };

/** Fetch the signed-in user's profile, or `null` if they haven't set one. */
export async function getMyProfile(): Promise<MyProfile | null> {
  const { data, error } = await supabase.rpc('get_my_profile');
  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Create or update the signed-in user's profile. */
export async function saveMyProfile(displayName: string, accentColor: string): Promise<MyProfile> {
  const { data, error } = await supabase.rpc('save_my_profile', {
    p_display_name: displayName.trim(),
    p_accent_color: accentColor,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Resolve a public share slug to its owner's display name + avatar color. */
export async function fetchSharedProfile(slug: string): Promise<SharedProfile | null> {
  const { data, error } = await supabase.rpc('get_shared_profile', { p_slug: slug });
  if (error) throw new Error(error.message);
  return data ?? null;
}
