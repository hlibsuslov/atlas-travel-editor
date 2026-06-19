import { env } from '@/lib/env';

export interface FriendLink {
  id: string;
  slug: string;
  label: string | null;
}

/**
 * Follow / friends data access. Following is a social capability that requires a
 * connected backend (the self-hostable Atlas Server, a later sprint). In pure
 * local-first mode there is no social backend, so every call degrades gracefully
 * (empty / no-op / clear error) and the Friends UI is capability-gated off.
 */
const socialAvailable = (): boolean => env.socialBackendConfigured;

/** Normalize a pasted share code or full share URL down to the slug. */
export function extractSlug(input: string): string {
  const trimmed = input.trim();
  const match = /\/share\/([^/?#\s]+)/.exec(trimmed);
  return (match ? match[1]! : trimmed).replace(/[^A-Za-z0-9_-]/g, '');
}

export function listFriends(): Promise<FriendLink[]> {
  return Promise.resolve([]);
}

export function addFriend(slugOrUrl: string, _label?: string): Promise<FriendLink> {
  void _label;
  const slug = extractSlug(slugOrUrl);
  if (!slug) return Promise.reject(new Error('Empty share code.'));
  if (!socialAvailable()) return Promise.reject(new Error('Friends require a connected account.'));
  // Real follow edges land with the Atlas Server (Sprint 4).
  return Promise.reject(new Error('Friends require a connected account.'));
}

export function removeFriend(_id: string): Promise<void> {
  void _id;
  return Promise.resolve();
}
