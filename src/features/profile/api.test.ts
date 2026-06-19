import { beforeEach, describe, expect, it, vi } from 'vitest';

const { state, atlasMe, atlasUpdateProfile, atlasGetPublic } = vi.hoisted(() => ({
  state: { url: null as string | null },
  atlasMe: vi.fn(),
  atlasUpdateProfile: vi.fn(),
  atlasGetPublic: vi.fn(),
}));

vi.mock('@/lib/atlas/client', () => ({
  getAtlasUrl: () => state.url,
  atlasMe,
  atlasUpdateProfile,
  atlasGetPublic,
}));

const { getMyProfile, saveMyProfile, fetchSharedProfile } = await import('./api');

beforeEach(() => {
  vi.clearAllMocks();
  state.url = null;
});

describe('profile/api — local-first (no server)', () => {
  it('getMyProfile resolves null', async () => {
    expect(await getMyProfile()).toBeNull();
  });

  it('saveMyProfile echoes the input optimistically', async () => {
    const p = await saveMyProfile('Ada', '#1f9d6b', 'ada');
    expect(p).toEqual({ display_name: 'Ada', accent_color: '#1f9d6b', public_handle: 'ada' });
    expect(atlasUpdateProfile).not.toHaveBeenCalled();
  });

  it('fetchSharedProfile resolves null', async () => {
    expect(await fetchSharedProfile('slug')).toBeNull();
  });
});

describe('profile/api — server connected', () => {
  beforeEach(() => {
    state.url = 'http://atlas.test';
  });

  it('getMyProfile maps the server profile', async () => {
    atlasMe.mockResolvedValue({
      user: { id: 'u', email: 'a@b', username: 'a' },
      profile: { display_name: 'Ada', accent_color: '#000', handle: 'ada' },
    });
    expect(await getMyProfile()).toEqual({
      display_name: 'Ada',
      accent_color: '#000',
      public_handle: 'ada',
    });
  });

  it('saveMyProfile sends to the server and maps the result', async () => {
    atlasUpdateProfile.mockResolvedValue({
      display_name: 'Ada',
      accent_color: '#000',
      handle: 'ada',
    });
    const p = await saveMyProfile('Ada', '#000', 'ada');
    expect(atlasUpdateProfile).toHaveBeenCalledWith({
      display_name: 'Ada',
      accent_color: '#000',
      handle: 'ada',
    });
    expect(p.public_handle).toBe('ada');
  });

  it('fetchSharedProfile maps the public profile slice', async () => {
    atlasGetPublic.mockResolvedValue({
      data: {},
      profile: { display_name: 'Bo', accent_color: '#e0506b', handle: 'bo' },
    });
    expect(await fetchSharedProfile('slug')).toEqual({
      display_name: 'Bo',
      accent_color: '#e0506b',
    });
  });
});
