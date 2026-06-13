import { supabase } from '@/lib/supabase';
import type { TravelDocumentEnvelope } from '@/lib/database.types';
import type { TravelData } from '@/domain/schema';
import { validateTravelData } from '@/domain/schema';
import { normalizeTravelData } from '@/domain/normalize';

/**
 * Data-access layer for travel records. The document is stored relationally
 * (see migration 0003), but the client still works with a whole `TravelData`
 * JSON: reads and writes go through SECURITY DEFINER functions that assemble or
 * disassemble the document atomically. Every function is scoped to the
 * authenticated user server-side (auth.uid()) and defended again by RLS.
 */

export interface TravelRecord {
  data: TravelData;
  isPublic: boolean;
  shareSlug: string | null;
  version: number;
}

function toRecord(envelope: TravelDocumentEnvelope): TravelRecord {
  return {
    data: normalizeTravelData(envelope.data),
    isPublic: envelope.is_public,
    shareSlug: envelope.share_slug,
    version: envelope.version,
  };
}

/** Fetch the signed-in user's record, or `null` if they don't have one yet. */
export async function fetchMyRecord(): Promise<TravelRecord | null> {
  const { data, error } = await supabase.rpc('get_my_travel_document');
  if (error) throw new Error(error.message);
  return data ? toRecord(data) : null;
}

/**
 * Persist the user's travel document. Validates against the strict schema first
 * so we never write malformed data, then hands the whole payload to the server,
 * which replaces the relational rows in a single transaction.
 */
export async function saveMyRecord(data: TravelData): Promise<TravelRecord> {
  const validation = validateTravelData(data);
  if (!validation.ok) {
    throw new Error(`Cannot save invalid data: ${validation.errors[0]}`);
  }

  const { data: envelope, error } = await supabase.rpc('save_travel_document', { p_data: data });
  if (error) throw new Error(error.message);
  return toRecord(envelope);
}

/** Toggle public sharing. The DB trigger assigns a share slug on first publish. */
export async function setSharing(isPublic: boolean): Promise<TravelRecord> {
  const { data: envelope, error } = await supabase.rpc('set_travel_sharing', {
    p_is_public: isPublic,
  });
  if (error) throw new Error(error.message);
  return toRecord(envelope);
}

/** Fetch a public record by its share slug (readable by anyone via the RPC). */
export async function fetchPublicRecord(slug: string): Promise<TravelData | null> {
  // Routed through a SECURITY DEFINER function so only the document payload is
  // ever returned for a public slug — never user_id or other ownership columns.
  const { data, error } = await supabase.rpc('get_shared_travel', { p_slug: slug });
  if (error) throw new Error(error.message);
  return data ? normalizeTravelData(data) : null;
}
