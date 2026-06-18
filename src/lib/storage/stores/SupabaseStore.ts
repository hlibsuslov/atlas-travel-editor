import type { TravelData } from '@/domain/schema';
import { fetchMyRecord, saveMyRecord, setSharing, fetchPublicRecord } from '@/features/editor/api';
import type { DocumentStore, StorageDoc, DocMeta, Capabilities, VersionToken } from '../types';

/**
 * The hosted backend. A thin wrapper that delegates verbatim to the existing
 * `editor/api.ts` RPC functions, so the Supabase path stays byte-identical to the
 * pre-seam behavior (same validation, same normalization, same network calls).
 * It is the only store with sharing/public-read capabilities.
 */

const SUPABASE_CAPS: Capabilities = {
  sharing: true,
  // The `version` column exists but `save_travel_document` doesn't yet accept an
  // expected version, so we can't safely reject stale writes — declare 'none' so
  // the conflict UI hides (no regression: last-write-wins, exactly as before).
  concurrency: 'none',
  watch: false,
  list: false,
  auth: true,
};

export class SupabaseStore implements DocumentStore {
  readonly id = 'supabase' as const;
  readonly label = 'Supabase';
  readonly capabilities = SUPABASE_CAPS;

  async load(): Promise<StorageDoc | null> {
    const record = await fetchMyRecord();
    if (!record) return null;
    return {
      data: record.data,
      meta: { version: record.version, isPublic: record.isPublic, shareSlug: record.shareSlug },
    };
  }

  // `expected` is accepted to satisfy the contract but ignored until the
  // `p_expected_version` RPC migration lands (see STRATEGY §4.4 / Phase 4.3).
  async save(data: TravelData, _expected?: VersionToken): Promise<StorageDoc> {
    void _expected;
    const record = await saveMyRecord(data);
    return {
      data: record.data,
      meta: { version: record.version, isPublic: record.isPublic, shareSlug: record.shareSlug },
    };
  }

  async setSharing(isPublic: boolean): Promise<DocMeta> {
    const record = await setSharing(isPublic);
    return { version: record.version, isPublic: record.isPublic, shareSlug: record.shareSlug };
  }

  async readPublic(slug: string): Promise<TravelData | null> {
    return fetchPublicRecord(slug);
  }

  isConnected(): boolean {
    return true;
  }
}
