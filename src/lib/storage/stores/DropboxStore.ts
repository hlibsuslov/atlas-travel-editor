import type { TravelData } from '@/domain/schema';
import type { DocumentStore, StorageDoc, Capabilities, VersionToken } from '../types';

/**
 * Dropbox backend — STUB this wave. Planned: store one `travel-data.json` in the
 * scoped App Folder, authenticated by OAuth2 PKCE (offline, public client), using
 * the native `rev` (update-mode conflict) for concurrency. Implements the
 * contract shape so the picker can list it as "coming soon".
 */

const NOT_IMPLEMENTED = 'Dropbox storage is not yet implemented.';

const DROPBOX_CAPS: Capabilities = {
  sharing: false,
  concurrency: 'token',
  watch: false,
  list: false,
  auth: true,
};

export class DropboxStore implements DocumentStore {
  readonly id = 'dropbox' as const;
  readonly label = 'Dropbox';
  readonly capabilities = DROPBOX_CAPS;

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
