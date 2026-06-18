import { describe, expect, it } from 'vitest';
import { isOnAtlas, unmatchedCountryNames } from './countryMatch';
import { makeEmptyCountry } from '@/domain/normalize';
import type { TravelData } from '@/domain/schema';

const visited = { visited: true, lived: false, birthplace: false };
const noStatus = { visited: false, lived: false, birthplace: false };

function doc(
  overrides: Partial<TravelData['travel']['countries'][number]>[],
  birthplace = '',
): TravelData {
  return {
    person: { birthplace: { country: birthplace } },
    travel: { countries: overrides.map((o) => ({ ...makeEmptyCountry(), ...o })) },
  };
}

describe('isOnAtlas', () => {
  it('resolves real countries (incl. aliases) to the bundled atlas', () => {
    expect(isOnAtlas('France')).toBe(true);
    expect(isOnAtlas('USA')).toBe(true); // alias -> united states of america
    expect(isOnAtlas('Czech Republic')).toBe(true); // alias -> czechia
  });

  it('returns false for names with no geography', () => {
    expect(isOnAtlas('Atlantis')).toBe(false);
    expect(isOnAtlas('Narnia')).toBe(false);
  });
});

describe('unmatchedCountryNames', () => {
  it('lists statused countries that have no atlas geography, using their display name', () => {
    const data = doc([
      { name: 'France', status: visited },
      { name: 'Atlantis', status: visited },
    ]);
    expect(unmatchedCountryNames(data)).toEqual(['Atlantis']);
  });

  it('ignores rows that carry no status (unfinished entries)', () => {
    const data = doc([{ name: 'Narnia', status: noStatus }]);
    expect(unmatchedCountryNames(data)).toEqual([]);
  });

  it('counts a capital-only visit as a status worth flagging', () => {
    const data = doc([{ name: 'Atlantis', status: noStatus, capitalVisit: { visited: true } }]);
    expect(unmatchedCountryNames(data)).toEqual(['Atlantis']);
  });

  it('includes an unmatched birthplace and de-dupes by canonical key (first spelling wins)', () => {
    const data = doc([{ name: 'atlantis', status: visited }], 'Atlantis');
    // birthplace "Atlantis" is considered first, so it wins the display spelling.
    expect(unmatchedCountryNames(data)).toEqual(['Atlantis']);
  });

  it('returns names sorted and skips empty/blank entries', () => {
    const data = doc([
      { name: 'Zedland', status: visited },
      { name: '   ', status: visited },
      { name: 'Atlantis', status: visited },
    ]);
    expect(unmatchedCountryNames(data)).toEqual(['Atlantis', 'Zedland']);
  });
});
