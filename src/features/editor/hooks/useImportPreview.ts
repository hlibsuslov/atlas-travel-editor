import { useMemo } from 'react';
import { normalizeTravelData } from '@/domain/normalize';
import { validateTravelData, type TravelData } from '@/domain/schema';

/** Result of inspecting pasted/loaded JSON before importing it. */
export type ImportPreview =
  | { state: 'empty' }
  | { state: 'parse'; message: string }
  | {
      state: 'ok' | 'warn';
      data: TravelData;
      countries: number;
      cities: number;
      firstError?: string;
    };

/**
 * Parse, normalize, and validate raw JSON into an import preview. Pure and
 * memoized on the input so the modal can show a live summary without re-running
 * the work on every render. Never throws — bad JSON becomes a `parse` state.
 */
export function useImportPreview(raw: string): ImportPreview {
  return useMemo<ImportPreview>(() => {
    if (!raw.trim()) return { state: 'empty' };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return { state: 'parse', message: err instanceof Error ? err.message : 'invalid JSON' };
    }
    const data = normalizeTravelData(parsed);
    const validation = validateTravelData(data);
    const cities = data.travel.countries.reduce((sum, c) => sum + c.cities.length, 0);
    return {
      state: validation.ok ? 'ok' : 'warn',
      data,
      countries: data.travel.countries.length,
      cities,
      firstError: validation.errors[0],
    };
  }, [raw]);
}
