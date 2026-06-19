import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDefaultData } from '@/domain/normalize';
import { ConflictError } from '../types';

const { mockLoad, mockSave, mockSetVis, mockGetPublic } = vi.hoisted(() => ({
  mockLoad: vi.fn(),
  mockSave: vi.fn(),
  mockSetVis: vi.fn(),
  mockGetPublic: vi.fn(),
}));

vi.mock('@/lib/atlas/client', () => ({
  atlasLoadDoc: mockLoad,
  atlasSaveDoc: mockSave,
  atlasSetVisibility: mockSetVis,
  atlasGetPublic: mockGetPublic,
  getAtlasUrl: () => 'http://atlas.test',
  getToken: () => 'token-123',
}));

const { SelfHostStore } = await import('./SelfHostStore');

const docResponse = (country = 'Ukraine', version = 1) => {
  const data = makeDefaultData();
  data.person.birthplace.country = country;
  return { data, is_public: false, share_slug: null, version };
};

beforeEach(() => vi.clearAllMocks());

describe('SelfHostStore', () => {
  it('is connected when a URL and token are present', () => {
    expect(new SelfHostStore().isConnected()).toBe(true);
  });

  it('load() maps the server document to a StorageDoc', async () => {
    mockLoad.mockResolvedValue(docResponse('Poland', 3));
    const doc = await new SelfHostStore().load();
    expect(doc?.data.person.birthplace.country).toBe('Poland');
    expect(doc?.meta.version).toBe(3);
    expect(doc?.meta.isPublic).toBe(false);
  });

  it('load() returns null when the server has no document', async () => {
    mockLoad.mockResolvedValue(null);
    expect(await new SelfHostStore().load()).toBeNull();
  });

  it('save() returns the new StorageDoc on success', async () => {
    mockSave.mockResolvedValue({ conflict: false, doc: docResponse('Spain', 2) });
    const doc = await new SelfHostStore().save(makeDefaultData(), 1);
    expect(doc.meta.version).toBe(2);
    expect(mockSave).toHaveBeenCalledWith(expect.anything(), 1);
  });

  it('save() throws ConflictError carrying the remote doc on a stale write', async () => {
    mockSave.mockResolvedValue({ conflict: true, doc: docResponse('Server', 5) });
    const store = new SelfHostStore();
    await expect(store.save(makeDefaultData(), 1)).rejects.toBeInstanceOf(ConflictError);
    try {
      await store.save(makeDefaultData(), 1);
    } catch (err) {
      expect((err as ConflictError).remote.meta.version).toBe(5);
    }
  });

  it('save() passes a null expected version through when none is supplied', async () => {
    mockSave.mockResolvedValue({ conflict: false, doc: docResponse('X', 1) });
    await new SelfHostStore().save(makeDefaultData());
    expect(mockSave).toHaveBeenCalledWith(expect.anything(), null);
  });

  it('setSharing(true) publishes and maps the response to DocMeta', async () => {
    mockSetVis.mockResolvedValue({
      ...docResponse(),
      is_public: true,
      share_slug: 'abc',
      version: 4,
    });
    const meta = await new SelfHostStore().setSharing(true);
    expect(mockSetVis).toHaveBeenCalledWith('public');
    expect(meta).toEqual({ version: 4, isPublic: true, shareSlug: 'abc' });
  });

  it('setSharing(false) unpublishes', async () => {
    mockSetVis.mockResolvedValue({
      ...docResponse(),
      is_public: false,
      share_slug: null,
      version: 5,
    });
    await new SelfHostStore().setSharing(false);
    expect(mockSetVis).toHaveBeenCalledWith('private');
  });

  it('readPublic() returns the public document data, or null', async () => {
    mockGetPublic.mockResolvedValue({
      data: docResponse('Italy').data,
      profile: { display_name: 'P', accent_color: '#000', handle: 'p' },
    });
    const data = await new SelfHostStore().readPublic('slug');
    expect(data?.person.birthplace.country).toBe('Italy');

    mockGetPublic.mockResolvedValue(null);
    expect(await new SelfHostStore().readPublic('missing')).toBeNull();
  });
});
