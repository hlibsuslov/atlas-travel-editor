import type { TravelData } from '@/domain/schema';
import type { DocumentStore, StorageDoc, Capabilities, VersionToken } from '../types';

/**
 * GitHub backend — STUB this wave. Planned: store one `travel-data.json` blob in
 * a user-chosen repo, authenticated by a user-pasted fine-grained PAT, using the
 * blob `sha` as a native concurrency token (a stale sha → 409 → free OCC).
 * Implements the contract shape so the picker can list it as "coming soon".
 */

const NOT_IMPLEMENTED = 'GitHub storage is not yet implemented.';

const GITHUB_CAPS: Capabilities = {
  sharing: false,
  concurrency: 'token',
  watch: false,
  list: false,
  auth: true,
};

export class GithubStore implements DocumentStore {
  readonly id = 'github' as const;
  readonly label = 'GitHub';
  readonly capabilities = GITHUB_CAPS;

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
