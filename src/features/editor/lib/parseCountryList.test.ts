import { describe, expect, it } from 'vitest';
import { parseCountryList } from './parseCountryList';
import { validateTravelData } from '@/domain/schema';

/** Helper: validate that a parsed country round-trips through the strict schema. */
function expectValidCountries(countries: ReturnType<typeof parseCountryList>['resolved']) {
  const result = validateTravelData({
    person: { birthplace: { country: 'Ukraine' } },
    travel: { countries },
  });
  expect(result.errors).toEqual([]);
  expect(result.ok).toBe(true);
}

describe('parseCountryList', () => {
  it('never throws on hostile input', () => {
    expect(() => parseCountryList('')).not.toThrow();
    // @ts-expect-error — defensive: callers may pass non-strings at runtime.
    expect(() => parseCountryList(null)).not.toThrow();
    // @ts-expect-error — defensive.
    expect(() => parseCountryList(undefined)).not.toThrow();
    expect(parseCountryList('   \n  \n').resolved).toEqual([]);
  });

  it('resolves a single bare country, marked visited with no cities', () => {
    const { resolved, unmatched } = parseCountryList('Spain');
    expect(unmatched).toEqual([]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.name).toBe('Spain');
    expect(resolved[0]!.status).toEqual({ visited: true, lived: false, birthplace: false });
    expect(resolved[0]!.cities).toEqual([]);
    expectValidCountries(resolved);
  });

  it('splits comma-separated bare countries on one line into separate entries', () => {
    const { resolved, unmatched } = parseCountryList('Spain, France, Italy');
    expect(unmatched).toEqual([]);
    expect(resolved.map((c) => c.name)).toEqual(['Spain', 'France', 'Italy']);
    expect(resolved.every((c) => c.status.visited)).toBe(true);
  });

  it('splits newline-separated countries into separate entries', () => {
    const { resolved } = parseCountryList('Spain\nFrance\nItaly');
    expect(resolved.map((c) => c.name)).toEqual(['Spain', 'France', 'Italy']);
  });

  it('parses "Country: City year, City year" into cities with year timelines', () => {
    const { resolved, unmatched } = parseCountryList('Spain: Madrid 2019, Barcelona 2021');
    expect(unmatched).toEqual([]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.cities).toEqual([
      { name: 'Madrid', timeline: { visited: [2019] } },
      { name: 'Barcelona', timeline: { visited: [2021] } },
    ]);
    expectValidCountries(resolved);
  });

  it('accepts a city with no year (empty visited timeline)', () => {
    const { resolved } = parseCountryList('Spain: Madrid');
    expect(resolved[0]!.cities).toEqual([{ name: 'Madrid', timeline: { visited: [] } }]);
    expectValidCountries(resolved);
  });

  it('tolerates a comma between the city name and its year', () => {
    const { resolved } = parseCountryList('Spain: Madrid, 2019');
    // "Madrid" and "2019" are separate comma chunks; the bare year has no city
    // name, so only "Madrid" survives (with no year).
    expect(resolved[0]!.cities).toEqual([{ name: 'Madrid', timeline: { visited: [] } }]);
  });

  it('is tolerant of extra spaces and blank lines', () => {
    const { resolved, unmatched } = parseCountryList(
      '   Spain :   Madrid   2019  \n\n   France   \n',
    );
    expect(unmatched).toEqual([]);
    expect(resolved.map((c) => c.name)).toEqual(['Spain', 'France']);
    expect(resolved[0]!.cities).toEqual([{ name: 'Madrid', timeline: { visited: [2019] } }]);
  });

  it('drops out-of-range years but keeps the city', () => {
    const { resolved } = parseCountryList('Spain: Madrid 1700');
    expect(resolved[0]!.cities).toEqual([{ name: 'Madrid', timeline: { visited: [] } }]);
  });

  it('resolves case-insensitively and via accents/aliases', () => {
    expect(parseCountryList('SPAIN').resolved[0]!.name).toBe('Spain');
    expect(parseCountryList('  spain  ').resolved[0]!.name).toBe('Spain');
    // Localized spelling resolves back to the canonical English value.
    expect(parseCountryList('España').resolved[0]!.name).toBe('Spain');
  });

  it('collects unrecognised names in unmatched without dropping them silently', () => {
    const { resolved, unmatched } = parseCountryList('Spain\nNarnia\nAtlantis');
    expect(resolved.map((c) => c.name)).toEqual(['Spain']);
    expect(unmatched).toEqual(['Narnia', 'Atlantis']);
  });

  it('merges repeated countries (across lines) into one entry, combining cities', () => {
    const { resolved } = parseCountryList('Spain: Madrid 2019\nSpain: Barcelona 2021');
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.cities.map((c) => c.name)).toEqual(['Madrid', 'Barcelona']);
  });

  it('dedupes a repeated city, unioning its years (across lines and on one line)', () => {
    const acrossLines = parseCountryList('Spain: Madrid 2019\nSpain: Madrid 2021');
    expect(acrossLines.resolved).toHaveLength(1);
    expect(acrossLines.resolved[0]!.cities).toEqual([
      { name: 'Madrid', timeline: { visited: [2019, 2021] } },
    ]);

    const oneLine = parseCountryList('Spain: Madrid 2019, Madrid 2021');
    expect(oneLine.resolved[0]!.cities).toEqual([
      { name: 'Madrid', timeline: { visited: [2019, 2021] } },
    ]);
  });
});
