import type { TravelData } from '@/domain/schema';
import { normalizeTravelData } from '@/domain/normalize';

/**
 * Offline-first local cache. Mirrors the server document in localStorage so the
 * editor works without a connection and survives reloads. Keyed per user so
 * switching accounts on a shared device never leaks data between them.
 */
const PREFIX = 'travel-editor:v1:';

const keyFor = (userId: string) => `${PREFIX}${userId}`;

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
