import { describe, expect, it } from 'vitest';
import { tidyTimeline, tidyTravelData } from './tidy';
import { makeEmptyCountry } from './normalize';
import { validateTravelData, type TravelData } from './schema';

describe('tidyTimeline', () => {
  it('orders mixed formats chronologically and removes duplicates', () => {
    expect(tidyTimeline(['2023-09', '2016', '2019-2020', '2016', '2019-06-01', '2019'])).toEqual([
      '2016',
      '2019',
      '2019-2020',
      '2019-06-01',
      '2023-09',
    ]);
  });
});

describe('tidyTravelData', () => {
  const base = (): TravelData => ({
    person: { birthplace: { country: ' Ukraine ' } },
    travel: {
      countries: [
        {
          ...makeEmptyCountry(),
          name: 'Portugal',
          status: { visited: true, lived: false, birthplace: false },
          timeline: { visited: ['2023', '2016'], lived: [] },
          cities: [
            { name: 'Lisbon', timeline: { visited: [2023] } },
            { name: 'lisbon', timeline: { visited: [2016, 2023] } },
            { name: ' ', timeline: { visited: [] } },
          ],
        },
        { ...makeEmptyCountry(), name: '' },
        {
          ...makeEmptyCountry(),
          name: 'portugal',
          capitalVisit: { visited: true },
          timeline: { visited: ['2019-06'], lived: [] },
        },
      ],
    },
  });

  it('merges duplicate countries and cities without losing visits', () => {
    const out = tidyTravelData(base());
    expect(out.person.birthplace.country).toBe('Ukraine');
    expect(out.travel.countries).toHaveLength(1);
    const pt = out.travel.countries[0]!;
    expect(pt.name).toBe('Portugal');
    expect(pt.capitalVisit.visited).toBe(true);
    expect(pt.timeline.visited).toEqual(['2016', '2019-06', '2023']);
    expect(pt.cities).toEqual([{ name: 'Lisbon', timeline: { visited: [2016, 2023] } }]);
    expect(validateTravelData(out).ok).toBe(true);
  });

  it('keeps the order the person chose for countries', () => {
    const data = base();
    data.travel.countries.unshift({ ...makeEmptyCountry(), name: 'Spain' });
    expect(tidyTravelData(data).travel.countries.map((c) => c.name)).toEqual(['Spain', 'Portugal']);
  });
});
