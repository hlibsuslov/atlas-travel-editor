import type { Country, Stay, TravelData } from './schema';
import { continentForName, unMembersInContinent } from './continents';
import { isUnMember, UN_MEMBER_COUNT } from './sovereignty';
import { RE_YEAR, RE_YEAR_MONTH, RE_YEAR_MONTH_DAY, RE_YEAR_RANGE } from './constants';
import { isValidTimelineString } from './timeline';

/** Milliseconds in one UTC day — used to turn dates into whole-night counts. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

/** One country's spend, split by ISO-4217 currency (honest, never converted). */
export interface CountrySpend {
  /** The stay's `country` string (only stays that name a country appear here). */
  country: string;
  /** Minor units summed per currency for this country. */
  byCurrency: Record<string, number>;
}

/** A single notably-expensive stay, surfaced for the "top stays" list. */
export interface TopStay {
  name: string;
  country?: string;
  /** Cost in integer minor units. */
  amount: number;
  /** ISO-4217 currency of `amount`. */
  currency: string;
}

/**
 * Budget figures derived purely from the optional diary (`data.travel.stays`).
 * Multi-currency is grouped by currency code and NEVER silently converted —
 * there is no live FX in a local-first app, so summing across currencies would
 * be dishonest. All money stays in integer minor units.
 */
export interface BudgetStats {
  /** Minor units summed per ISO-4217 currency across every stay with a cost. */
  spendByCurrency: Record<string, number>;
  /** Per-country spend (grouped by currency), sorted desc by the country's largest single-currency total. */
  spendByCountry: CountrySpend[];
  /** Total nights across stays where BOTH `from` and `to` parse to real dates (inclusive-exclusive). */
  nights: number;
  /** spendByCurrency / nights, per currency, in rounded minor units. Empty when there are no dated nights. */
  avgNightlyByCurrency: Record<string, number>;
  /** The most expensive stays (capped), each with its own currency. */
  topStays: TopStay[];
  /** Total number of stays (a stay with no cost still counts). */
  stayCount: number;
  /** Number of distinct currencies that appear across all stay costs. */
  currencyCount: number;
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
  /** Spend/nights figures from the optional diary; all-empty when there are no stays. */
  budget: BudgetStats;
}

/** How many top (most expensive) stays we surface. */
const TOP_STAYS_LIMIT = 5;

/**
 * Parse a timeline string to a UTC day count (days since epoch) for night math.
 * Accepts a single `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` (partial dates normalise
 * to the 1st of the month/year). A `YYYY-YYYY` range is NOT a single day, so it
 * returns null — we only count nights when both endpoints are concrete dates.
 * Returns null for anything that does not validate, so junk can never produce
 * NaN/Infinity downstream.
 */
function timelineToEpochDay(value: string): number | null {
  if (!isValidTimelineString(value)) return null;
  const s = value.trim();
  // A YYYY-YYYY range is two years, not one day — reject for night counting.
  if (RE_YEAR_RANGE.test(s)) return null;

  let y: number;
  let m = 1;
  let d = 1;
  if (RE_YEAR.test(s)) {
    y = Number(s);
  } else if (RE_YEAR_MONTH.test(s)) {
    y = Number(s.slice(0, 4));
    m = Number(s.slice(5, 7));
  } else if (RE_YEAR_MONTH_DAY.test(s)) {
    const [yy, mm, dd] = s.split('-').map(Number) as [number, number, number];
    y = yy;
    m = mm;
    d = dd;
  } else {
    return null;
  }

  const ms = Date.UTC(y, m - 1, d);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / MS_PER_DAY);
}

/** Whole nights for a stay (inclusive-exclusive), or 0 when dates are missing/junk/non-positive. */
function nightsForStay(stay: Stay): number {
  if (!stay.from || !stay.to) return 0;
  const from = timelineToEpochDay(stay.from);
  const to = timelineToEpochDay(stay.to);
  if (from === null || to === null) return 0;
  const diff = to - from;
  // Guard junk: same-day or reversed ranges contribute no nights.
  return diff > 0 ? diff : 0;
}

/**
 * Budget aggregation over the optional diary. Pure function of the stays array;
 * with no stays (or none with costs/dates) every map is empty and every count
 * is 0 — never NaN/Infinity, never a divide-by-zero.
 */
function computeBudget(stays: Stay[]): BudgetStats {
  const spendByCurrency: Record<string, number> = {};
  // country -> currency -> minor units
  const byCountry = new Map<string, Record<string, number>>();
  const topCandidates: TopStay[] = [];
  let nights = 0;

  for (const stay of stays) {
    nights += nightsForStay(stay);

    const cost = stay.cost;
    if (!cost) continue; // costless stays still count toward stayCount, just not spend.

    const { amount, currency } = cost;
    spendByCurrency[currency] = (spendByCurrency[currency] ?? 0) + amount;
    topCandidates.push({
      name: stay.name,
      ...(stay.country ? { country: stay.country } : {}),
      amount,
      currency,
    });

    // Per-country spend only makes sense when the stay names a country.
    if (stay.country) {
      const existing = byCountry.get(stay.country) ?? {};
      existing[currency] = (existing[currency] ?? 0) + amount;
      byCountry.set(stay.country, existing);
    }
  }

  // Sort countries desc by their largest single-currency total (currencies are
  // never summed together — that would imply an FX rate we do not have).
  const spendByCountry: CountrySpend[] = [...byCountry.entries()]
    .map(([country, currencies]) => ({ country, byCurrency: currencies }))
    .sort((a, b) => maxCurrencyTotal(b.byCurrency) - maxCurrencyTotal(a.byCurrency));

  // Average nightly per currency — only when there are dated nights to divide by.
  const avgNightlyByCurrency: Record<string, number> = {};
  if (nights > 0) {
    for (const [currency, total] of Object.entries(spendByCurrency)) {
      avgNightlyByCurrency[currency] = Math.round(total / nights);
    }
  }

  const topStays = topCandidates.sort((a, b) => b.amount - a.amount).slice(0, TOP_STAYS_LIMIT);

  return {
    spendByCurrency,
    spendByCountry,
    nights,
    avgNightlyByCurrency,
    topStays,
    stayCount: stays.length,
    currencyCount: Object.keys(spendByCurrency).length,
  };
}

/** The single largest per-currency total within one country's spend map (0 when empty). */
function maxCurrencyTotal(byCurrency: Record<string, number>): number {
  let max = 0;
  for (const total of Object.values(byCurrency)) max = Math.max(max, total);
  return max;
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
    budget: computeBudget(data.travel.stays ?? []),
  };
}
