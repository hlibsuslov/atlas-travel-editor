import type { City, Country, Money, Stay, TravelData } from './schema';
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

function normalizeMoney(input: unknown): Money | undefined {
  const obj = asObject(input);
  const amount = Number(obj.amount);
  const currency = asString(obj.currency).trim().toUpperCase();
  if (!Number.isFinite(amount) || !/^[A-Z]{3}$/.test(currency)) return undefined;
  return { amount: Math.max(0, Math.round(amount)), currency };
}

function normalizeStay(input: unknown): Stay {
  const obj = asObject(input);
  const stay: Stay = { name: asString(obj.name).trim() };
  const country = asString(obj.country).trim();
  if (country) stay.country = country;
  const city = asString(obj.city).trim();
  if (city) stay.city = city;
  const from = asString(obj.from).trim();
  if (from) stay.from = from;
  const to = asString(obj.to).trim();
  if (to) stay.to = to;
  const note = asString(obj.note).trim();
  if (note) stay.note = note;
  const cost = normalizeMoney(obj.cost);
  if (cost) stay.cost = cost;
  return stay;
}

export function normalizeTravelData(input: unknown): TravelData {
  const obj = asObject(input);
  const person = asObject(obj.person);
  const birthplace = asObject(person.birthplace);
  const travel = asObject(obj.travel);
  const result: TravelData = {
    person: { birthplace: { country: asString(birthplace.country).trim() } },
    travel: { countries: asArray(travel.countries).map(normalizeCountry) },
  };
  // Diary stays are additive + OPTIONAL: only attach when present (and named), so
  // legacy documents and their exports stay slim. This is the v1→v2 upgrade step —
  // future schema growth adds more such coercions here, never throwing.
  const stays = asArray(travel.stays)
    .map(normalizeStay)
    .filter((s) => s.name);
  if (stays.length) result.travel.stays = stays;
  return result;
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
