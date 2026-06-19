import type { City, Country, TravelData } from './schema';
import { isValidYear } from './timeline';

/**
 * Lenient coercion for untrusted/legacy input (pasted JSON, old localStorage,
 * server payloads). Unlike the strict schema, this never throws: it best-effort
 * shapes arbitrary data into the current model, dropping clearly invalid bits.
 *
 * Validation of the *result* is still the job of `validateTravelData` — this only
 * guarantees the structure, not that every field is business-valid.
 */

type Json = Record<string, unknown>;

const asObject = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asString = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  // Objects/arrays/null/undefined have no meaningful string form here.
  return '';
};
const asBool = (v: unknown): boolean => v === true;

function normalizeCity(input: unknown): City {
  // Legacy form: a bare string city name.
  if (typeof input === 'string') {
    return { name: input.trim(), timeline: { visited: [] } };
  }
  const obj = asObject(input);
  const visitedRaw = asArray(asObject(obj.timeline).visited);
  const visited = visitedRaw
    .map((y) => Number(y))
    .filter((y) => Number.isInteger(y) && isValidYear(y));
  // De-duplicate and sort for a stable, diff-friendly representation.
  const unique = Array.from(new Set(visited)).sort((a, b) => a - b);
  return { name: asString(obj.name).trim(), timeline: { visited: unique } };
}

export function normalizeCountry(input: unknown): Country {
  const obj = asObject(input);
  const status = asObject(obj.status);
  const timeline = asObject(obj.timeline);
  return {
    name: asString(obj.name).trim(),
    status: {
      visited: asBool(status.visited),
      lived: asBool(status.lived),
      birthplace: asBool(status.birthplace),
    },
    capitalVisit: { visited: asBool(asObject(obj.capitalVisit).visited) },
    timeline: {
      visited: asArray(timeline.visited)
        .map(asString)
        .map((s) => s.trim())
        .filter(Boolean),
      lived: asArray(timeline.lived)
        .map(asString)
        .map((s) => s.trim())
        .filter(Boolean),
    },
    cities: asArray(obj.cities).map(normalizeCity),
  };
}

export function normalizeTravelData(input: unknown): TravelData {
  const obj = asObject(input);
  const person = asObject(obj.person);
  const birthplace = asObject(person.birthplace);
  const travel = asObject(obj.travel);
  return {
    person: { birthplace: { country: asString(birthplace.country).trim() } },
    travel: { countries: asArray(travel.countries).map(normalizeCountry) },
  };
}

/** A fresh, empty country ready for editing. */
export function makeEmptyCountry(): Country {
  return {
    name: '',
    status: { visited: false, lived: false, birthplace: false },
    capitalVisit: { visited: false },
    timeline: { visited: [], lived: [] },
    cities: [],
  };
}

/** The default example shown to first-time users (replaces the MVP DEFAULT_DATA). */
export function makeDefaultData(): TravelData {
  return {
    person: { birthplace: { country: 'Ukraine' } },
    travel: {
      countries: [
        {
          name: 'Austria',
          status: { visited: true, lived: false, birthplace: false },
          capitalVisit: { visited: true },
          timeline: { visited: [], lived: [] },
          cities: [],
        },
      ],
    },
  };
}
