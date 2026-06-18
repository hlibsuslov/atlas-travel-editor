import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDefaultData } from '@/domain/normalize';
import { ConflictError } from '../types';

/**
 * Tests the IndexedDbStore's version-counter / envelope logic against an
 * in-memory fake of the `idb` API (no real IndexedDB needed in jsdom). The fake
 * implements exactly the surface the store uses: db.get/delete and a
 * read-modify-write transaction with objectStore.get/put + tx.done.
 */
const { store: backing } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));

vi.mock('idb', () => {
  const objectStore = {
    get: (key: string) => Promise.resolve(backing.get(key)),
    put: (value: unknown, key: string) => {
      backing.set(key, value);
      return Promise.resolve();
    },
  };
  const db = {
    get: (_store: string, key: string) => Promise.resolve(backing.get(key)),
    delete: (_store: string, key: string) => {
      backing.delete(key);
      return Promise.resolve();
    },
    transaction: () => ({ objectStore: () => objectStore, done: Promise.resolve() }),
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
  };
  return { openDB: vi.fn(() => Promise.resolve(db)) };
});

const { IndexedDbStore } = await import('./IndexedDbStore');

beforeEach(() => {
  backing.clear();
});

describe('IndexedDbStore', () => {
  it('returns null when nothing is stored yet', async () => {
    const store = new IndexedDbStore();
    expect(await store.load()).toBeNull();
  });

  it('saves then loads the document with a monotonic version', async () => {
    const store = new IndexedDbStore();
    const data = makeDefaultData();

    const saved = await store.save(data);
    expect(saved.meta.version).toBe(1);
    expect(saved.meta.isPublic).toBe(false);
    expect(saved.data).toEqual(data);

    const loaded = await store.load();
    expect(loaded?.meta.version).toBe(1);
    expect(loaded?.data).toEqual(data);
    expect(loaded?.meta.updatedAt).toBeTypeOf('string');
  });

  it('increments the version on each save', async () => {
    const store = new IndexedDbStore();
    const a = await store.save(makeDefaultData());
    const b = await store.save(makeDefaultData());
    expect(a.meta.version).toBe(1);
    expect(b.meta.version).toBe(2);
  });

  it('throws ConflictError when the expected version is stale', async () => {
    const store = new IndexedDbStore();
    await store.save(makeDefaultData()); // version 1

    // Caller still thinks it is at version 0 (or any non-1 value).
    await expect(store.save(makeDefaultData(), 0)).rejects.toBeInstanceOf(ConflictError);
  });

  it('accepts a save when the expected version matches', async () => {
    const store = new IndexedDbStore();
    const first = await store.save(makeDefaultData());
    const second = await store.save(makeDefaultData(), first.meta.version);
    expect(second.meta.version).toBe(2);
  });

  it('clears the document on disconnect', async () => {
    const store = new IndexedDbStore();
    await store.save(makeDefaultData());
    await store.disconnect();
    expect(await store.load()).toBeNull();
  });
});
