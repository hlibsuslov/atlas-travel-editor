import type { TravelData } from '@/domain/schema';
import type { DocumentStore, StorageDoc, Capabilities, VersionToken } from '../types';

/**
 * Google Drive backend — STUB this wave. Planned: store one `travel-data.json`
 * in the app-private `appDataFolder`, authenticated by OAuth2 PKCE (public
 * client, no secret), using `headRevisionId`/`etag` via `If-Match` for
 * concurrency. Implements the contract shape so the picker can list it as
 * "coming soon".
 */

const NOT_IMPLEMENTED = 'Google Drive storage is not yet implemented.';

const GDRIVE_CAPS: Capabilities = {
  sharing: false,
  concurrency: 'token',
  watch: false,
  list: false,
  auth: true,
};

export class GdriveStore implements DocumentStore {
  readonly id = 'gdrive' as const;
  readonly label = 'Google Drive';
  readonly capabilities = GDRIVE_CAPS;

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
