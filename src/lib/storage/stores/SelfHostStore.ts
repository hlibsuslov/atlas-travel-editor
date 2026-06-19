import type { TravelData } from '@/domain/schema';
import {
  atlasGetPublic,
  atlasLoadDoc,
  atlasSaveDoc,
  atlasSetVisibility,
  getAtlasUrl,
  getToken,
} from '@/lib/atlas/client';
import {
  ConflictError,
  type Capabilities,
  type DocMeta,
  type DocumentStore,
  type StorageDoc,
  type VersionToken,
} from '../types';

/**
 * DocumentStore backed by a self-hosted **Atlas Server** instance. It is the first
 * store with real token concurrency: a stale save surfaces as the shared
 * {@link ConflictError} carrying the remote document, so the editor's
 * keep-mine / take-theirs flow works unchanged. Local-first stays the source of
 * truth; this store only engages when the user has connected a server.
 *
 * Normalize-on-load and validate-on-save are enforced centrally by the registry
 * wrapper, so this adapter only shapes bytes ↔ StorageDoc.
 */
const SELFHOST_CAPS: Capabilities = {
  sharing: true,
  concurrency: 'token',
  watch: false,
  list: false,
  auth: true,
};

export class SelfHostStore implements DocumentStore {
  readonly id = 'selfhost' as const;
  readonly label = 'Atlas Server (self-hosted)';
  readonly capabilities = SELFHOST_CAPS;

  async load(): Promise<StorageDoc | null> {
    const res = await atlasLoadDoc();
    if (!res) return null;
    return {
      data: res.data as TravelData,
      meta: { version: res.version, isPublic: res.is_public, shareSlug: res.share_slug },
    };
  }

  async save(data: TravelData, expected?: VersionToken): Promise<StorageDoc> {
    const expectedVersion = typeof expected === 'number' ? expected : null;
    const { conflict, doc } = await atlasSaveDoc(data, expectedVersion);
    const result: StorageDoc = {
      data: doc.data as TravelData,
      meta: { version: doc.version, isPublic: doc.is_public, shareSlug: doc.share_slug },
    };
    if (conflict) throw new ConflictError(result);
    return result;
  }

  /** Toggle public sharing. `true` publishes (discoverable + slug); `false` unpublishes. */
  async setSharing(isPublic: boolean): Promise<DocMeta> {
    const res = await atlasSetVisibility(isPublic ? 'public' : 'private');
    return { version: res.version, isPublic: res.is_public, shareSlug: res.share_slug };
  }

  /** Resolve a public share slug to its document (no auth needed). */
  async readPublic(slug: string): Promise<TravelData | null> {
    const view = await atlasGetPublic(slug);
    return view ? (view.data as TravelData) : null;
  }

  isConnected(): boolean {
    return !!getAtlasUrl() && !!getToken();
  }
}
