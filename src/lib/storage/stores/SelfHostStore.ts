import type { TravelData } from '@/domain/schema';
import type { Capabilities, DocumentStore, StorageDoc, VersionToken } from '../types';

/**
 * PLACEHOLDER adapter for the self-hostable **Atlas Server** — our own OSS sharing
 * and social backend. It reserves the seam slot and the `selfhost` StoreId so that
 * a later sprint only needs to fill in the `fetch()` bodies (auth, document
 * load/save with `If-Match` optimistic concurrency, sharing, public reads) without
 * structural churn.
 *
 * It is registered as NOT ready (`READY.selfhost = false`), so it is never the
 * active store yet; `load`/`save` throw a clear "not yet available" error if ever
 * reached. This will become the first store with BOTH `sharing` AND real token
 * concurrency — exactly what the {@link DocumentStore} seam was designed for.
 */
const SELFHOST_CAPS: Capabilities = {
  sharing: true,
  concurrency: 'token',
  watch: false,
  list: false,
  auth: true,
};

const NOT_AVAILABLE = 'Self-host backend not yet available.';

export class SelfHostStore implements DocumentStore {
  readonly id = 'selfhost' as const;
  readonly label = 'Atlas Server (self-hosted)';
  readonly capabilities = SELFHOST_CAPS;

  load(): Promise<StorageDoc | null> {
    return Promise.reject(new Error(NOT_AVAILABLE));
  }

  save(_data: TravelData, _expected?: VersionToken): Promise<StorageDoc> {
    void _data;
    void _expected;
    return Promise.reject(new Error(NOT_AVAILABLE));
  }

  isConnected(): boolean {
    return false;
  }
}
