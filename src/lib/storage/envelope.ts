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
  schemaVersion: 1;
  updatedAt: string;
  data: TravelData;
}

export const APP_ID = 'travel-editor';
export const SCHEMA_VERSION = 1;

/** Wrap a document in the portable envelope, stamping `updatedAt` (ISO). */
export function wrapEnvelope(
  data: TravelData,
  updatedAt = new Date().toISOString(),
): PortableEnvelope {
  return { app: APP_ID, schemaVersion: SCHEMA_VERSION, updatedAt, data };
}

function isEnvelope(value: unknown): value is { data: unknown; updatedAt?: unknown } {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).app === APP_ID &&
    'data' in (value as Record<string, unknown>)
  );
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
