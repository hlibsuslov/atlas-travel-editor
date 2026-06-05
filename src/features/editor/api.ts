import { supabase } from '@/lib/supabase';
import type { TravelRecordRow } from '@/lib/database.types';
import type { TravelData } from '@/domain/schema';
import { validateTravelData } from '@/domain/schema';
import { normalizeTravelData } from '@/domain/normalize';

/**
 * Data-access layer for travel records. All queries rely on Row Level Security:
 * the anon key cannot read or write another user's row regardless of what the
 * client sends. We never trust the client — but we also defend in depth.
 */

export interface TravelRecord {
  data: TravelData;
  isPublic: boolean;
  shareSlug: string | null;
  version: number;
}

function toRecord(row: TravelRecordRow): TravelRecord {
  return {
    data: normalizeTravelData(row.data),
    isPublic: row.is_public,
    shareSlug: row.share_slug,
    version: row.version,
  };
}

/** Fetch the signed-in user's record, or `null` if they don't have one yet. */
export async function fetchMyRecord(): Promise<TravelRecord | null> {
  const { data, error } = await supabase.from('travel_records').select('*').maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRecord(data) : null;
}

/**
 * Persist the user's travel document. Validates against the strict schema first
 * so we never write malformed data, then upserts on the unique `user_id`.
 */
export async function saveMyRecord(data: TravelData): Promise<TravelRecord> {
  const validation = validateTravelData(data);
  if (!validation.ok) {
    throw new Error(`Cannot save invalid data: ${validation.errors[0]}`);
  }

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Not authenticated.');

  const { data: row, error } = await supabase
    .from('travel_records')
    .upsert({ user_id: userId, data }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return toRecord(row);
}

/** Toggle public sharing. The DB trigger assigns a share slug on first publish. */
export async function setSharing(isPublic: boolean): Promise<TravelRecord> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Not authenticated.');

  const { data: row, error } = await supabase
    .from('travel_records')
    .update({ is_public: isPublic })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return toRecord(row);
}

/** Fetch a public record by its share slug (readable by anyone via RLS). */
export async function fetchPublicRecord(slug: string): Promise<TravelData | null> {
  // Routed through a SECURITY DEFINER function so only the document payload is
  // ever returned for a public slug — never user_id or other ownership columns.
  const { data, error } = await supabase.rpc('get_shared_travel', { p_slug: slug });
  if (error) throw new Error(error.message);
  return data ? normalizeTravelData(data) : null;
}
