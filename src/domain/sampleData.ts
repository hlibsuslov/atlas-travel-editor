import type { TravelData } from './schema';

/**
 * A richer, illustrative example that lights up every surface: the map (several
 * marked countries), the dashboard stats (cities + visited years), and the diary
 * (a stay with a small cost). Distinct from `makeDefaultData()` — which other
 * code and tests pin — so we can offer "Load a richer sample" without disturbing
 * the editor store's initial state.
 */
export function makeSampleData(): TravelData {
  return {
    person: { birthplace: { country: 'Portugal' } },
    travel: {
      countries: [
        {
          name: 'Portugal',
          status: { visited: true, lived: true, birthplace: true },
          capitalVisit: { visited: true },
          timeline: { visited: ['2019'], lived: ['1995-2018'] },
          cities: [{ name: 'Lisbon', timeline: { visited: [2019] } }],
        },
        {
          name: 'Spain',
          status: { visited: true, lived: false, birthplace: false },
          capitalVisit: { visited: true },
          timeline: { visited: ['2021-06'], lived: [] },
          cities: [{ name: 'Barcelona', timeline: { visited: [2021] } }],
        },
        {
          name: 'Italy',
          status: { visited: true, lived: false, birthplace: false },
          capitalVisit: { visited: false },
          timeline: { visited: ['2023-09'], lived: [] },
          cities: [{ name: 'Rome', timeline: { visited: [2023] } }],
        },
      ],
      stays: [
        {
          name: 'Hotel Arc de Triomf',
          country: 'Spain',
          city: 'Barcelona',
          from: '2021-06-10',
          to: '2021-06-14',
          cost: { amount: 42000, currency: 'EUR' },
        },
      ],
    },
  };
}

/**
 * A valid-shaped but empty document: a present-but-blank birthplace and no
 * countries. Lets a first-time user start from a clean slate while still
 * satisfying the structural shape the editor expects.
 */
export function makeEmptyData(): TravelData {
  return {
    person: { birthplace: { country: '' } },
    travel: { countries: [] },
  };
}
