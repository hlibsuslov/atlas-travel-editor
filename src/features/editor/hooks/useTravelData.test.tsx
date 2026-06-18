import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeDefaultData } from '@/domain/normalize';
import { useEditorStore } from '@/features/editor/store';
import { writeCache } from '@/features/editor/cache';
import type { TravelRecord } from '@/features/editor/api';

const { mockFetch, mockSave } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockSave: vi.fn(),
}));

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: {}, loading: false }),
}));

// Make the storage registry resolve to the Supabase backend (which delegates to
// the mocked api below), so the hook exercises the authenticated cloud path.
vi.mock('@/lib/env', () => ({
  env: {
    supabaseConfigured: true,
    backendOptional: false,
    localOnly: false,
    demoAuth: false,
    appUrl: 'http://localhost',
  },
  envError: null,
}));

vi.mock('@/features/editor/api', () => ({
  fetchMyRecord: mockFetch,
  saveMyRecord: mockSave,
  setSharing: vi.fn(),
  fetchPublicRecord: vi.fn(),
}));

const { useTravelData } = await import('./useTravelData');

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const record = (data = makeDefaultData()): TravelRecord => ({
  data,
  isPublic: false,
  shareSlug: null,
  version: 1,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useEditorStore.getState().setData(makeDefaultData(), { markClean: true });
});

describe('useTravelData', () => {
  it('hydrates the store from the offline cache before the network resolves', async () => {
    const cached = makeDefaultData();
    cached.person.birthplace.country = 'CachedLand';
    writeCache('user-1', cached);
    // Network stays pending so only the cache path runs.
    mockFetch.mockReturnValue(new Promise(() => {}));

    renderHook(() => useTravelData(), { wrapper });

    await waitFor(() => {
      expect(useEditorStore.getState().data.person.birthplace.country).toBe('CachedLand');
    });
    expect(useEditorStore.getState().dirty).toBe(false);
  });

  it('reconciles the store with server data once it arrives', async () => {
    const server = makeDefaultData();
    server.person.birthplace.country = 'ServerLand';
    mockFetch.mockResolvedValue(record(server));

    renderHook(() => useTravelData(), { wrapper });

    await waitFor(() => {
      expect(useEditorStore.getState().data.person.birthplace.country).toBe('ServerLand');
    });
  });

  it('marks the store clean after a successful save', async () => {
    mockFetch.mockResolvedValue(record());
    mockSave.mockResolvedValue(record());

    const { result } = renderHook(() => useTravelData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Make a local edit, then save.
    act(() => useEditorStore.getState().setBirthplace('Edited'));
    expect(useEditorStore.getState().dirty).toBe(true);

    await act(async () => {
      await result.current.save.mutateAsync(useEditorStore.getState().data);
    });

    expect(mockSave).toHaveBeenCalled();
    expect(useEditorStore.getState().dirty).toBe(false);
  });
});
