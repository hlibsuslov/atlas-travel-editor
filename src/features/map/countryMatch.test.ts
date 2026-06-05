import { describe, expect, it } from 'vitest';
import { buildStatusMap, canonical, statusForGeography } from './countryMatch';
import { makeDefaultData, makeEmptyCountry } from '@/domain/normalize';
import type { TravelData } from '@/domain/schema';

describe('canonical', () => {
  it('normalizes case, accents and punctuation', () => {
    expect(canonical('  Côte d’Ivoire ')).toBe(canonical('cote d ivoire'));
    expect(canonical('AUSTRIA')).toBe('austria');
  });

  it('maps common aliases onto the atlas name', () => {
    expect(canonical('USA')).toBe('united states of america');
    expect(canonical('United States')).toBe('united states of america');
    expect(canonical('UK')).toBe('united kingdom');
    expect(canonical('Czech Republic')).toBe('czechia');
  });
});

describe('buildStatusMap', () => {
  function withCountry(overrides: Partial<ReturnType<typeof makeEmptyCountry>>): TravelData {
    return {
      person: { birthplace: { country: '' } },
      travel: { countries: [{ ...makeEmptyCountry(), name: 'Austria', ...overrides }] },
    };
  }

  it('marks the person birthplace country as birthplace', () => {
    const data = makeDefaultData(); // birthplace Ukraine
    const map = buildStatusMap(data);
    expect(map.get(canonical('Ukraine'))).toBe('birthplace');
  });

  it('ranks lived above visited above capital', () => {
    expect(
      buildStatusMap(
        withCountry({ status: { visited: true, lived: true, birthplace: false } }),
      ).get('austria'),
    ).toBe('lived');
    expect(
      buildStatusMap(
        withCountry({ status: { visited: true, lived: false, birthplace: false } }),
      ).get('austria'),
    ).toBe('visited');
    expect(
      buildStatusMap(
        withCountry({
          status: { visited: false, lived: false, birthplace: false },
          capitalVisit: { visited: true },
        }),
      ).get('austria'),
    ).toBe('capital');
  });

  it('omits countries with no status', () => {
    const map = buildStatusMap(withCountry({}));
    expect(map.has('austria')).toBe(false);
  });
});

describe('statusForGeography', () => {
  it('resolves atlas names through the alias table', () => {
    const data: TravelData = {
      person: { birthplace: { country: '' } },
      travel: {
        countries: [
          {
            ...makeEmptyCountry(),
            name: 'USA',
            status: { visited: true, lived: false, birthplace: false },
          },
        ],
      },
    };
    const map = buildStatusMap(data);
    expect(statusForGeography('United States of America', map)).toBe('visited');
    expect(statusForGeography('Canada', map)).toBe('none');
  });
});
