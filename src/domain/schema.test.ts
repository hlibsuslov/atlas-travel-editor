import { describe, expect, it } from 'vitest';
import { validateTravelData } from './schema';
import { makeDefaultData } from './normalize';

describe('validateTravelData', () => {
  it('accepts the default seed data', () => {
    const result = validateTravelData(makeDefaultData());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('requires a birthplace country', () => {
    const data = makeDefaultData();
    data.person.birthplace.country = '   ';
    const result = validateTravelData(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('birthplace'))).toBe(true);
  });

  it('requires a name for every country', () => {
    const data = makeDefaultData();
    data.travel.countries[0]!.name = '';
    const result = validateTravelData(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.startsWith('travel.countries.0.name'))).toBe(true);
  });

  it('rejects invalid country timeline strings with a path', () => {
    const data = makeDefaultData();
    data.travel.countries[0]!.timeline.visited = ['not-a-date'];
    const result = validateTravelData(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.startsWith('travel.countries.0.timeline.visited.0'))).toBe(
      true,
    );
  });

  it('rejects out-of-range city years', () => {
    const data = makeDefaultData();
    data.travel.countries[0]!.cities = [{ name: 'Vienna', timeline: { visited: [1800] } }];
    const result = validateTravelData(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('cities.0.timeline.visited.0'))).toBe(true);
  });

  it('reports multiple independent errors at once', () => {
    const result = validateTravelData({ person: {}, travel: { countries: [{}] } });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('rejects entirely malformed input without throwing', () => {
    expect(validateTravelData(null).ok).toBe(false);
    expect(validateTravelData('string').ok).toBe(false);
    expect(validateTravelData(42).ok).toBe(false);
  });
});
