import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeDefaultData } from '@/domain/normalize';
import { useEditorStore } from '@/features/editor/store';
import type { StorageDoc } from '@/lib/storage/types';

/**
 * useDataSync is the single global autosave mount; useSaveStatus is the read-only
 * status it shares with <SaveStatus/>. Both lean on useTravelData, so we mock the
 * storage registry with a controllable fake store (mirrors useTravelData.test).
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

const { useDataSync, useSaveStatus } = await import('./useDataSync');

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

afterEach(() => {
  // Some tests opt into fake timers; always restore real timers afterwards so
  // `waitFor` in sibling tests isn't left frozen.
  vi.useRealTimers();
});

describe('useSaveStatus', () => {
  it('reports synced for a clean document and unsaved after a valid edit', async () => {
    mockLoad.mockResolvedValue(doc());
    const { result } = renderHook(() => useSaveStatus(), { wrapper });

    await waitFor(() => expect(result.current.state).toBe('synced'));

    act(() => useEditorStore.getState().setBirthplace('Edited'));
    expect(result.current.state).toBe('unsaved');
  });

  it('reports offline when the backend load fails', async () => {
    mockLoad.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useSaveStatus(), { wrapper });
    await waitFor(() => expect(result.current.state).toBe('offline'));
  });
});

describe('useDataSync', () => {
  it('autosaves a valid dirty document after the debounce settles', async () => {
    mockLoad.mockResolvedValue(doc());
    mockSave.mockResolvedValue(doc('Edited', 2));
    vi.useFakeTimers();

    renderHook(() => useDataSync(), { wrapper });
    // Let the initial backend load resolve so we're not "offline".
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => useEditorStore.getState().setBirthplace('Edited'));
    expect(mockSave).not.toHaveBeenCalled();

    // Advance past the 1500ms autosave debounce.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});
