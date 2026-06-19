import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { useEditorStore } from '@/features/editor/store';
import { makeDefaultData } from '@/domain/normalize';
import type { TravelData } from '@/domain/schema';
import type { TravelRecord } from '@/features/editor/api';
import { readCache, writeCache, localCacheId } from '@/features/editor/cache';
import { backoffDelay, retryTransient } from '@/lib/mutationError';
import { getActiveStoreId, getStoreById } from '@/lib/storage/registry';
import type { StorageDoc } from '@/lib/storage/types';

/**
 * Bridges the active storage backend, the offline cache, and the editor store.
 *
 * The backend is resolved from the storage registry rather than imported
 * directly, so the same hook drives IndexedDB, a local file, the Atlas Server, or
 * any future provider — while keeping the public return shape EXACTLY the same
 * (`{ record, isLoading, isOffline, save, share }`) so consumers need no change.
 *
 * On mount it hydrates the store from cache immediately (instant UI), then
 * reconciles with the active backend. The strict validator lives in the registry
 * wrapper, so saves through any provider are validated identically.
 */

/** Map a backend `StorageDoc` to the legacy `TravelRecord` shape the UI expects. */
function toRecord(doc: StorageDoc): TravelRecord {
  return {
    data: doc.data,
    isPublic: doc.meta.isPublic,
    shareSlug: doc.meta.shareSlug,
    // The UI only reads `version` opaquely; coerce the token to a number for the
    // legacy shape (account-less backends use a monotonic int already).
    version: typeof doc.meta.version === 'number' ? doc.meta.version : 0,
  };
}

export function useTravelData() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const setStoreData = useEditorStore((s) => s.setData);

  // The active backend, resolved from the registry's persisted choice (or the
  // default-selection rule). Re-resolves if the user switches providers, so the
  // query key and store stay in sync.
  const storeId = getActiveStoreId();
  // Resolve the active backend by id so the memo genuinely depends on `storeId`
  // and re-resolves when the user switches providers. `getStoreById` returns the
  // same wrapped store `getActiveStore()` would; falling back keeps it non-null.
  const store = useMemo(
    () => getStoreById(storeId) ?? getStoreById(getActiveStoreId())!,
    [storeId],
  );

  // Account-less backends (IndexedDB, local file) work without a signed-in user,
  // so the query is enabled whenever the store doesn't require auth.
  const enabled = store.capabilities.auth ? !!userId : true;
  // Cache key: per-user when authed, else a stable per-backend key.
  const cacheKey = userId ?? localCacheId(storeId);

  const query = useQuery<TravelRecord | null>({
    queryKey: ['travel-record', storeId, cacheKey],
    enabled,
    queryFn: async () => {
      const doc = await store.load();
      return doc ? toRecord(doc) : null;
    },
  });

  // Hydrate store from cache as soon as we can (before the backend resolves).
  useEffect(() => {
    const cached = readCache(cacheKey);
    if (cached) setStoreData(cached, { markClean: true });
  }, [cacheKey, setStoreData]);

  // Reconcile store with backend data once it arrives.
  useEffect(() => {
    if (!enabled || !query.isSuccess) return;
    const serverData = query.data?.data ?? makeDefaultData();
    // Keep the offline cache fresh regardless of whether we adopt the payload.
    writeCache(cacheKey, serverData);
    const store = useEditorStore.getState();
    // Never clobber unsaved local edits made during the load window — adopting the
    // server payload here would silently discard them. The edits stay; the next
    // save reconciles. (A field-level merge is a deferred follow-up.)
    if (store.dirty) return;
    // Only adopt when the server actually differs — re-`setData` wipes undo history
    // and re-renders, so skipping identical payloads avoids needless churn (e.g. a
    // refetch returning the same document, or the post-save query update).
    if (JSON.stringify(store.data) === JSON.stringify(serverData)) return;
    setStoreData(serverData, { markClean: true });
  }, [enabled, query.isSuccess, query.data, setStoreData, cacheKey]);

  const save = useMutation({
    mutationFn: async (data: TravelData) => {
      const doc = await store.save(data, query.data?.version ?? undefined);
      return toRecord(doc);
    },
    // Retry transient network/RPC failures with backoff; never retry validation
    // or auth errors (they're deterministic).
    retry: retryTransient(2),
    retryDelay: backoffDelay,
    onSuccess: (record) => {
      writeCache(cacheKey, record.data);
      queryClient.setQueryData(['travel-record', storeId, cacheKey], record);
      useEditorStore.getState().markClean();
    },
  });

  const share = useMutation({
    mutationFn: async (isPublic: boolean): Promise<TravelRecord> => {
      const base: TravelRecord = query.data ?? {
        data: makeDefaultData(),
        isPublic: false,
        shareSlug: null,
        version: 0,
      };
      // Sharing is a backend capability (the Atlas Server); degrade gracefully on
      // backends that lack it by returning the current record unchanged.
      if (!store.setSharing) return base;
      const meta = await store.setSharing(isPublic);
      return {
        ...base,
        isPublic: meta.isPublic,
        shareSlug: meta.shareSlug,
        version: typeof meta.version === 'number' ? meta.version : base.version,
      };
    },
    onSuccess: (record) => {
      queryClient.setQueryData(['travel-record', storeId, cacheKey], record);
    },
  });

  return {
    record: query.data ?? null,
    isLoading: query.isLoading,
    isOffline: query.isError,
    save,
    share,
  };
}
