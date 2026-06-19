import { beforeEach, describe, expect, it, vi } from 'vitest';

const { state, addFollow } = vi.hoisted(() => ({
  state: { url: null as string | null },
  addFollow: vi.fn(),
}));

vi.mock('@/lib/atlas/client', () => ({
  getAtlasUrl: () => state.url,
  atlasAddFollow: addFollow,
  atlasListFollows: vi.fn(() => Promise.resolve([])),
  atlasRemoveFollow: vi.fn(() => Promise.resolve()),
}));

const { extractSlug, addFriend, listFriends } = await import('./api');

beforeEach(() => {
  vi.clearAllMocks();
  state.url = 'http://atlas.test';
  addFollow.mockResolvedValue({});
});

describe('extractSlug', () => {
  it('returns a bare slug unchanged', () => {
    expect(extractSlug('abc123XYZ')).toBe('abc123XYZ');
  });

  it('extracts the slug from a full share URL', () => {
    expect(extractSlug('https://app.example.com/share/abc123')).toBe('abc123');
    expect(extractSlug('http://localhost:5173/share/xy-_Z9?x=1')).toBe('xy-_Z9');
  });

  it('strips unsafe characters and whitespace', () => {
    expect(extractSlug('  abc/123  ')).toBe('abc123');
    expect(extractSlug('a b c!@#')).toBe('abc');
  });

  it('returns empty string for empty input', () => {
    expect(extractSlug('   ')).toBe('');
  });
});

describe('addFriend target parsing', () => {
  it('follows by slug for a /share/ link', async () => {
    await addFriend('https://app.example.com/share/abc123');
    expect(addFollow).toHaveBeenCalledWith({ slug: 'abc123', label: undefined });
  });

  it('follows by handle for a /u/ link', async () => {
    await addFriend('https://app.example.com/u/alice');
    expect(addFollow).toHaveBeenCalledWith({ handle: 'alice', label: undefined });
  });

  it('sends a bare token as both handle and slug for the server to resolve', async () => {
    await addFriend('Alice');
    expect(addFollow).toHaveBeenCalledWith({ handle: 'alice', slug: 'Alice', label: undefined });
  });

  it('throws when no server is connected', async () => {
    state.url = null;
    await expect(addFriend('x')).rejects.toThrow(/connected Atlas Server/);
  });
});

describe('listFriends', () => {
  it('returns an empty list when no server is connected', async () => {
    state.url = null;
    expect(await listFriends()).toEqual([]);
  });
});
