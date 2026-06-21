import { describe, expect, it } from 'vitest';
import { computeStats } from './stats';
import type { Country, Stay, TravelData } from './schema';

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

/** Build TravelData with a diary of stays (no countries needed for budget tests). */
function dataWithStays(stays: Stay[]): TravelData {
  return {
    person: { birthplace: { country: '' } },
    travel: { countries: [], stays },
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

describe('computeStats — budget aggregation', () => {
  it('is all-empty when there is no diary at all', () => {
    const stats = computeStats(data([country({ name: 'France', status: visited })]));
    expect(stats.budget).toEqual({
      spendByCurrency: {},
      spendByCountry: [],
      nights: 0,
      avgNightlyByCurrency: {},
      topStays: [],
      stayCount: 0,
      currencyCount: 0,
    });
  });

  it('is all-empty for an empty stays array (never NaN/Infinity)', () => {
    const stats = computeStats(dataWithStays([]));
    expect(stats.budget.spendByCurrency).toEqual({});
    expect(stats.budget.avgNightlyByCurrency).toEqual({});
    expect(stats.budget.nights).toBe(0);
    expect(stats.budget.stayCount).toBe(0);
    expect(stats.budget.currencyCount).toBe(0);
  });

  it('sums a single currency across stays', () => {
    const stats = computeStats(
      dataWithStays([
        { name: 'Hotel A', country: 'France', cost: { amount: 12000, currency: 'EUR' } },
        { name: 'Hotel B', country: 'France', cost: { amount: 8000, currency: 'EUR' } },
      ]),
    );
    expect(stats.budget.spendByCurrency).toEqual({ EUR: 20000 });
    expect(stats.budget.currencyCount).toBe(1);
    expect(stats.budget.stayCount).toBe(2);
  });

  it('keeps mixed currencies grouped and never sums across them', () => {
    const stats = computeStats(
      dataWithStays([
        { name: 'Hotel EUR', country: 'France', cost: { amount: 10000, currency: 'EUR' } },
        { name: 'Hotel USD', country: 'USA', cost: { amount: 25000, currency: 'USD' } },
        { name: 'Hotel EUR2', country: 'France', cost: { amount: 5000, currency: 'EUR' } },
      ]),
    );
    expect(stats.budget.spendByCurrency).toEqual({ EUR: 15000, USD: 25000 });
    expect(stats.budget.currencyCount).toBe(2);
  });

  it('groups per-country spend by currency, sorted desc by largest currency total', () => {
    const stats = computeStats(
      dataWithStays([
        { name: 'Cheap', country: 'Portugal', cost: { amount: 3000, currency: 'EUR' } },
        { name: 'Pricey', country: 'Japan', cost: { amount: 90000, currency: 'JPY' } },
        { name: 'Mid', country: 'France', cost: { amount: 20000, currency: 'EUR' } },
      ]),
    );
    expect(stats.budget.spendByCountry).toEqual([
      { country: 'Japan', byCurrency: { JPY: 90000 } },
      { country: 'France', byCurrency: { EUR: 20000 } },
      { country: 'Portugal', byCurrency: { EUR: 3000 } },
    ]);
  });

  it('merges multiple currencies within one country', () => {
    const stats = computeStats(
      dataWithStays([
        { name: 'Local', country: 'Switzerland', cost: { amount: 40000, currency: 'CHF' } },
        { name: 'Card', country: 'Switzerland', cost: { amount: 12000, currency: 'EUR' } },
        { name: 'Local2', country: 'Switzerland', cost: { amount: 10000, currency: 'CHF' } },
      ]),
    );
    expect(stats.budget.spendByCountry).toEqual([
      { country: 'Switzerland', byCurrency: { CHF: 50000, EUR: 12000 } },
    ]);
  });

  it('counts a stay with a cost but no country: in spendByCurrency, NOT in spendByCountry', () => {
    const stats = computeStats(
      dataWithStays([
        { name: 'Nameless place', cost: { amount: 7000, currency: 'USD' } },
        { name: 'Known', country: 'USA', cost: { amount: 3000, currency: 'USD' } },
      ]),
    );
    expect(stats.budget.spendByCurrency).toEqual({ USD: 10000 });
    expect(stats.budget.spendByCountry).toEqual([
      { country: 'USA', byCurrency: { USD: 3000 } },
    ]);
    expect(stats.budget.stayCount).toBe(2);
  });

  it('counts costless stays toward stayCount but not toward spend', () => {
    const stats = computeStats(
      dataWithStays([
        { name: 'Free crash pad', country: 'France' },
        { name: 'Paid', country: 'France', cost: { amount: 5000, currency: 'EUR' } },
      ]),
    );
    expect(stats.budget.stayCount).toBe(2);
    expect(stats.budget.spendByCurrency).toEqual({ EUR: 5000 });
    expect(stats.budget.spendByCountry).toEqual([
      { country: 'France', byCurrency: { EUR: 5000 } },
    ]);
  });

  it('sums nights only when both endpoints are concrete dates (inclusive-exclusive)', () => {
    const stats = computeStats(
      dataWithStays([
        // 4 nights: Jun 1 -> Jun 5.
        { name: 'A', from: '2024-06-01', to: '2024-06-05', cost: { amount: 40000, currency: 'EUR' } },
        // 1 night across a month boundary normalises YYYY-MM -> 1st: Jul 1 -> Jul 2.
        { name: 'B', from: '2024-07-01', to: '2024-07-02', cost: { amount: 10000, currency: 'EUR' } },
      ]),
    );
    expect(stats.budget.nights).toBe(5);
    // avg = round(50000 / 5) = 10000
    expect(stats.budget.avgNightlyByCurrency).toEqual({ EUR: 10000 });
  });

  it('rounds average nightly to the nearest minor unit', () => {
    const stats = computeStats(
      dataWithStays([
        // 3 nights, 10000 total -> 10000/3 = 3333.33 -> 3333
        { name: 'A', from: '2024-01-01', to: '2024-01-04', cost: { amount: 10000, currency: 'EUR' } },
      ]),
    );
    expect(stats.budget.nights).toBe(3);
    expect(stats.budget.avgNightlyByCurrency).toEqual({ EUR: 3333 });
  });

  it('produces no average and zero nights when dates are missing (no divide by zero)', () => {
    const stats = computeStats(
      dataWithStays([
        { name: 'No dates', country: 'Italy', cost: { amount: 8000, currency: 'EUR' } },
      ]),
    );
    expect(stats.budget.nights).toBe(0);
    expect(stats.budget.spendByCurrency).toEqual({ EUR: 8000 });
    expect(stats.budget.avgNightlyByCurrency).toEqual({});
  });

  it('ignores junk / reversed / year-range / partial-pair dates for nights', () => {
    const stats = computeStats(
      dataWithStays([
        { name: 'OnlyFrom', from: '2024-06-01', cost: { amount: 1000, currency: 'EUR' } },
        { name: 'Reversed', from: '2024-06-10', to: '2024-06-01', cost: { amount: 1000, currency: 'EUR' } },
        { name: 'SameDay', from: '2024-06-01', to: '2024-06-01', cost: { amount: 1000, currency: 'EUR' } },
        { name: 'YearRange', from: '2018-2020', to: '2018-2020', cost: { amount: 1000, currency: 'EUR' } },
      ]),
    );
    expect(stats.budget.nights).toBe(0);
    expect(stats.budget.avgNightlyByCurrency).toEqual({});
    expect(stats.budget.spendByCurrency).toEqual({ EUR: 4000 });
  });

  it('surfaces the 5 most expensive stays, sorted desc, each with its own currency', () => {
    const stats = computeStats(
      dataWithStays([
        { name: 'S1', country: 'A', cost: { amount: 100, currency: 'EUR' } },
        { name: 'S2', country: 'B', cost: { amount: 600, currency: 'USD' } },
        { name: 'S3', cost: { amount: 300, currency: 'EUR' } },
        { name: 'S4', country: 'C', cost: { amount: 500, currency: 'GBP' } },
        { name: 'S5', country: 'D', cost: { amount: 200, currency: 'EUR' } },
        { name: 'S6', country: 'E', cost: { amount: 400, currency: 'EUR' } },
      ]),
    );
    expect(stats.budget.topStays).toEqual([
      { name: 'S2', country: 'B', amount: 600, currency: 'USD' },
      { name: 'S4', country: 'C', amount: 500, currency: 'GBP' },
      { name: 'S6', country: 'E', amount: 400, currency: 'EUR' },
      { name: 'S3', amount: 300, currency: 'EUR' }, // no country -> no country key
      { name: 'S5', country: 'D', amount: 200, currency: 'EUR' },
    ]);
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
