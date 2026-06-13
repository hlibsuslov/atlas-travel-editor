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
    // Order is now ['Zed', 'Austria']; move Zed to the end.
    useEditorStore.getState().reorderCountries(0, 1);
    const names = useEditorStore.getState().data.travel.countries.map((c) => c.name);
    expect(names).toEqual(['Austria', 'Zed']);
  });

  it('reorderCountries with an out-of-range index is a no-op', () => {
    const before = useEditorStore.getState().data.travel.countries.map((c) => c.name);
    useEditorStore.getState().reorderCountries(0, 99);
    expect(useEditorStore.getState().data.travel.countries.map((c) => c.name)).toEqual(before);
  });
});
