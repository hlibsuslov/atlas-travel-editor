import { describe, expect, it } from 'vitest';
import { makeDefaultData, makeEmptyCountry, normalizeTravelData } from './normalize';
import { validateTravelData } from './schema';

describe('normalizeTravelData', () => {
  it('produces a structurally complete record from empty input', () => {
    const result = normalizeTravelData({});
    expect(result.person.birthplace.country).toBe('');
    expect(result.travel.countries).toEqual([]);
  });

  it('never throws on hostile input', () => {
    expect(() => normalizeTravelData(null)).not.toThrow();
    expect(() => normalizeTravelData('garbage')).not.toThrow();
    expect(() => normalizeTravelData([1, 2, 3])).not.toThrow();
    expect(() => normalizeTravelData({ travel: { countries: 'nope' } })).not.toThrow();
  });

  it('coerces legacy string cities into the city object shape', () => {
    const result = normalizeTravelData({
      travel: { countries: [{ name: 'Italy', cities: ['Rome', 'Milan'] }] },
    });
    expect(result.travel.countries[0]!.cities[0]).toEqual({
      name: 'Rome',
      timeline: { visited: [] },
    });
  });

  it('coerces string years to numbers, drops invalid ones, dedupes and sorts', () => {
    const result = normalizeTravelData({
      travel: {
        countries: [
          {
            name: 'Japan',
            cities: [{ name: 'Tokyo', timeline: { visited: ['2022', 2020, 2020, 'x', 1800] } }],
          },
        ],
      },
    });
    expect(result.travel.countries[0]!.cities[0]!.timeline.visited).toEqual([2020, 2022]);
  });

  it('round-trips valid data through normalization unchanged in meaning', () => {
    const original = makeDefaultData();
    const normalized = normalizeTravelData(original);
    expect(validateTravelData(normalized).ok).toBe(true);
    expect(normalized).toEqual(original);
  });

  it('coerces truthy-but-non-boolean status flags to strict booleans', () => {
    const result = normalizeTravelData({
      travel: { countries: [{ name: 'Spain', status: { visited: 'yes', lived: 1 } }] },
    });
    // Only strict `true` maps to true; anything else is false.
    expect(result.travel.countries[0]!.status).toEqual({
      visited: false,
      lived: false,
      birthplace: false,
    });
  });
});

describe('factories', () => {
  it('makeEmptyCountry is structurally valid except for the required name', () => {
    const country = makeEmptyCountry();
    expect(country.name).toBe('');
    expect(country.cities).toEqual([]);
  });

  it('makeDefaultData passes strict validation', () => {
    expect(validateTravelData(makeDefaultData()).ok).toBe(true);
  });
});
