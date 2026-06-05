import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDefaultData } from '@/domain/normalize';
import type { TravelRecordRow } from '@/lib/database.types';

// Mock the Supabase client so the data layer can be tested with no live DB.
const { mockFrom, mockRpc, mockGetUser } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    auth: { getUser: mockGetUser },
  },
}));

// Import after the mock is registered.
const { fetchMyRecord, saveMyRecord, setSharing, fetchPublicRecord } = await import('./api');

/** A chainable query-builder stub whose terminal calls resolve to `result`. */
function builder<T>(result: { data: T; error: { message: string } | null }) {
  const b = {
    select: vi.fn(() => b),
    eq: vi.fn(() => b),
    upsert: vi.fn(() => b),
    update: vi.fn(() => b),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return b;
}

function row(overrides: Partial<TravelRecordRow> = {}): TravelRecordRow {
  return {
    id: 'rec-1',
    user_id: 'user-1',
    data: makeDefaultData(),
    is_public: false,
    share_slug: null,
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

describe('fetchMyRecord', () => {
  it('returns a normalized record when a row exists', async () => {
    mockFrom.mockReturnValue(builder({ data: row(), error: null }));
    const result = await fetchMyRecord();
    expect(result?.version).toBe(1);
    expect(result?.data.person.birthplace.country).toBe('Ukraine');
  });

  it('returns null when the user has no row yet', async () => {
    mockFrom.mockReturnValue(builder({ data: null, error: null }));
    expect(await fetchMyRecord()).toBeNull();
  });

  it('throws on a database error', async () => {
    mockFrom.mockReturnValue(builder({ data: null, error: { message: 'boom' } }));
    await expect(fetchMyRecord()).rejects.toThrow('boom');
  });
});

describe('saveMyRecord', () => {
  it('refuses to persist invalid data before touching the network', async () => {
    const invalid = makeDefaultData();
    invalid.person.birthplace.country = '';
    await expect(saveMyRecord(invalid)).rejects.toThrow(/Cannot save invalid data/);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('upserts valid data scoped to the authenticated user', async () => {
    const b = builder({ data: row({ version: 2 }), error: null });
    mockFrom.mockReturnValue(b);
    const result = await saveMyRecord(makeDefaultData());
    expect(b.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1' }),
      expect.objectContaining({ onConflict: 'user_id' }),
    );
    expect(result.version).toBe(2);
  });

  it('throws when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(saveMyRecord(makeDefaultData())).rejects.toThrow('Not authenticated.');
  });
});

describe('setSharing', () => {
  it('publishes and returns the updated record', async () => {
    const b = builder({ data: row({ is_public: true, share_slug: 'abc123' }), error: null });
    mockFrom.mockReturnValue(b);
    const result = await setSharing(true);
    expect(b.update).toHaveBeenCalledWith({ is_public: true });
    expect(result.isPublic).toBe(true);
    expect(result.shareSlug).toBe('abc123');
  });
});

describe('fetchPublicRecord', () => {
  it('resolves a slug to normalized data via the secure RPC', async () => {
    mockRpc.mockResolvedValue({ data: makeDefaultData(), error: null });
    const result = await fetchPublicRecord('abc123');
    expect(mockRpc).toHaveBeenCalledWith('get_shared_travel', { p_slug: 'abc123' });
    expect(result?.travel.countries[0]!.name).toBe('Austria');
  });

  it('returns null for an unknown or private slug', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    expect(await fetchPublicRecord('missing')).toBeNull();
  });

  it('throws on an RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } });
    await expect(fetchPublicRecord('x')).rejects.toThrow('rpc failed');
  });
});
