import type { TravelData } from '@/domain/schema';
import { validateTravelData } from '@/domain/schema';
import { normalizeTravelData } from '@/domain/normalize';
import type {
  Capabilities,
  DocMeta,
  DocumentStore,
  StorageDoc,
  StoreId,
  VersionToken,
} from './types';
import { IndexedDbStore } from './stores/IndexedDbStore';
import { LocalFileStore } from './stores/LocalFileStore';
import { SelfHostStore } from './stores/SelfHostStore';
import { GithubStore } from './stores/GithubStore';
import { WebdavStore } from './stores/WebdavStore';
import { GdriveStore } from './stores/GdriveStore';
import { DropboxStore } from './stores/DropboxStore';

/**
 * The storage registry: the single place that knows every backend, picks the
 * active one, and — critically — enforces the two cross-cutting invariants for
 * ALL providers in one wrapper (a net code reduction vs. per-adapter duplication):
 *
 *   - load()  always normalizes the raw blob via `normalizeTravelData`.
 *   - save()  always validates first and throws the EXACT
 *             `Cannot save invalid data: …` string on failure
 *             (matched by a regex in `lib/mutationError.ts` — do not change it).
 *
 * Individual stores deal only in shaping bytes ↔ `StorageDoc`; they never need to
 * remember to validate or normalize.
 */

const PROVIDER_KEY = 'travel-editor:storage-provider';

/** Stores that are fully implemented this wave (selectable & usable). */
const READY: Record<string, boolean> = {
  indexeddb: true,
  localfile: true,
  selfhost: true,
  github: false,
  webdav: false,
  gdrive: false,
  dropbox: false,
};

/** Public, registry-level metadata about a store (for the picker UI). */
export interface StoreInfo {
  id: StoreId;
  label: string;
  capabilities: Capabilities;
  /** False for not-yet-implemented backends — listed as "coming soon" / disabled. */
  ready: boolean;
}

// One instance per backend. Stores are cheap and mostly stateless (file/cloud
// stores hold a connection handle), so a module-level singleton list is fine.
const STORES: DocumentStore[] = [
  new IndexedDbStore(),
  new LocalFileStore(),
  new SelfHostStore(),
  new GithubStore(),
  new WebdavStore(),
  new GdriveStore(),
  new DropboxStore(),
];

const byId = new Map<StoreId, DocumentStore>(STORES.map((s) => [s.id, s]));

/** All registered stores with picker metadata. */
export function listStores(): StoreInfo[] {
  return STORES.map((s) => ({
    id: s.id,
    label: s.label,
    capabilities: s.capabilities,
    ready: READY[s.id] ?? false,
  }));
}

function getStore(id: StoreId): DocumentStore | undefined {
  return byId.get(id);
}

/**
 * Default backend when the user hasn't explicitly chosen one: always IndexedDB —
 * account-less, local-first, offline, always available. A remote backend (the
 * Atlas Server) is only ever used when the user explicitly opts in via the picker.
 */
function defaultStoreId(): StoreId {
  return 'indexeddb';
}

function readChoice(): StoreId | null {
  try {
    const raw = localStorage.getItem(PROVIDER_KEY);
    if (raw && byId.has(raw as StoreId) && (READY[raw] ?? false)) return raw as StoreId;
  } catch {
    /* ignore */
  }
  return null;
}

/** The id of the currently active store (persisted choice, else default). */
export function getActiveStoreId(): StoreId {
  return readChoice() ?? defaultStoreId();
}

/** Persist the active-store choice. Ignores unknown / not-ready ids. */
export function setActiveStore(id: StoreId): void {
  if (!byId.has(id) || !(READY[id] ?? false)) return;
  try {
    localStorage.setItem(PROVIDER_KEY, id);
  } catch {
    /* ignore */
  }
}

/**
 * The active store, wrapped so the load-normalize / save-validate invariants run
 * once for whichever backend is active. Returned as a `DocumentStore` so callers
 * are oblivious to the wrapping.
 */
export function getActiveStore(): DocumentStore {
  const inner = getStore(getActiveStoreId()) ?? getStore(defaultStoreId())!;
  return wrap(inner);
}

/**
 * Resolve a specific store by id (wrapped with the invariants). Returns `null`
 * for unknown OR not-ready ids, so a stale/forced choice can never resolve to a
 * "coming soon" stub whose load/save reject — callers fall back to the default.
 */
export function getStoreById(id: StoreId): DocumentStore | null {
  if (!(READY[id] ?? false)) return null;
  const inner = getStore(id);
  return inner ? wrap(inner) : null;
}

/** Wrap a store so normalize-on-load and validate-on-save are enforced centrally. */
function wrap(inner: DocumentStore): DocumentStore {
  const wrapped: DocumentStore = {
    id: inner.id,
    label: inner.label,
    capabilities: inner.capabilities,

    async load(): Promise<StorageDoc | null> {
      const doc = await inner.load();
      if (!doc) return null;
      // Centralized normalize-on-load: no adapter can forget it.
      return { data: normalizeTravelData(doc.data), meta: doc.meta };
    },

    async save(data: TravelData, expected?: VersionToken): Promise<StorageDoc> {
      // Centralized validate-on-save. EXACT prefix — see lib/mutationError.ts.
      const validation = validateTravelData(data);
      if (!validation.ok) {
        throw new Error(`Cannot save invalid data: ${validation.errors[0]}`);
      }
      return inner.save(data, expected);
    },

    isConnected: () => inner.isConnected(),
  };

  if (inner.setSharing) {
    wrapped.setSharing = (isPublic: boolean): Promise<DocMeta> => inner.setSharing!(isPublic);
  }
  if (inner.readPublic) {
    wrapped.readPublic = (slug: string): Promise<TravelData | null> => inner.readPublic!(slug);
  }
  if (inner.connect) {
    wrapped.connect = (): Promise<void> => inner.connect!();
  }
  if (inner.disconnect) {
    wrapped.disconnect = (): Promise<void> => inner.disconnect!();
  }

  return wrapped;
}
