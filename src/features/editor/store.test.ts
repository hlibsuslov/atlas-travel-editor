import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from './store';
import { makeDefaultData } from '@/domain/normalize';
import type { Country } from '@/domain/schema';

const makeCountry = (over: Partial<Country> = {}): Country => ({
  name: '',
  status: { visited: false, lived: false, birthplace: false },
  capitalVisit: { visited: false },
  timeline: { visited: [], lived: [] },
  cities: [],
  ...over,
});

const reset = () => useEditorStore.getState().setData(makeDefaultData(), { markClean: true });

describe('useEditorStore', () => {
  beforeEach(reset);

  it('setData with markClean leaves the document clean', () => {
    expect(useEditorStore.getState().dirty).toBe(false);
  });

  it('any mutation marks the document dirty', () => {
    useEditorStore.getState().setBirthplace('Poland');
    const s = useEditorStore.getState();
    expect(s.dirty).toBe(true);
    expect(s.data.person.birthplace.country).toBe('Poland');
  });

  it('addCountry prepends an empty country', () => {
    useEditorStore.getState().addCountry();
    expect(useEditorStore.getState().data.travel.countries[0]!.name).toBe('');
  });

  it('addCityYear dedupes and keeps years sorted', () => {
    const store = useEditorStore.getState();
    store.addCity(0, 'Vienna', 2022);
    store.addCityYear(0, 0, 2020);
    store.addCityYear(0, 0, 2020); // duplicate ignored
    expect(useEditorStore.getState().data.travel.countries[0]!.cities[0]!.timeline.visited).toEqual(
      [2020, 2022],
    );
  });

  it('mutations on out-of-range indices are no-ops, not crashes', () => {
    expect(() => useEditorStore.getState().setCountryName(99, 'x')).not.toThrow();
    expect(() => useEditorStore.getState().removeCityYear(99, 99, 99)).not.toThrow();
  });

  it('reset restores default data; dirty reflects difference from the saved baseline', () => {
    // Establish a non-default saved baseline, then reset back to default.
    useEditorStore.getState().setBirthplace('Spain');
    useEditorStore.getState().markClean(); // baseline is now the Spain document
    useEditorStore.getState().reset(); // back to default, which differs from baseline
    const s = useEditorStore.getState();
    expect(s.data).toEqual(makeDefaultData());
    expect(s.dirty).toBe(true);
  });

  it('editing back to the saved baseline clears dirty (no phantom unsaved state)', () => {
    // Baseline (from beforeEach) is the default doc with birthplace "Ukraine".
    useEditorStore.getState().setBirthplace('Poland');
    expect(useEditorStore.getState().dirty).toBe(true);
    useEditorStore.getState().setBirthplace('Ukraine'); // back to the saved value
    expect(useEditorStore.getState().dirty).toBe(false);
  });

  it('undo back to the saved baseline clears dirty', () => {
    useEditorStore.getState().setBirthplace('Poland');
    expect(useEditorStore.getState().dirty).toBe(true);
    useEditorStore.getState().undo();
    const s = useEditorStore.getState();
    expect(s.data.person.birthplace.country).toBe('Ukraine');
    expect(s.dirty).toBe(false);
  });

  it('a duplicate addCityYear is a no-op and adds no undo entry', () => {
    const store = useEditorStore.getState();
    store.addCity(0, 'Vienna', 2022);
    const historyBefore = useEditorStore.getState().past.length;
    store.addCityYear(0, 0, 2022); // already present via addCity
    const after = useEditorStore.getState();
    expect(after.past.length).toBe(historyBefore); // no snapshot pushed
    expect(after.data.travel.countries[0]!.cities[0]!.timeline.visited).toEqual([2022]);
  });

  it('undo reverts the last mutation and redo re-applies it', () => {
    useEditorStore.getState().setBirthplace('Poland');
    expect(useEditorStore.getState().data.person.birthplace.country).toBe('Poland');

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().data.person.birthplace.country).toBe('Ukraine');

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().data.person.birthplace.country).toBe('Poland');
  });

  it('undo with no history is a no-op', () => {
    expect(() => useEditorStore.getState().undo()).not.toThrow();
    expect(useEditorStore.getState().data).toEqual(makeDefaultData());
  });

  it('a new mutation clears the redo stack', () => {
    const store = useEditorStore.getState();
    store.setBirthplace('Poland');
    store.undo(); // back to Ukraine, Poland now redoable
    store.setBirthplace('Spain'); // should discard the redo entry
    expect(useEditorStore.getState().future).toHaveLength(0);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().data.person.birthplace.country).toBe('Spain');
  });

  it('setData clears the undo history', () => {
    useEditorStore.getState().setBirthplace('Poland');
    useEditorStore.getState().setData(makeDefaultData(), { markClean: true });
    const s = useEditorStore.getState();
    expect(s.past).toHaveLength(0);
    expect(s.future).toHaveLength(0);
  });

  it('reorderCountries moves a country to a new position', () => {
    const store = useEditorStore.getState();
    store.addCountry(); // empty country prepended at index 0
    store.setCountryName(0, 'Zed');
    // Order is now ['Zed', 'Ukraine']; move Zed to the end.
    useEditorStore.getState().reorderCountries(0, 1);
    const names = useEditorStore.getState().data.travel.countries.map((c) => c.name);
    expect(names).toEqual(['Ukraine', 'Zed']);
  });

  it('reorderCountries with an out-of-range index is a no-op', () => {
    const before = useEditorStore.getState().data.travel.countries.map((c) => c.name);
    useEditorStore.getState().reorderCountries(0, 99);
    expect(useEditorStore.getState().data.travel.countries.map((c) => c.name)).toEqual(before);
  });

  it('mergeCountries appends new countries and merges matching ones in one undo step', () => {
    // Use an explicit fixture so this merge test is independent of first-run data.
    const fixture = makeDefaultData();
    fixture.travel.countries = [
      makeCountry({
        name: 'Austria',
        status: { visited: true, lived: false, birthplace: false },
        capitalVisit: { visited: true },
      }),
    ];
    useEditorStore.getState().setData(fixture, { markClean: true });
    const incoming: Country[] = [
      makeCountry({
        name: 'austria', // canonical match against existing 'Austria'
        status: { visited: false, lived: true, birthplace: false },
        capitalVisit: { visited: false },
        timeline: { visited: ['2021'], lived: ['2020'] },
        cities: [
          { name: 'Vienna', timeline: { visited: [2020, 2018] } },
          { name: 'Graz', timeline: { visited: [2019] } },
        ],
      }),
      makeCountry({ name: 'Poland', status: { visited: true, lived: false, birthplace: false } }),
    ];
    useEditorStore.getState().mergeCountries(incoming);

    const countries = useEditorStore.getState().data.travel.countries;
    expect(countries.map((c) => c.name)).toEqual(['Austria', 'Poland']);

    const austria = countries[0]!;
    // Status booleans are OR-unioned (existing visited stays true, lived turns on).
    expect(austria.status).toEqual({ visited: true, lived: true, birthplace: false });
    // Existing capital visit (true) is preserved despite incoming false.
    expect(austria.capitalVisit.visited).toBe(true);
    expect(austria.timeline).toEqual({ visited: ['2021'], lived: ['2020'] });
    // Brand-new cities are appended verbatim (sorting only happens when unioning
    // years into an already-present city of the same name).
    expect(austria.cities).toEqual([
      { name: 'Vienna', timeline: { visited: [2020, 2018] } },
      { name: 'Graz', timeline: { visited: [2019] } },
    ]);
  });

  it('mergeCountries dedupes city years and timeline entries on a matching city', () => {
    useEditorStore.getState().addCity(0, 'Kyiv', 2020); // Ukraine gets Kyiv [2020]
    useEditorStore.getState().mergeCountries([
      makeCountry({
        name: 'Ukraine',
        timeline: { visited: [], lived: [] },
        cities: [{ name: 'Kyiv', timeline: { visited: [2020, 2019] } }],
      }),
    ]);
    const ukraine = useEditorStore.getState().data.travel.countries[0]!;
    expect(ukraine.cities).toHaveLength(1);
    expect(ukraine.cities[0]!.timeline.visited).toEqual([2019, 2020]);
  });

  it('mergeCountries is a single undo step', () => {
    useEditorStore
      .getState()
      .mergeCountries([makeCountry({ name: 'Poland' }), makeCountry({ name: 'Spain' })]);
    expect(useEditorStore.getState().data.travel.countries).toHaveLength(3);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().data.travel.countries.map((c) => c.name)).toEqual(['Ukraine']);
  });

  it('actualizeCountry creates a missing country, sets visited, and adds the year', () => {
    useEditorStore.getState().actualizeCountry('Poland', 2023);
    const poland = useEditorStore
      .getState()
      .data.travel.countries.find((c) => c.name === 'Poland')!;
    expect(poland.status.visited).toBe(true);
    expect(poland.timeline.visited).toEqual(['2023']);
  });

  it('actualizeCountry reuses an existing country and is idempotent', () => {
    const store = useEditorStore.getState();
    store.actualizeCountry('ukraine', 2022); // canonical match to existing 'Ukraine'
    store.actualizeCountry('Ukraine', 2022); // duplicate year ignored
    const countries = useEditorStore.getState().data.travel.countries;
    expect(countries).toHaveLength(1);
    expect(countries[0]!.name).toBe('Ukraine');
    expect(countries[0]!.status.visited).toBe(true);
    expect(countries[0]!.timeline.visited).toEqual(['2022']);
  });

  it('reorderCities moves a city within a country', () => {
    const store = useEditorStore.getState();
    store.addCity(0, 'Vienna');
    store.addCity(0, 'Graz');
    store.addCity(0, 'Linz');
    useEditorStore.getState().reorderCities(0, 0, 2);
    const names = useEditorStore.getState().data.travel.countries[0]!.cities.map((c) => c.name);
    expect(names).toEqual(['Graz', 'Linz', 'Vienna']);
  });

  it('reorderCities with out-of-range indices is a no-op', () => {
    const store = useEditorStore.getState();
    store.addCity(0, 'Vienna');
    store.addCity(0, 'Graz');
    const before = useEditorStore.getState().data.travel.countries[0]!.cities.map((c) => c.name);
    useEditorStore.getState().reorderCities(0, 0, 99); // to out of range
    useEditorStore.getState().reorderCities(99, 0, 1); // missing country
    expect(useEditorStore.getState().data.travel.countries[0]!.cities.map((c) => c.name)).toEqual(
      before,
    );
  });

  it('adds, edits and removes diary stays (dropping the key when empty)', () => {
    const store = useEditorStore.getState();
    store.addStay({ name: 'Hotel Sacher', city: 'Vienna' });
    expect(useEditorStore.getState().data.travel.stays).toHaveLength(1);

    store.setStay(0, {
      name: 'Hotel Sacher',
      city: 'Vienna',
      cost: { amount: 42000, currency: 'EUR' },
    });
    expect(useEditorStore.getState().data.travel.stays![0]!.cost).toEqual({
      amount: 42000,
      currency: 'EUR',
    });

    store.removeStay(0);
    // The optional key is dropped entirely once the diary is empty (legacy-slim).
    expect('stays' in useEditorStore.getState().data.travel).toBe(false);
  });

  it('a stay edit is a single undo step', () => {
    const store = useEditorStore.getState();
    store.addStay({ name: 'Place' });
    const depth = useEditorStore.getState().past.length;
    store.setStay(0, { name: 'Renamed' });
    expect(useEditorStore.getState().past.length).toBe(depth + 1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().data.travel.stays![0]!.name).toBe('Place');
  });
});
