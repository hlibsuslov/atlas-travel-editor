import type { TravelData } from '@/domain/schema';
import type { DocumentStore, StorageDoc, Capabilities, VersionToken } from '../types';

/**
 * WebDAV / Nextcloud backend — STUB this wave. Planned: PUT/GET one
 * `TravelEditor/travel-data.json` over a user-supplied URL + app-password, using
 * the `ETag` via `If-Match` for concurrency (412 = conflict). CORS from a static
 * origin must be detected and messaged. Implements the contract shape so the
 * picker can list it as "coming soon".
 */

const NOT_IMPLEMENTED = 'WebDAV storage is not yet implemented.';

const WEBDAV_CAPS: Capabilities = {
  sharing: false,
  concurrency: 'token',
  watch: false,
  list: false,
  auth: true,
};

export class WebdavStore implements DocumentStore {
  readonly id = 'webdav' as const;
  readonly label = 'WebDAV / Nextcloud';
  readonly capabilities = WEBDAV_CAPS;

  load(): Promise<StorageDoc | null> {
    return Promise.reject(new Error(NOT_IMPLEMENTED));
  }

  save(_data: TravelData, _expected?: VersionToken): Promise<StorageDoc> {
    void _data;
    void _expected;
    return Promise.reject(new Error(NOT_IMPLEMENTED));
  }

  isConnected(): boolean {
    return false;
  }
}
