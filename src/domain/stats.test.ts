import { describe, expect, it } from 'vitest';
import { computeStats } from './stats';
import type { Country, TravelData } from './schema';

/** Build a minimal country with sensible empty defaults. */
function country(partial: Partial<Country> & { name: string }): Country {
  return {
    name: partial.name,
    status: partial.status ?? { visited: false, lived: false, birthplace: false },
    capitalVisit: partial.capitalVisit ?? { visited: false },
    timeline: partial.timeline ?? { visited: [], lived: [] },
    cities: partial.cities ?? [],
  };
}

function data(countries: Country[]): TravelData {
  return {
    person: { birthplace: { country: '' } },
    travel: { countries },
  };
}

const visited = { visited: true, lived: false, birthplace: false };

describe('computeStats — world / UN math', () => {
  it('counts a UN member toward pct using /193', () => {
    const stats = computeStats(data([country({ name: 'France', status: visited })]));
    expect(stats.world.unMembers).toBe(193);
    expect(stats.world.visitedUnMembers).toBe(1);
    expect(stats.world.nonMemberVisited).toBe(0);
    expect(stats.world.pct).toBe(Math.round((1 / 193) * 100)); // 1
  });

  it('does NOT raise pct or member count when visiting Taiwan', () => {
    const stats = computeStats(data([country({ name: 'Taiwan', status: visited })]));
    expect(stats.world.visitedUnMembers).toBe(0);
    expect(stats.world.nonMemberVisited).toBe(1);
    expect(stats.world.pct).toBe(0);
  });

  it('does NOT count the Vatican toward UN members', () => {
    const stats = computeStats(data([country({ name: 'Vatican City', status: visited })]));
    expect(stats.world.visitedUnMembers).toBe(0);
    expect(stats.world.nonMemberVisited).toBe(1);
    expect(stats.world.pct).toBe(0);
  });

  it('mixes members and non-members correctly', () => {
    const stats = computeStats(
      data([
        country({ name: 'France', status: visited }),
        country({ name: 'Japan', status: visited }),
        country({ name: 'Taiwan', status: visited }),
        country({ name: 'Vatican City', status: visited }),
      ]),
    );
    expect(stats.world.visitedUnMembers).toBe(2);
    expect(stats.world.nonMemberVisited).toBe(2);
    expect(stats.world.pct).toBe(Math.round((2 / 193) * 100)); // 1
    // traveled counts everything with a status, members and non-members alike.
    expect(stats.traveled).toBe(4);
  });

  it('only counts countries that actually have a status', () => {
    const stats = computeStats(
      data([
        country({ name: 'France', status: visited }),
        country({ name: 'Germany' }), // no status -> not traveled, not counted
      ]),
    );
    expect(stats.traveled).toBe(1);
    expect(stats.world.visitedUnMembers).toBe(1);
    expect(stats.countries).toBe(2);
  });
});

describe('computeStats — per-continent progress', () => {
  it('reports visited / UN-member denominator / pct per continent', () => {
    const stats = computeStats(
      data([
        country({ name: 'France', status: visited }),
        country({ name: 'Germany', status: visited }),
      ]),
    );
    expect(stats.byContinent.Europe).toBe(2);
    expect(stats.byContinentPct.Europe).toEqual({
      visited: 2,
      unMembers: 43,
      pct: Math.round((2 / 43) * 100), // 5
    });
  });

  it('keeps non-members out of the continent UN denominator usage', () => {
    // Taiwan is in Asia bucket but is NOT a UN member; it still shows as
    // visited in its continent, but the denominator stays the UN total.
    const stats = computeStats(data([country({ name: 'Taiwan', status: visited })]));
    const asia = stats.byContinentPct.Asia;
    expect(asia).toBeDefined();
    expect(asia!.visited).toBe(1);
    expect(asia!.unMembers).toBe(47);
  });
});

describe('computeStats — discovery timeline & milestones', () => {
  it('records the first year a country was discovered (country + city timelines)', () => {
    const stats = computeStats(
      data([
        country({
          name: 'Italy',
          status: visited,
          timeline: { visited: ['2010-05'], lived: [] },
          cities: [{ name: 'Rome', timeline: { visited: [2012, 2015] } }],
        }),
        country({
          name: 'Spain',
          status: visited,
          timeline: { visited: ['2018-2020'], lived: [] },
          cities: [],
        }),
      ]),
    );
    // Italy's earliest event is 2010 (country timeline beats its city years).
    expect(stats.newCountriesPerYear[2010]).toBe(1);
    // Spain's range start is 2018.
    expect(stats.newCountriesPerYear[2018]).toBe(1);
  });

  it('computes busiest year, active years, and longest streak from trips', () => {
    const stats = computeStats(
      data([
        country({
          name: 'France',
          status: visited,
          cities: [{ name: 'Paris', timeline: { visited: [2019, 2020] } }],
        }),
        country({
          name: 'Japan',
          status: visited,
          cities: [{ name: 'Tokyo', timeline: { visited: [2020, 2021] } }],
        }),
        country({
          name: 'Brazil',
          status: visited,
          cities: [{ name: 'Rio', timeline: { visited: [2024] } }],
        }),
      ]),
    );
    // yearTrips: 2019x1, 2020x2, 2021x1, 2024x1
    expect(stats.yearTrips).toEqual({ 2019: 1, 2020: 2, 2021: 1, 2024: 1 });
    expect(stats.milestones.busiestYear).toEqual({ year: 2020, count: 2 });
    expect(stats.milestones.activeYears).toBe(4);
    // Consecutive run 2019-2020-2021 = 3 (2024 breaks it).
    expect(stats.milestones.longestStreak).toBe(3);
    expect(stats.milestones.firstEverYear).toBe(2019);
    expect(stats.firstYear).toBe(2019);
    expect(stats.lastYear).toBe(2024);
    expect(stats.span).toBe(5);
  });

  it('handles no trips gracefully', () => {
    const stats = computeStats(data([country({ name: 'France', status: visited })]));
    expect(stats.milestones.busiestYear).toBeNull();
    expect(stats.milestones.firstEverYear).toBeNull();
    expect(stats.milestones.longestStreak).toBe(0);
    expect(stats.milestones.activeYears).toBe(0);
    expect(stats.firstYear).toBeNull();
  });
});

describe('computeStats — city dimensions', () => {
  it('counts total, distinct cities and countries with cities', () => {
    const stats = computeStats(
      data([
        country({
          name: 'Italy',
          status: visited,
          cities: [
            { name: 'Rome', timeline: { visited: [] } },
            { name: 'rome', timeline: { visited: [] } }, // dedupes case-insensitively
            { name: 'Milan', timeline: { visited: [] } },
          ],
        }),
        country({ name: 'Spain', status: visited, cities: [] }),
      ]),
    );
    expect(stats.cities).toBe(3);
    expect(stats.distinctCities).toBe(2);
    expect(stats.countriesWithCities).toBe(1);
  });
});

describe('computeStats — backward compatibility', () => {
  it('preserves all original TravelStats fields and meanings', () => {
    const stats = computeStats(
      data([
        country({
          name: 'France',
          status: { visited: false, lived: true, birthplace: false },
          cities: [{ name: 'Paris', timeline: { visited: [2020] } }],
        }),
      ]),
    );
    expect(stats.countries).toBe(1);
    expect(stats.traveled).toBe(1);
    expect(stats.cities).toBe(1);
    expect(stats.byStatus).toEqual({ birthplace: 0, lived: 1, visited: 0, capital: 0 });
    expect(stats.byContinent).toEqual({ Europe: 1 });
    expect(stats.firstYear).toBe(2020);
    expect(stats.lastYear).toBe(2020);
    expect(stats.span).toBe(0);
    expect(stats.yearTrips).toEqual({ 2020: 1 });
  });
});
