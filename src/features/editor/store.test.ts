import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from './store';
import { makeDefaultData } from '@/domain/normalize';

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

  it('reset restores default data and marks dirty', () => {
    useEditorStore.getState().setBirthplace('Spain');
    useEditorStore.getState().reset();
    const s = useEditorStore.getState();
    expect(s.data).toEqual(makeDefaultData());
    expect(s.dirty).toBe(true);
  });
});
