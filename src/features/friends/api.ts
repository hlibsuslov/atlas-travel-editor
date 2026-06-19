import {
  atlasAddFollow,
  atlasListFollows,
  atlasRemoveFollow,
  getAtlasUrl,
  type AtlasFollow,
} from '@/lib/atlas/client';

/**
 * Following / friends data access. A follow is a directed edge to another user,
 * keyed on their handle (or resolved from a pasted share link). It requires a
 * connected Atlas Server; in pure local-first mode there is no social graph, so
 * every call degrades gracefully (empty / clear error / no-op).
 */
export type FriendLink = AtlasFollow;

const connected = (): boolean => !!getAtlasUrl();

/** Normalize a pasted share code or full share URL down to the slug. */
export function extractSlug(input: string): string {
  const trimmed = input.trim();
  const match = /\/share\/([^/?#\s]+)/.exec(trimmed);
  return (match ? match[1]! : trimmed).replace(/[^A-Za-z0-9_-]/g, '');
}

export async function listFriends(): Promise<FriendLink[]> {
  if (!connected()) return [];
  return atlasListFollows();
}

/**
 * Follow someone from free-form input: a handle, a `/u/:handle` link, a
 * `/share/:slug` link, or a bare token. Ambiguous bare tokens are sent as BOTH a
 * handle and a slug; the server resolves a handle first, then a slug.
 */
export async function addFriend(input: string, label?: string): Promise<FriendLink> {
  if (!connected()) throw new Error('Friends require a connected Atlas Server.');
  const raw = input.trim();
  let target: { handle?: string; slug?: string; label?: string };
  if (/\/share\//.test(raw)) {
    target = { slug: extractSlug(raw), label };
  } else if (/\/u\//.test(raw)) {
    const handle = (/\/u\/([^/?#\s]+)/.exec(raw)?.[1] ?? '').toLowerCase();
    target = { handle, label };
  } else {
    const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, '');
    target = { handle: cleaned.toLowerCase(), slug: cleaned, label };
  }
  return atlasAddFollow(target);
}

export async function removeFriend(handle: string | null): Promise<void> {
  if (!connected() || !handle) return;
  await atlasRemoveFollow(handle);
}
