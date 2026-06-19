import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CityTimeline } from './CityTimeline';
import { useEditorStore } from '@/features/editor/store';
import { makeDefaultData } from '@/domain/normalize';

/**
 * Renders CityTimeline bound to the real store at country index 0, mirroring how
 * CountryCard wires it. Keeps the assertions focused on store side effects.
 */
function TimelineUnderTest() {
  const cities = useEditorStore((s) => s.data.travel.countries[0]!.cities);
  const store = useEditorStore();
  return (
    <CityTimeline
      cities={cities}
      onAddCity={(name) => store.addCity(0, name)}
      onRemoveCity={(ci) => store.removeCity(0, ci)}
      onRenameCity={(ci, name) => store.renameCity(0, ci, name)}
      onAddYear={(ci, year) => store.addCityYear(0, ci, year)}
      onRemoveYear={(ci, yi) => store.removeCityYear(0, ci, yi)}
    />
  );
}

const firstCountry = () => useEditorStore.getState().data.travel.countries[0]!;

describe('<CityTimeline> bound to the store', () => {
  beforeEach(() => {
    const data = makeDefaultData();
    // Start from a single country with one city and no years for deterministic tests.
    data.travel.countries = [
      {
        name: 'Austria',
        status: { visited: true, lived: false, birthplace: false },
        capitalVisit: { visited: false },
        timeline: { visited: [], lived: [] },
        cities: [{ name: 'Vienna', timeline: { visited: [] } }],
      },
    ];
    useEditorStore.getState().setData(data, { markClean: true });
  });

  it('adds an arbitrary past year via Enter', async () => {
    const user = userEvent.setup();
    render(<TimelineUnderTest />);
    const input = screen.getByRole('spinbutton', { name: 'Year' });
    await user.type(input, '1999{Enter}');
    expect(firstCountry().cities[0]!.timeline.visited).toEqual([1999]);
  });

  it('adds an arbitrary past year via the add button', async () => {
    const user = userEvent.setup();
    render(<TimelineUnderTest />);
    await user.type(screen.getByRole('spinbutton', { name: 'Year' }), '2003');
    await user.click(screen.getByRole('button', { name: 'Add year' }));
    expect(firstCountry().cities[0]!.timeline.visited).toEqual([2003]);
  });

  it('rejects an out-of-range year with an inline error and does not commit', async () => {
    const user = userEvent.setup();
    render(<TimelineUnderTest />);
    await user.type(screen.getByRole('spinbutton', { name: 'Year' }), '1800{Enter}');
    expect(firstCountry().cities[0]!.timeline.visited).toEqual([]);
    expect(screen.getByText(/City visit year must be/i)).toBeInTheDocument();
  });

  it('keeps the one-tap "this year" shortcut', async () => {
    const user = userEvent.setup();
    render(<TimelineUnderTest />);
    const thisYear = new Date().getFullYear();
    await user.click(screen.getByRole('button', { name: String(thisYear) }));
    expect(firstCountry().cities[0]!.timeline.visited).toEqual([thisYear]);
  });

  it('commits a rename once on blur, not per keystroke', async () => {
    const user = userEvent.setup();
    render(<TimelineUnderTest />);
    const undoDepthBefore = useEditorStore.getState().past.length;

    const field = screen.getByDisplayValue('Vienna');
    await user.clear(field);
    await user.type(field, 'Graz');
    // Mid-typing, the store still holds the original name (no per-keystroke commit).
    expect(firstCountry().cities[0]!.name).toBe('Vienna');

    await user.tab(); // blur commits
    expect(firstCountry().cities[0]!.name).toBe('Graz');
    // Exactly one new undo entry for the whole rename.
    expect(useEditorStore.getState().past.length).toBe(undoDepthBefore + 1);
  });

  it('reverts a rename on Escape without committing', async () => {
    const user = userEvent.setup();
    render(<TimelineUnderTest />);
    const field = screen.getByDisplayValue('Vienna');
    await user.clear(field);
    await user.type(field, 'Salzburg{Escape}');
    expect(firstCountry().cities[0]!.name).toBe('Vienna');
    expect(screen.getByDisplayValue('Vienna')).toBeInTheDocument();
  });

  it('reverts a blank rename instead of committing an invalid empty name', async () => {
    const user = userEvent.setup();
    render(<TimelineUnderTest />);
    const undoDepthBefore = useEditorStore.getState().past.length;

    const field = screen.getByDisplayValue('Vienna');
    await user.clear(field);
    await user.type(field, '   '); // whitespace only
    await user.tab(); // blur

    // The store keeps the original name and no undo entry is created.
    expect(firstCountry().cities[0]!.name).toBe('Vienna');
    expect(useEditorStore.getState().past.length).toBe(undoDepthBefore);
    // The field snaps back to the last good value.
    expect(screen.getByDisplayValue('Vienna')).toBeInTheDocument();
  });

  it('edits an existing year chip in place', async () => {
    const user = userEvent.setup();
    // Seed an existing year on the city.
    useEditorStore.getState().addCityYear(0, 0, 2010);
    render(<TimelineUnderTest />);

    await user.click(screen.getByRole('button', { name: 'Edit year' }));
    const editField = screen.getByRole('spinbutton', { name: 'Edit year' });
    await user.clear(editField);
    await user.type(editField, '2012{Enter}');

    expect(firstCountry().cities[0]!.timeline.visited).toEqual([2012]);
  });
});
