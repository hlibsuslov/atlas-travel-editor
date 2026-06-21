import type { Country, TravelData } from './schema';
import { continentForName, unMembersInContinent } from './continents';
import { isUnMember, UN_MEMBER_COUNT } from './sovereignty';

export type PrimaryStatus = 'birthplace' | 'lived' | 'visited' | 'capital' | 'none';

/** The single dominant status of a country (birthplace > lived > visited > capital). */
export function primaryStatus(c: Country): PrimaryStatus {
  if (c.status.birthplace) return 'birthplace';
  if (c.status.lived) return 'lived';
  if (c.status.visited) return 'visited';
  if (c.capitalVisit.visited) return 'capital';
  return 'none';
}

/** Per-continent visited count plus the UN-member denominator and percentage. */
export interface ContinentProgress {
  /** Countries with any status in this continent (matches `byContinent`). */
  visited: number;
  /** Total UN member states in this continent (the "of y" denominator). */
  unMembers: number;
  /** visited / unMembers as a 0-100 integer (capped at 100). */
  pct: number;
}

/** Honest "% of the world" figures, scoped strictly to UN member states. */
export interface WorldProgress {
  /** Always 193 — the UN member denominator. */
  unMembers: number;
  /** Visited (any status) countries that are UN members. */
  visitedUnMembers: number;
  /** visitedUnMembers / 193 as a 0-100 integer. */
  pct: number;
  /** Visited (any status) countries that are NOT UN members (Vatican/Taiwan). */
  nonMemberVisited: number;
}

/** The busiest single year and its trip count, or null when there are no trips. */
export interface BusiestYear {
  year: number;
  count: number;
}

/** Higher-level "achievement" figures derived from the year timelines. */
export interface Milestones {
  /** First year anything was visited (== firstYear), or null. */
  firstEverYear: number | null;
  /** Year with the most trips logged, or null when there are no trips. */
  busiestYear: BusiestYear | null;
  /** Longest run of consecutive calendar years each with >= 1 trip. */
  longestStreak: number;
  /** Number of distinct years with >= 1 trip. */
  activeYears: number;
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
  // --- additive fields (existing callers ignore these safely) --------------
  /** Honest UN-member-only "% of the world" block. */
  world: WorldProgress;
  /** Per-continent visited / UN-member denominator / percentage. */
  byContinentPct: Record<string, ContinentProgress>;
  /** For each year, how many countries were first discovered that year. */
  newCountriesPerYear: Record<number, number>;
  /** Achievement-style milestones derived from the year timelines. */
  milestones: Milestones;
  /** Distinct (deduped by name) cities across all countries. */
  distinctCities: number;
  /** Countries that have at least one city recorded. */
  countriesWithCities: number;
}

/**
 * Extract every concrete year mentioned by a country-level timeline string.
 * Strings are `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or a `YYYY-YYYY` range. For a
 * range we keep only the endpoints (the start is what "first visited" needs);
 * intermediate years are not asserted as travel events.
 */
function yearsFromTimelineString(s: string): number[] {
  const m = /^(\d{4})(?:-(\d{4}))?/.exec(s.trim());
  if (!m) return [];
  const start = Number(m[1]);
  const years = [start];
  if (m[2]) years.push(Number(m[2]));
  return years;
}

/**
 * The earliest year a country was "discovered", looking at both its
 * country-level timelines (visited + lived) and its city visit years.
 * Returns null when the country has no dated events.
 */
function firstYearForCountry(c: Country): number | null {
  let first = Infinity;
  for (const s of c.timeline.visited) {
    for (const y of yearsFromTimelineString(s)) first = Math.min(first, y);
  }
  for (const s of c.timeline.lived) {
    for (const y of yearsFromTimelineString(s)) first = Math.min(first, y);
  }
  for (const city of c.cities) {
    for (const y of city.timeline.visited) first = Math.min(first, y);
  }
  return first === Infinity ? null : first;
}

/** Longest run of consecutive years present in `years` (each appears once). */
function longestConsecutiveRun(years: number[]): number {
  if (years.length === 0) return 0;
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === sorted[i - 1]! + 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return longest;
}

export function computeStats(data: TravelData): TravelStats {
  const countries = data.travel.countries;
  const byStatus = { birthplace: 0, lived: 0, visited: 0, capital: 0 };
  const byContinent: Record<string, number> = {};
  const yearTrips: Record<number, number> = {};
  const newCountriesPerYear: Record<number, number> = {};
  const continentVisited: Record<string, number> = {};
  const cityNames = new Set<string>();
  let cities = 0;
  let countriesWithCities = 0;
  let firstYear = Infinity;
  let lastYear = 0;
  let visitedUnMembers = 0;
  let nonMemberVisited = 0;

  for (const c of countries) {
    const status = primaryStatus(c);
    const traveledHere = status !== 'none';

    if (traveledHere) {
      byStatus[status] += 1;

      const continent = continentForName(c.name);
      byContinent[continent] = (byContinent[continent] ?? 0) + 1;
      continentVisited[continent] = (continentVisited[continent] ?? 0) + 1;

      // UN-member math: only the 193 members count toward % of the world.
      if (isUnMember(c.name)) visitedUnMembers += 1;
      else nonMemberVisited += 1;

      const first = firstYearForCountry(c);
      if (first !== null) {
        newCountriesPerYear[first] = (newCountriesPerYear[first] ?? 0) + 1;
      }
    }

    cities += c.cities.length;
    if (c.cities.length > 0) countriesWithCities += 1;
    for (const city of c.cities) {
      cityNames.add(city.name.trim().toLowerCase());
      for (const y of city.timeline.visited) {
        firstYear = Math.min(firstYear, y);
        lastYear = Math.max(lastYear, y);
        yearTrips[y] = (yearTrips[y] ?? 0) + 1;
      }
    }
  }

  const traveled = byStatus.birthplace + byStatus.lived + byStatus.visited + byStatus.capital;

  // Per-continent progress: visited / UN-member denominator / pct.
  const byContinentPct: Record<string, ContinentProgress> = {};
  for (const [continent, visited] of Object.entries(continentVisited)) {
    const unMembers = unMembersInContinent(continent);
    const pct = unMembers > 0 ? Math.min(100, Math.round((visited / unMembers) * 100)) : 0;
    byContinentPct[continent] = { visited, unMembers, pct };
  }

  // Milestones from the per-year trip map.
  const tripYears = Object.keys(yearTrips).map(Number);
  let busiestYear: BusiestYear | null = null;
  for (const y of tripYears) {
    const count = yearTrips[y]!;
    if (!busiestYear || count > busiestYear.count) busiestYear = { year: y, count };
  }
  const milestones: Milestones = {
    firstEverYear: firstYear === Infinity ? null : firstYear,
    busiestYear,
    longestStreak: longestConsecutiveRun(tripYears),
    activeYears: tripYears.length,
  };

  const world: WorldProgress = {
    unMembers: UN_MEMBER_COUNT,
    visitedUnMembers,
    pct: Math.round((visitedUnMembers / UN_MEMBER_COUNT) * 100),
    nonMemberVisited,
  };

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
    world,
    byContinentPct,
    newCountriesPerYear,
    milestones,
    distinctCities: cityNames.size,
    countriesWithCities,
  };
}
