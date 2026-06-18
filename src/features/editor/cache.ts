import type { TravelData } from '@/domain/schema';
import { normalizeTravelData } from '@/domain/normalize';

/**
 * Offline-first local cache. Mirrors the active backend's document in
 * localStorage so the editor works without a connection and survives reloads. It
 * is a fast first-paint hint only — the active storage backend remains the source
 * of truth. Keyed per cache-id (the user id when signed in, or a stable
 * per-backend id like `local:indexeddb` in account-less mode) so switching
 * accounts/backends on a shared device never leaks data between them.
 */
const PREFIX = 'travel-editor:v1:';

const keyFor = (cacheId: string) => `${PREFIX}${cacheId}`;

/**
 * The stable cache id for an account-less backend (no signed-in user). Kept here
 * so callers don't hand-roll the `local:` convention.
 */
export const localCacheId = (storeId: string) => `local:${storeId}`;

export function readCache(userId: string): TravelData | null {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? normalizeTravelData(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeCache(userId: string, data: TravelData): void {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(data));
  } catch {
    // Quota or privacy mode — non-fatal; server remains the source of truth.
  }
}

export function clearCache(userId: string): void {
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    /* ignore */
  }
}
