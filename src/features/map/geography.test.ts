import { describe, expect, it } from 'vitest';
import { geoContains } from 'd3-geo';
import { LOW_RES_COUNTRIES, loadDetailedCountries, type CountryFeature } from './geography';

const SIMFEROPOL: [number, number] = [34.1, 44.95];
const SEVASTOPOL: [number, number] = [33.52, 44.6];

const owners = (countries: CountryFeature[], point: [number, number]) =>
  countries.filter((c) => geoContains(c, point)).map((c) => c.properties.name);

describe('world geography', () => {
  it.each([
    ['110m', () => Promise.resolve(LOW_RES_COUNTRIES)],
    ['50m', loadDetailedCountries],
  ])('draws Crimea as part of Ukraine at %s', async (_res, load) => {
    const countries = await load();
    expect(owners(countries, SIMFEROPOL)).toEqual(['Ukraine']);
    expect(owners(countries, SEVASTOPOL)).toEqual(['Ukraine']);
    expect(owners(countries, [37.6, 55.75])).toEqual(['Russia']); // Moscow still Russia
  });

  it('omits Antarctica', () => {
    expect(LOW_RES_COUNTRIES.some((c) => c.properties.name === 'Antarctica')).toBe(false);
  });
});
