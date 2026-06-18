import { create } from 'zustand';
import { current, type Draft } from 'immer';
import { immer } from 'zustand/middleware/immer';
import type { Country, CountryStatus, TravelData } from '@/domain/schema';
import { makeDefaultData, makeEmptyCountry } from '@/domain/normalize';
import { canonicalCountryName } from '@/domain/countries';

/**
 * Editor state. Holds the working travel document plus a `dirty` flag so the UI
 * knows when there are unsaved local changes relative to the last server sync,
 * and a bounded undo/redo history of document snapshots.
 *
 * All mutations are immutable (via Immer). Content-changing actions go through
 * the internal `mutate` helper, which snapshots the previous document onto the
 * undo stack and flips `dirty`. Load boundaries (`setData`) clear the history.
 */
export interface EditorState {
  data: TravelData;
  dirty: boolean;
  /** Past document snapshots, oldest first; the tail is the most recent. */
  past: TravelData[];
  /** Undone snapshots available for redo, newest first. */
  future: TravelData[];

  // Lifecycle
  setData: (data: TravelData, opts?: { markClean?: boolean }) => void;
  reset: () => void;
  markClean: () => void;

  // History
  undo: () => void;
  redo: () => void;

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
  /** Move a country from one position to another (drag-and-drop / keyboard reorder). */
  reorderCountries: (from: number, to: number) => void;
  /** Find a country by name (case/format-insensitive) or create it; returns its index. */
  ensureCountry: (name: string) => number;
  /**
   * Merge a batch of incoming countries into the document as a single undo step.
   * Matches existing countries by canonical name and unions their status, capital
   * visit, timelines, and cities; otherwise appends the new country.
   */
  mergeCountries: (countries: Country[]) => void;
  /** Mark a country (creating it if needed) as visited in the given calendar year. */
  actualizeCountry: (name: string, year: number) => void;

  // Country timelines (validated string entries)
  addCountryTimeline: (index: number, field: 'visited' | 'lived', value: string) => void;
  removeCountryTimeline: (index: number, field: 'visited' | 'lived', entryIndex: number) => void;

  // Cities
  addCity: (index: number, name: string, year?: number) => void;
  /** Move a city within a country from one position to another. */
  reorderCities: (countryIndex: number, from: number, to: number) => void;
  removeCity: (index: number, cityIndex: number) => void;
  renameCity: (index: number, cityIndex: number, name: string) => void;
  addCityYear: (index: number, cityIndex: number, year: number) => void;
  removeCityYear: (index: number, cityIndex: number, yearIndex: number) => void;
}

/** Cap the undo history so long sessions can't grow memory without bound. */
const HISTORY_LIMIT = 50;

/** Plain, detached snapshot of a draft's current document. */
const snapshot = (data: Draft<TravelData>): TravelData => structuredClone(current(data));

export const useEditorStore = create<EditorState>()(
  immer((set, get) => {
    /**
     * Apply a content mutation: record the pre-mutation document on the undo
     * stack, clear the redo stack, run the change, and mark the doc dirty.
     */
    const mutate = (recipe: (s: Draft<EditorState>) => void) =>
      set((s) => {
        s.past.push(snapshot(s.data));
        if (s.past.length > HISTORY_LIMIT) s.past.shift();
        s.future = [];
        recipe(s);
        s.dirty = true;
      });

    return {
      data: makeDefaultData(),
      dirty: false,
      past: [],
      future: [],

      setData: (data, opts) =>
        set((s) => {
          s.data = data;
          s.dirty = !opts?.markClean;
          // A load/import is a fresh baseline — there is nothing to undo past it.
          s.past = [];
          s.future = [];
        }),

      reset: () => mutate((s) => (s.data = makeDefaultData())),

      markClean: () =>
        set((s) => {
          s.dirty = false;
        }),

      undo: () =>
        set((s) => {
          const prev = s.past.pop();
          if (!prev) return;
          s.future.unshift(snapshot(s.data));
          s.data = prev;
          s.dirty = true;
        }),

      redo: () =>
        set((s) => {
          const next = s.future.shift();
          if (!next) return;
          s.past.push(snapshot(s.data));
          s.data = next;
          s.dirty = true;
        }),

      setBirthplace: (country) =>
        mutate((s) => {
          s.data.person.birthplace.country = country;
        }),

      addCountry: () =>
        mutate((s) => {
          s.data.travel.countries.unshift(makeEmptyCountry());
        }),

      removeCountry: (index) =>
        mutate((s) => {
          s.data.travel.countries.splice(index, 1);
        }),

      setCountryName: (index, name) =>
        mutate((s) => {
          const c = s.data.travel.countries[index];
          if (c) c.name = name;
        }),

      setStatus: (index, key, value) =>
        mutate((s) => {
          const c = s.data.travel.countries[index];
          if (c) c.status[key] = value;
        }),

      setCapitalVisit: (index, value) =>
        mutate((s) => {
          const c = s.data.travel.countries[index];
          if (c) c.capitalVisit.visited = value;
        }),

      setPrimaryStatus: (index, status) =>
        mutate((s) => {
          const c = s.data.travel.countries[index];
          if (!c) return;
          c.status.visited = status !== 'none';
          c.status.lived = status === 'lived' || status === 'birthplace';
          c.status.birthplace = status === 'birthplace';
        }),

      reorderCountries: (from, to) =>
        mutate((s) => {
          const arr = s.data.travel.countries;
          if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) return;
          const [moved] = arr.splice(from, 1);
          arr.splice(to, 0, moved!);
        }),

      ensureCountry: (name) => {
        const key = canonicalCountryName(name);
        const existing = get().data.travel.countries.findIndex(
          (c) => canonicalCountryName(c.name) === key,
        );
        if (existing !== -1) return existing;
        mutate((s) => {
          s.data.travel.countries.push({
            name,
            status: { visited: false, lived: false, birthplace: false },
            capitalVisit: { visited: false },
            timeline: { visited: [], lived: [] },
            cities: [],
          });
        });
        return get().data.travel.countries.length - 1;
      },

      mergeCountries: (countries) =>
        mutate((s) => {
          for (const incoming of countries) {
            const key = canonicalCountryName(incoming.name);
            const target = s.data.travel.countries.find(
              (c) => canonicalCountryName(c.name) === key,
            );
            if (!target) {
              s.data.travel.countries.push(structuredClone(incoming));
              continue;
            }
            // Union status booleans and capital visit.
            target.status.visited ||= incoming.status.visited;
            target.status.lived ||= incoming.status.lived;
            target.status.birthplace ||= incoming.status.birthplace;
            target.capitalVisit.visited ||= incoming.capitalVisit.visited;
            // Append timeline entries, de-duplicating.
            for (const field of ['visited', 'lived'] as const) {
              for (const entry of incoming.timeline[field]) {
                if (!target.timeline[field].includes(entry)) target.timeline[field].push(entry);
              }
            }
            // Merge cities by name (canonical, like the country rule): union
            // visited years (dedupe + sort).
            for (const city of incoming.cities) {
              const cityKey = canonicalCountryName(city.name);
              const existingCity = target.cities.find(
                (c) => canonicalCountryName(c.name) === cityKey,
              );
              if (!existingCity) {
                target.cities.push(structuredClone(city));
                continue;
              }
              const years = new Set(existingCity.timeline.visited);
              for (const y of city.timeline.visited) years.add(y);
              existingCity.timeline.visited = Array.from(years).sort((a, b) => a - b);
            }
          }
        }),

      actualizeCountry: (name, year) =>
        mutate((s) => {
          const key = canonicalCountryName(name);
          let c = s.data.travel.countries.find((x) => canonicalCountryName(x.name) === key);
          if (!c) {
            c = {
              name,
              status: { visited: false, lived: false, birthplace: false },
              capitalVisit: { visited: false },
              timeline: { visited: [], lived: [] },
              cities: [],
            };
            s.data.travel.countries.push(c);
          }
          c.status.visited = true;
          const entry = String(year);
          if (!c.timeline.visited.includes(entry)) c.timeline.visited.push(entry);
        }),

      addCountryTimeline: (index, field, value) =>
        mutate((s) => {
          const c = s.data.travel.countries[index];
          if (c) c.timeline[field].push(value);
        }),

      removeCountryTimeline: (index, field, entryIndex) =>
        mutate((s) => {
          const c = s.data.travel.countries[index];
          if (c) c.timeline[field].splice(entryIndex, 1);
        }),

      addCity: (index, name, year) =>
        mutate((s) => {
          const c = s.data.travel.countries[index];
          if (c) c.cities.push({ name, timeline: { visited: year !== undefined ? [year] : [] } });
        }),

      reorderCities: (countryIndex, from, to) =>
        mutate((s) => {
          const arr = s.data.travel.countries[countryIndex]?.cities;
          if (!arr) return;
          if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) return;
          const [moved] = arr.splice(from, 1);
          arr.splice(to, 0, moved!);
        }),

      removeCity: (index, cityIndex) =>
        mutate((s) => {
          const c = s.data.travel.countries[index];
          if (c) c.cities.splice(cityIndex, 1);
        }),

      renameCity: (index, cityIndex, name) =>
        mutate((s) => {
          const city = s.data.travel.countries[index]?.cities[cityIndex];
          if (city) city.name = name;
        }),

      addCityYear: (index, cityIndex, year) =>
        mutate((s) => {
          const city = s.data.travel.countries[index]?.cities[cityIndex];
          if (city && !city.timeline.visited.includes(year)) {
            city.timeline.visited.push(year);
            city.timeline.visited.sort((a, b) => a - b);
          }
        }),

      removeCityYear: (index, cityIndex, yearIndex) =>
        mutate((s) => {
          const city = s.data.travel.countries[index]?.cities[cityIndex];
          if (city) city.timeline.visited.splice(yearIndex, 1);
        }),
    };
  }),
);
