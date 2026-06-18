import { canonicalCountryName, countryOptions } from '@/domain/countries';
import { isValidYear } from '@/domain/timeline';
import type { Country } from '@/domain/schema';

/**
 * Structured preview of a free-text country list. `resolved` countries match the
 * `@/domain/schema` Country shape and are ready to hand to `mergeCountries`;
 * `unmatched` keeps the raw, unrecognised names so the UI can surface them
 * instead of silently dropping them.
 */
export interface CountryListPreview {
  resolved: Country[];
  unmatched: string[];
}

/**
 * Canonical comparison key (`canonicalCountryName`) -> stored English name, built
 * once from the picker's country list. This lets "spain", "SPAIN" and " España "
 * all resolve to the canonical "Spain" stored in the document — the same value
 * the world atlas matches on.
 */
const KEY_TO_ENGLISH: Map<string, string> = (() => {
  const map = new Map<string, string>();
  // `countryOptions('en')` gives every country's stored English value; also fold
  // in localized labels for the common UI locales so e.g. "Espagne" resolves.
  for (const locale of ['en', 'es', 'fr', 'pt', 'ru', 'uk']) {
    for (const opt of countryOptions(locale)) {
      // `opt.value` is always the canonical English name stored in the document.
      const labelKey = canonicalCountryName(opt.label);
      const valueKey = canonicalCountryName(opt.value);
      if (!map.has(valueKey)) map.set(valueKey, opt.value);
      if (!map.has(labelKey)) map.set(labelKey, opt.value);
    }
  }
  return map;
})();

/** Resolve a raw country name to its canonical English form, if known. */
function resolveCountryName(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // `codeForEnglishName` matches case-insensitively but we must store the
  // canonical English value (the atlas-matching name), never the raw input.
  return KEY_TO_ENGLISH.get(canonicalCountryName(trimmed));
}

/** Extract a trailing 4-digit year from a city token; returns name + optional year. */
function parseCityToken(token: string): { name: string; year?: number } | undefined {
  const trimmed = token.trim();
  if (!trimmed) return undefined;
  // A bare year (no city name) is a stray token, not a usable city entry.
  if (/^\d{4}$/.test(trimmed)) return undefined;
  // Pull a trailing year (e.g. "Madrid 2019"); leave the rest as the city name.
  const match = /^(.*?)\s+(\d{4})$/.exec(trimmed);
  if (match) {
    const name = match[1]!.trim();
    const yearNum = Number(match[2]);
    if (name) {
      return isValidYear(yearNum) ? { name, year: yearNum } : { name };
    }
    return undefined;
  }
  return { name: trimmed };
}

/**
 * Split the city portion of a line ("Madrid 2019, Barcelona 2021") into city
 * tokens. Commas are the primary separator; tolerant of extra spaces.
 */
function parseCities(rest: string): Country['cities'] {
  return rest
    .split(',')
    .map((token) => parseCityToken(token))
    .filter((c): c is { name: string; year?: number } => c !== undefined)
    .map((c) => ({
      name: c.name,
      timeline: { visited: c.year !== undefined ? [c.year] : [] },
    }));
}

/**
 * Merge `incoming` cities into `target` by canonical name, unioning visited years
 * (dedupe + sort). Mirrors the store's `mergeCountries` city rule so the same
 * "Spain: Madrid 2019" / "Spain: Madrid 2021" never yields two Madrid rows —
 * whether the repetition is on one line or across lines.
 */
function addCitiesInto(target: Country['cities'], incoming: Country['cities']): void {
  for (const city of incoming) {
    const key = canonicalCountryName(city.name);
    const existing = target.find((c) => canonicalCountryName(c.name) === key);
    if (!existing) {
      target.push({ name: city.name, timeline: { visited: [...city.timeline.visited] } });
      continue;
    }
    const years = new Set(existing.timeline.visited);
    for (const y of city.timeline.visited) years.add(y);
    existing.timeline.visited = Array.from(years).sort((a, b) => a - b);
  }
}

/** Build a fresh, schema-shaped Country marked visited, optionally with cities. */
function makeVisitedCountry(englishName: string, cities: Country['cities']): Country {
  const country: Country = {
    name: englishName,
    status: { visited: true, lived: false, birthplace: false },
    capitalVisit: { visited: false },
    timeline: { visited: [], lived: [] },
    cities: [],
  };
  addCitiesInto(country.cities, cities);
  return country;
}

/**
 * Parse free text into a structured, resolved preview. Each line (or
 * comma-separated entry) is either a bare country ("Spain") or a country with a
 * ": city year" list ("Spain: Madrid 2019, Barcelona 2021"). Country names are
 * resolved to canonical English; anything unrecognised lands in `unmatched`.
 *
 * Pure and total — never throws, tolerant of commas, newlines and extra spaces.
 */
export function parseCountryList(text: string): CountryListPreview {
  const resolved: Country[] = [];
  const unmatched: string[] = [];
  // Index into `resolved` by canonical key so repeated countries merge their
  // cities into one entry instead of producing duplicates.
  const indexByKey = new Map<string, number>();

  if (typeof text !== 'string') return { resolved, unmatched };

  // An entry ends at a newline or a comma — but commas inside a "country: cities"
  // tail separate cities, not entries. So we split on newlines first, then treat
  // a comma-only line (no colon) as multiple bare-country entries.
  for (const line of text.split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon !== -1) {
      addEntry(line.slice(0, colon), line.slice(colon + 1));
    } else {
      // No cities on this line — each comma-separated chunk is its own country.
      for (const chunk of line.split(',')) addEntry(chunk, '');
    }
  }

  function addEntry(countryPart: string, cityPart: string) {
    const name = countryPart.trim();
    if (!name) return;
    const english = resolveCountryName(name);
    if (!english) {
      unmatched.push(name);
      return;
    }
    const cities = parseCities(cityPart);
    const key = canonicalCountryName(english);
    const existing = indexByKey.get(key);
    if (existing !== undefined) {
      // Merge cities into the already-resolved country for this key (dedupe).
      addCitiesInto(resolved[existing]!.cities, cities);
    } else {
      indexByKey.set(key, resolved.length);
      resolved.push(makeVisitedCountry(english, cities));
    }
  }

  return { resolved, unmatched };
}
