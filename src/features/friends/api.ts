import { supabase } from '@/lib/supabase';

export interface FriendLink {
  id: string;
  slug: string;
  label: string | null;
}

/** Normalize a pasted share code or full share URL down to the slug. */
export function extractSlug(input: string): string {
  const trimmed = input.trim();
  const match = /\/share\/([^/?#\s]+)/.exec(trimmed);
  return (match ? match[1]! : trimmed).replace(/[^A-Za-z0-9_-]/g, '');
}

export async function listFriends(): Promise<FriendLink[]> {
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
  const { error } = await supabase.from('friend_links').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
