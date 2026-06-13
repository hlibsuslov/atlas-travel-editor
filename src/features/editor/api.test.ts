import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDefaultData } from '@/domain/normalize';
import type { TravelDocumentEnvelope } from '@/lib/database.types';

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

function envelope(overrides: Partial<TravelDocumentEnvelope> = {}): TravelDocumentEnvelope {
  return {
    data: makeDefaultData(),
    is_public: false,
    share_slug: null,
    version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

describe('fetchMyRecord', () => {
  it('returns a normalized record when the document exists', async () => {
    mockRpc.mockResolvedValue({ data: envelope(), error: null });
    const result = await fetchMyRecord();
    expect(mockRpc).toHaveBeenCalledWith('get_my_travel_document');
    expect(result?.version).toBe(1);
    expect(result?.data.person.birthplace.country).toBe('Ukraine');
  });

  it('returns null when the user has no document yet', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    expect(await fetchMyRecord()).toBeNull();
  });

  it('throws on a database error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchMyRecord()).rejects.toThrow('boom');
  });
});

describe('saveMyRecord', () => {
  it('refuses to persist invalid data before touching the network', async () => {
    const invalid = makeDefaultData();
    invalid.person.birthplace.country = '';
    await expect(saveMyRecord(invalid)).rejects.toThrow(/Cannot save invalid data/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('sends the whole document to the save RPC and returns the new version', async () => {
    const data = makeDefaultData();
    mockRpc.mockResolvedValue({ data: envelope({ version: 2 }), error: null });
    const result = await saveMyRecord(data);
    expect(mockRpc).toHaveBeenCalledWith('save_travel_document', { p_data: data });
    expect(result.version).toBe(2);
  });

  it('throws when the RPC reports an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Not authenticated.' } });
    await expect(saveMyRecord(makeDefaultData())).rejects.toThrow('Not authenticated.');
  });
});

describe('setSharing', () => {
  it('publishes and returns the updated record', async () => {
    mockRpc.mockResolvedValue({
      data: envelope({ is_public: true, share_slug: 'abc123' }),
      error: null,
    });
    const result = await setSharing(true);
    expect(mockRpc).toHaveBeenCalledWith('set_travel_sharing', { p_is_public: true });
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
