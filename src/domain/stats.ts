import type { Country, TravelData } from './schema';
import { continentForName } from './continents';

export type PrimaryStatus = 'birthplace' | 'lived' | 'visited' | 'capital' | 'none';

/** The single dominant status of a country (birthplace > lived > visited > capital). */
export function primaryStatus(c: Country): PrimaryStatus {
  if (c.status.birthplace) return 'birthplace';
  if (c.status.lived) return 'lived';
  if (c.status.visited) return 'visited';
  if (c.capitalVisit.visited) return 'capital';
  return 'none';
}

export interface TravelStats {
  countries: number;
  /** Countries with any status (birthplace/lived/visited/capital). */
  traveled: number;
  cities: number;
  byStatus: Record<'birthplace' | 'lived' | 'visited' | 'capital', number>;
  byContinent: Record<string, number>;
  firstYear: number | null;
  lastYear: number | null;
  span: number;
  /** trips logged per year, from city visit years. */
  yearTrips: Record<number, number>;
}

export function computeStats(data: TravelData): TravelStats {
  const countries = data.travel.countries;
  const byStatus = { birthplace: 0, lived: 0, visited: 0, capital: 0 };
  const byContinent: Record<string, number> = {};
  const yearTrips: Record<number, number> = {};
  let cities = 0;
  let firstYear = Infinity;
  let lastYear = 0;

  for (const c of countries) {
    const status = primaryStatus(c);
    if (status !== 'none') byStatus[status] += 1;

    const continent = continentForName(c.name);
    if (status !== 'none') byContinent[continent] = (byContinent[continent] ?? 0) + 1;

    cities += c.cities.length;
    for (const city of c.cities) {
      for (const y of city.timeline.visited) {
        firstYear = Math.min(firstYear, y);
        lastYear = Math.max(lastYear, y);
        yearTrips[y] = (yearTrips[y] ?? 0) + 1;
      }
    }
  }

  const traveled = byStatus.birthplace + byStatus.lived + byStatus.visited + byStatus.capital;
  return {
    countries: countries.length,
    traveled,
    cities,
    byStatus,
    byContinent,
    firstYear: firstYear === Infinity ? null : firstYear,
    lastYear: lastYear || null,
    span: firstYear === Infinity ? 0 : lastYear - firstYear,
    yearTrips,
  };
}
