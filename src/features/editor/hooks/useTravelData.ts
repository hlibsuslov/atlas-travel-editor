import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { useEditorStore } from '@/features/editor/store';
import { makeDefaultData } from '@/domain/normalize';
import type { TravelData } from '@/domain/schema';
import { fetchMyRecord, saveMyRecord, setSharing, type TravelRecord } from '@/features/editor/api';
import { readCache, writeCache } from '@/features/editor/cache';

/**
 * Bridges the server (Supabase), the offline cache, and the editor store.
 *
 * On mount it hydrates the store from cache immediately (instant UI), then
 * reconciles with the server. Saves are explicit (user-triggered) and go
 * through the strict validator in `saveMyRecord`.
 */
export function useTravelData() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const setStoreData = useEditorStore((s) => s.setData);

  const query = useQuery<TravelRecord | null>({
    queryKey: ['travel-record', userId],
    enabled: !!userId,
    queryFn: fetchMyRecord,
  });

  // Hydrate store from cache as soon as we know the user (before network).
  useEffect(() => {
    if (!userId) return;
    const cached = readCache(userId);
    if (cached) setStoreData(cached, { markClean: true });
  }, [userId, setStoreData]);

  // Reconcile store with server data once it arrives.
  useEffect(() => {
    if (!userId || !query.isSuccess) return;
    const serverData = query.data?.data ?? makeDefaultData();
    setStoreData(serverData, { markClean: true });
    writeCache(userId, serverData);
  }, [userId, query.isSuccess, query.data, setStoreData]);

  const save = useMutation({
    mutationFn: async (data: TravelData) => saveMyRecord(data),
    onSuccess: (record) => {
      if (userId) writeCache(userId, record.data);
      queryClient.setQueryData(['travel-record', userId], record);
      useEditorStore.getState().markClean();
    },
  });

  const share = useMutation({
    mutationFn: async (isPublic: boolean) => setSharing(isPublic),
    onSuccess: (record) => {
      queryClient.setQueryData(['travel-record', userId], record);
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
