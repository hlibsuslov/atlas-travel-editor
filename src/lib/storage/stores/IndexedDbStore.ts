import { openDB, type IDBPDatabase } from 'idb';
import type { TravelData } from '@/domain/schema';
import type { DocumentStore, StorageDoc, Capabilities, VersionToken } from '../types';
import { ConflictError } from '../types';
import { wrapEnvelope, readEnvelope, type PortableEnvelope } from '../envelope';

/**
 * Account-less local-first store. Persists the single travel document in
 * IndexedDB (durable, async, far larger than the 5MB localStorage cache) with a
 * monotonic integer version counter for optimistic concurrency. This is the
 * default when no Supabase backend is configured: no login wall, no network.
 *
 * The blob is stored inside the portable envelope so the same bytes round-trip
 * through file export/import without translation.
 */

const DB_NAME = 'travel-editor';
const DB_VERSION = 1;
const STORE = 'documents';
const DOC_KEY = 'travel-data';

interface StoredRecord {
  envelope: PortableEnvelope;
  version: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

const IDB_CAPS: Capabilities = {
  sharing: false,
  concurrency: 'token',
  watch: false,
  list: false,
  auth: false,
};

export class IndexedDbStore implements DocumentStore {
  readonly id = 'indexeddb' as const;
  readonly label = 'This device (IndexedDB)';
  readonly capabilities = IDB_CAPS;

  async load(): Promise<StorageDoc | null> {
    const db = await getDb();
    const record = (await db.get(STORE, DOC_KEY)) as StoredRecord | undefined;
    if (!record) return null;
    const { data, updatedAt } = readEnvelope(record.envelope);
    return { data, meta: { version: record.version, isPublic: false, shareSlug: null, updatedAt } };
  }

  async save(data: TravelData, expected?: VersionToken): Promise<StorageDoc> {
    const db = await getDb();
    // Read-modify-write inside one transaction so the version check is atomic.
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const current = (await store.get(DOC_KEY)) as StoredRecord | undefined;
    const currentVersion = current?.version ?? null;

    // Optimistic concurrency: only enforce when the caller supplied an expected
    // version (undefined means "first write / don't care").
    if (expected !== undefined && currentVersion !== expected) {
      await tx.done;
      const remoteDoc = current ? readEnvelope(current.envelope).data : data;
      throw new ConflictError({
        data: remoteDoc,
        meta: { version: currentVersion, isPublic: false, shareSlug: null },
      });
    }

    const nextVersion = (current?.version ?? 0) + 1;
    const updatedAt = new Date().toISOString();
    const next: StoredRecord = { envelope: wrapEnvelope(data, updatedAt), version: nextVersion };
    await store.put(next, DOC_KEY);
    await tx.done;
    return { data, meta: { version: nextVersion, isPublic: false, shareSlug: null, updatedAt } };
  }

  isConnected(): boolean {
    return true;
  }

  async disconnect(): Promise<void> {
    const db = await getDb();
    await db.delete(STORE, DOC_KEY);
  }
}
