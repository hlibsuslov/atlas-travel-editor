import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { CountryStatus, TravelData } from '@/domain/schema';
import { makeDefaultData, makeEmptyCountry } from '@/domain/normalize';

/**
 * Editor state. Holds the working travel document plus a `dirty` flag so the UI
 * knows when there are unsaved local changes relative to the last server sync.
 * All mutations are immutable (via Immer) and keep `dirty` accurate.
 */
export interface EditorState {
  data: TravelData;
  dirty: boolean;

  // Lifecycle
  setData: (data: TravelData, opts?: { markClean?: boolean }) => void;
  reset: () => void;
  markClean: () => void;

  // Person
  setBirthplace: (country: string) => void;

  // Countries
  addCountry: () => void;
  removeCountry: (index: number) => void;
  setCountryName: (index: number, name: string) => void;
  setStatus: (index: number, key: keyof CountryStatus, value: boolean) => void;
  setCapitalVisit: (index: number, value: boolean) => void;
  /** Set the single dominant status (used by the interactive map click-cycle). */
  setPrimaryStatus: (index: number, status: 'none' | 'visited' | 'lived' | 'birthplace') => void;
  /** Find a country by name (case/format-insensitive) or create it; returns its index. */
  ensureCountry: (name: string) => number;

  // Country timelines (validated string entries)
  addCountryTimeline: (index: number, field: 'visited' | 'lived', value: string) => void;
  removeCountryTimeline: (index: number, field: 'visited' | 'lived', entryIndex: number) => void;

  // Cities
  addCity: (index: number, name: string, year?: number) => void;
  removeCity: (index: number, cityIndex: number) => void;
  renameCity: (index: number, cityIndex: number, name: string) => void;
  addCityYear: (index: number, cityIndex: number, year: number) => void;
  removeCityYear: (index: number, cityIndex: number, yearIndex: number) => void;
}

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    data: makeDefaultData(),
    dirty: false,

    setData: (data, opts) =>
      set((s) => {
        s.data = data;
        s.dirty = !opts?.markClean;
      }),

    reset: () =>
      set((s) => {
        s.data = makeDefaultData();
        s.dirty = true;
      }),

    markClean: () =>
      set((s) => {
        s.dirty = false;
      }),

    setBirthplace: (country) =>
      set((s) => {
        s.data.person.birthplace.country = country;
        s.dirty = true;
      }),

    addCountry: () =>
      set((s) => {
        s.data.travel.countries.unshift(makeEmptyCountry());
        s.dirty = true;
      }),

    removeCountry: (index) =>
      set((s) => {
        s.data.travel.countries.splice(index, 1);
        s.dirty = true;
      }),

    setCountryName: (index, name) =>
      set((s) => {
        const c = s.data.travel.countries[index];
        if (c) {
          c.name = name;
          s.dirty = true;
        }
      }),

    setStatus: (index, key, value) =>
      set((s) => {
        const c = s.data.travel.countries[index];
        if (c) {
          c.status[key] = value;
          s.dirty = true;
        }
      }),

    setCapitalVisit: (index, value) =>
      set((s) => {
        const c = s.data.travel.countries[index];
        if (c) {
          c.capitalVisit.visited = value;
          s.dirty = true;
        }
      }),

    setPrimaryStatus: (index, status) =>
      set((s) => {
        const c = s.data.travel.countries[index];
        if (!c) return;
        c.status.visited = status !== 'none';
        c.status.lived = status === 'lived' || status === 'birthplace';
        c.status.birthplace = status === 'birthplace';
        s.dirty = true;
      }),

    ensureCountry: (name) => {
      const norm = (v: string) =>
        v
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
      const key = norm(name);
      const existing = get().data.travel.countries.findIndex((c) => norm(c.name) === key);
      if (existing !== -1) return existing;
      set((s) => {
        s.data.travel.countries.push({
          name,
          status: { visited: false, lived: false, birthplace: false },
          capitalVisit: { visited: false },
          timeline: { visited: [], lived: [] },
          cities: [],
        });
        s.dirty = true;
      });
      return get().data.travel.countries.length - 1;
    },

    addCountryTimeline: (index, field, value) =>
      set((s) => {
        const c = s.data.travel.countries[index];
        if (c) {
          c.timeline[field].push(value);
          s.dirty = true;
        }
      }),

    removeCountryTimeline: (index, field, entryIndex) =>
      set((s) => {
        const c = s.data.travel.countries[index];
        if (c) {
          c.timeline[field].splice(entryIndex, 1);
          s.dirty = true;
        }
      }),

    addCity: (index, name, year) =>
      set((s) => {
        const c = s.data.travel.countries[index];
        if (c) {
          c.cities.push({ name, timeline: { visited: year !== undefined ? [year] : [] } });
          s.dirty = true;
        }
      }),

    removeCity: (index, cityIndex) =>
      set((s) => {
        const c = s.data.travel.countries[index];
        if (c) {
          c.cities.splice(cityIndex, 1);
          s.dirty = true;
        }
      }),

    renameCity: (index, cityIndex, name) =>
      set((s) => {
        const city = s.data.travel.countries[index]?.cities[cityIndex];
        if (city) {
          city.name = name;
          s.dirty = true;
        }
      }),

    addCityYear: (index, cityIndex, year) =>
      set((s) => {
        const city = s.data.travel.countries[index]?.cities[cityIndex];
        if (city && !city.timeline.visited.includes(year)) {
          city.timeline.visited.push(year);
          city.timeline.visited.sort((a, b) => a - b);
          s.dirty = true;
        }
      }),

    removeCityYear: (index, cityIndex, yearIndex) =>
      set((s) => {
        const city = s.data.travel.countries[index]?.cities[cityIndex];
        if (city) {
          city.timeline.visited.splice(yearIndex, 1);
          s.dirty = true;
        }
      }),
  })),
);
