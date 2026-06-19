import type { TravelData } from '@/domain/schema';

/**
 * The pluggable storage seam. Every persistence backend (IndexedDB, a local file,
 * the self-hostable Atlas Server, or a BYO cloud) implements the same
 * {@link DocumentStore} contract, so the editor only ever loads/saves one
 * self-contained `TravelData` blob plus a little sync metadata — and never knows
 * or cares which backend is behind it.
 *
 * The cross-cutting invariants (normalize-on-load, validate-on-save) are enforced
 * once, centrally, in the registry wrapper (see `registry.ts`) so no individual
 * adapter can forget them.
 */

/**
 * An opaque per-backend concurrency token: an Atlas Server row `version` (int), a
 * Drive `headRevisionId`, a Dropbox `rev`, a GitHub blob `sha`, a WebDAV `ETag`, or
 * an IndexedDB monotonic counter. `null` means "nothing stored yet / not tracked".
 */
export type VersionToken = string | number | null;

export interface DocMeta {
  version: VersionToken;
  isPublic: boolean;
  shareSlug: string | null;
  updatedAt?: string;
}

export interface StorageDoc {
  data: TravelData;
  meta: DocMeta;
}

export interface Capabilities {
  /** Public read-only sharing (sharing-capable backends — the Atlas Server). */
  sharing: boolean;
  /** Optimistic-concurrency support: `'token'` if `save()` can reject stale writes. */
  concurrency: 'token' | 'none';
  /** Live change notifications (e.g. BroadcastChannel / remote watch). */
  watch: boolean;
  /** Can enumerate multiple documents (vs. the single-document model). */
  list: boolean;
  /** Requires user authentication to read/write. */
  auth: boolean;
}

/** All store ids known to the registry. `selfhost` + the cloud ids are stubs this wave. */
export type StoreId =
  | 'indexeddb'
  | 'localfile'
  | 'selfhost'
  | 'gdrive'
  | 'dropbox'
  | 'webdav'
  | 'github';

/**
 * Thrown by `save()` when the backend detects the document was modified elsewhere
 * since it was loaded (only when `capabilities.concurrency === 'token'`). Carries
 * the freshly-loaded remote document so the caller can offer keep/take/merge.
 */
export class ConflictError extends Error {
  constructor(public remote: StorageDoc) {
    super('Document was modified elsewhere');
    this.name = 'ConflictError';
  }
}

export interface DocumentStore {
  readonly id: StoreId;
  readonly label: string;
  readonly capabilities: Capabilities;

  /** Load the stored document, or `null` if nothing is stored yet. */
  load(): Promise<StorageDoc | null>;

  /**
   * Persist the document. When `capabilities.concurrency === 'token'`, pass the
   * `expected` version loaded earlier; the store throws {@link ConflictError} on
   * a version mismatch.
   */
  save(data: TravelData, expected?: VersionToken): Promise<StorageDoc>;

  /** Toggle public sharing (sharing-capable backends — the Atlas Server). */
  setSharing?(isPublic: boolean): Promise<DocMeta>;

  /** Resolve a public share slug to its document (sharing-capable backends). */
  readPublic?(slug: string): Promise<TravelData | null>;

  /** Establish a connection / grant (OAuth, file handle, …). */
  connect?(): Promise<void>;

  /** Whether the store is currently usable without further user action. */
  isConnected(): boolean;

  /** Tear down any connection / wipe held credentials. */
  disconnect?(): Promise<void>;
}
