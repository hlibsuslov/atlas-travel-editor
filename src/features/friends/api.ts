import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';

export interface FriendLink {
  id: string;
  slug: string;
  label: string | null;
}

/**
 * Whether a real Supabase backend is available for social features. Friends are a
 * server-only capability: in backendless (local-only / demo) mode there is no
 * cloud to hold friend links, so every call degrades gracefully (empty / no-op)
 * instead of throwing — backing the "degrade gracefully" promise.
 */
const cloudAvailable = (): boolean => env.supabaseConfigured && !env.backendOptional;

/** Normalize a pasted share code or full share URL down to the slug. */
export function extractSlug(input: string): string {
  const trimmed = input.trim();
  const match = /\/share\/([^/?#\s]+)/.exec(trimmed);
  return (match ? match[1]! : trimmed).replace(/[^A-Za-z0-9_-]/g, '');
}

export async function listFriends(): Promise<FriendLink[]> {
  if (!cloudAvailable()) return [];
  const { data, error } = await supabase
    .from('friend_links')
    .select('id, slug, label')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addFriend(slugOrUrl: string, label?: string): Promise<FriendLink> {
  const slug = extractSlug(slugOrUrl);
  if (!slug) throw new Error('Empty share code.');
  if (!cloudAvailable()) throw new Error('Friends require a connected account.');

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Not authenticated.');

  const { data, error } = await supabase
    .from('friend_links')
    .insert({ user_id: userId, slug, label: label?.trim() || null })
    .select('id, slug, label')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removeFriend(id: string): Promise<void> {
  if (!cloudAvailable()) return;
  const { error } = await supabase.from('friend_links').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
