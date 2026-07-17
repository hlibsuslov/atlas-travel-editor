import type { TravelData } from '@/domain/schema';
import { validateTravelData } from '@/domain/schema';

/**
 * Remote document data-access layer. In local-first mode there is no remote
 * backend, so these are graceful stubs: the editor loads and saves through the
 * active DocumentStore (IndexedDB by default), never these functions. They keep
 * their legacy shapes for callers/tests; real remote behavior now flows through
 * `SelfHostStore` and the typed client under `src/lib/atlas/`.
 */
export interface TravelRecord {
  data: TravelData;
  isPublic: boolean;
  shareSlug: string | null;
  version: number;
}

const NO_BACKEND = 'No remote backend configured.';

/** Fetch the signed-in user's remote record. Local-first: there is none. */
export function fetchMyRecord(): Promise<TravelRecord | null> {
  return Promise.resolve(null);
}

/**
 * Persist the user's document to a remote backend. Validates against the strict
 * schema first — preserving the exact `Cannot save invalid data:` message the
 * mutation-retry policy keys on (see `lib/mutationError.ts`) — then reports that
 * no remote backend exists. Local saves flow through the active DocumentStore, not
 * this path.
 */
export function saveMyRecord(data: TravelData): Promise<TravelRecord> {
  const validation = validateTravelData(data);
  if (!validation.ok) {
    return Promise.reject(new Error(`Cannot save invalid data: ${validation.errors[0]}`));
  }
  return Promise.reject(new Error(NO_BACKEND));
}

/** Toggle public sharing on a remote backend. Local-first: unavailable. */
export function setSharing(_isPublic: boolean): Promise<TravelRecord> {
  void _isPublic;
  return Promise.reject(new Error(NO_BACKEND));
}

/** Fetch a public record by share slug. Local-first: none — SharePage shows "private". */
export function fetchPublicRecord(_slug: string): Promise<TravelData | null> {
  void _slug;
  return Promise.resolve(null);
}
