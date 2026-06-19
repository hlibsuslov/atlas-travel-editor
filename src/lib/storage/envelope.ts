import type { TravelData } from '@/domain/schema';
import { normalizeTravelData } from '@/domain/normalize';

/**
 * Portable file/cloud envelope. File- and cloud-backed stores serialize the
 * document inside this wrapper so the blob is self-describing (an app id and a
 * schema-version migration anchor) and forward-compatible. It is byte-compatible
 * with today's bare `ExportMenu` JSON once wrapped.
 */
export interface PortableEnvelope {
  app: 'travel-editor';
  schemaVersion: number;
  updatedAt: string;
  data: TravelData;
}

export const APP_ID = 'travel-editor';
/** v2 adds the optional diary (`travel.stays`). Older v1 docs remain valid. */
export const SCHEMA_VERSION = 2;

/** Wrap a document in the portable envelope, stamping `updatedAt` (ISO). */
export function wrapEnvelope(
  data: TravelData,
  updatedAt = new Date().toISOString(),
): PortableEnvelope {
  return { app: APP_ID, schemaVersion: SCHEMA_VERSION, updatedAt, data };
}

function isEnvelope(value: unknown): value is { data: unknown; updatedAt?: unknown } {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  // Identify our envelope by app id AND a numeric schemaVersion (the migration
  // anchor). Requiring a numeric version rejects look-alike objects that merely
  // carry an `app`/`data` field, while still accepting any future version number
  // forward-compatibly (unknown fields are dropped by `normalizeTravelData`).
  return v.app === APP_ID && typeof v.schemaVersion === 'number' && 'data' in v;
}

/**
 * Parse a stored blob back into normalized data + its `updatedAt` stamp. Accepts
 * both the portable envelope and a bare legacy `TravelData` document (no
 * envelope) for backward compatibility. The result is always normalized so no
 * adapter can forget the coercion step.
 */
export function readEnvelope(blob: unknown): { data: TravelData; updatedAt?: string } {
  if (isEnvelope(blob)) {
    const updatedAt = typeof blob.updatedAt === 'string' ? blob.updatedAt : undefined;
    return { data: normalizeTravelData(blob.data), updatedAt };
  }
  // Legacy: a bare TravelData document with no envelope.
  return { data: normalizeTravelData(blob) };
}
