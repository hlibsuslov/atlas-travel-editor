import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeDefaultData } from '@/domain/normalize';
import { useEditorStore } from '@/features/editor/store';
import { writeCache } from '@/features/editor/cache';
import type { StorageDoc } from '@/lib/storage/types';

/**
 * useTravelData is backend-agnostic: it resolves the active DocumentStore from the
 * registry and drives hydrate-from-cache → reconcile → save. We mock the registry
 * with a controllable fake store so the hook's reconcile/save logic is exercised
 * independently of any concrete backend (IndexedDB, the Atlas Server, …).
 */
const { mockLoad, mockSave } = vi.hoisted(() => ({ mockLoad: vi.fn(), mockSave: vi.fn() }));

const fakeStore = {
  id: 'indexeddb' as const,
  label: 'fake',
  capabilities: {
    sharing: false,
    concurrency: 'token' as const,
    watch: false,
    list: false,
    auth: false,
  },
  load: mockLoad,
  save: mockSave,
  isConnected: () => true,
};

vi.mock('@/lib/storage/registry', () => ({
  getActiveStoreId: () => 'indexeddb',
  getStoreById: () => fakeStore,
}));

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: {}, loading: false }),
}));

const { useTravelData } = await import('./useTravelData');

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const doc = (country = 'Ukraine', version = 1): StorageDoc => {
  const data = makeDefaultData();
  data.person.birthplace.country = country;
  return { data, meta: { version, isPublic: false, shareSlug: null } };
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useEditorStore.getState().setData(makeDefaultData(), { markClean: true });
});

describe('useTravelData', () => {
  it('hydrates the store from the offline cache before the backend resolves', async () => {
    const cached = makeDefaultData();
    cached.person.birthplace.country = 'CachedLand';
    writeCache('user-1', cached);
    mockLoad.mockReturnValue(new Promise(() => {})); // stays pending

    renderHook(() => useTravelData(), { wrapper });

    await waitFor(() => {
      expect(useEditorStore.getState().data.person.birthplace.country).toBe('CachedLand');
    });
    expect(useEditorStore.getState().dirty).toBe(false);
  });

  it('reconciles the store with backend data once it arrives', async () => {
    mockLoad.mockResolvedValue(doc('ServerLand'));

    renderHook(() => useTravelData(), { wrapper });

    await waitFor(() => {
      expect(useEditorStore.getState().data.person.birthplace.country).toBe('ServerLand');
    });
  });

  it('does not clobber unsaved local edits that arrive during the load window', async () => {
    let resolve!: (d: StorageDoc) => void;
    mockLoad.mockReturnValue(new Promise<StorageDoc>((res) => (resolve = res)));

    const { result } = renderHook(() => useTravelData(), { wrapper });

    // The user edits while the load is still in flight.
    act(() => useEditorStore.getState().setBirthplace('LocalEdit'));
    expect(useEditorStore.getState().dirty).toBe(true);

    await act(async () => {
      resolve(doc('ServerLand'));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The in-flight edit survives — it was NOT overwritten by the backend payload.
    expect(useEditorStore.getState().data.person.birthplace.country).toBe('LocalEdit');
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it('marks the store clean after a successful save', async () => {
    mockLoad.mockResolvedValue(doc());
    mockSave.mockResolvedValue(doc('Edited', 2));

    const { result } = renderHook(() => useTravelData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => useEditorStore.getState().setBirthplace('Edited'));
    expect(useEditorStore.getState().dirty).toBe(true);

    await act(async () => {
      await result.current.save.mutateAsync(useEditorStore.getState().data);
    });

    expect(mockSave).toHaveBeenCalled();
    expect(useEditorStore.getState().dirty).toBe(false);
  });
});
