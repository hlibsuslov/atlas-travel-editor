import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { CountryCard } from './CountryCard';
import { useEditorStore } from '@/features/editor/store';
import { makeDefaultData } from '@/domain/normalize';
import { CURRENT_YEAR } from '@/domain/constants';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function CardUnderTest() {
  const country = useEditorStore((s) => s.data.travel.countries[0]!);
  return <CountryCard country={country} index={0} invalid={false} defaultOpen />;
}

/** Collapsed variant — the quick-actualize button only shows on a closed header. */
function CollapsedCardUnderTest() {
  const country = useEditorStore((s) => s.data.travel.countries[0]!);
  return <CountryCard country={country} index={0} invalid={false} />;
}

describe('<CountryCard> bound to the store', () => {
  beforeEach(() => {
    useEditorStore.getState().setData(makeDefaultData(), { markClean: true });
    vi.clearAllMocks();
  });

  it('edits the country name through the country picker', async () => {
    const user = userEvent.setup();
    render(<CardUnderTest />);
    await user.click(screen.getByLabelText('Country name')); // open the combobox
    await user.type(screen.getByPlaceholderText('Search countries…'), 'German');
    await user.click(screen.getByRole('option', { name: 'Germany' }));
    expect(useEditorStore.getState().data.travel.countries[0]!.name).toBe('Germany');
  });

  it('toggles a status through the store', async () => {
    const user = userEvent.setup();
    render(<CardUnderTest />);
    expect(useEditorStore.getState().data.travel.countries[0]!.status.lived).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Lived' }));
    expect(useEditorStore.getState().data.travel.countries[0]!.status.lived).toBe(false);
  });

  it('adds a city', async () => {
    const user = userEvent.setup();
    render(<CardUnderTest />);
    await user.type(screen.getByPlaceholderText('City name'), 'Vienna');
    await user.click(screen.getByRole('button', { name: 'Add city' }));
    const cities = useEditorStore.getState().data.travel.countries[0]!.cities;
    expect(cities[0]).toEqual({ name: 'Vienna', timeline: { visited: [] } });
  });

  it('quick-actualizes the current year from the collapsed header', async () => {
    const user = userEvent.setup();
    render(<CollapsedCardUnderTest />);
    await user.click(
      screen.getByRole('button', {
        name: `Record a visit this year (${CURRENT_YEAR})`,
      }),
    );
    const country = useEditorStore.getState().data.travel.countries[0]!;
    expect(country.status.visited).toBe(true);
    expect(country.timeline.visited).toContain(String(CURRENT_YEAR));
    expect(toast.success).toHaveBeenCalledWith(`Recorded Ukraine ${CURRENT_YEAR}`);
  });

  it('does not show the quick-actualize button when the card is open', () => {
    render(<CardUnderTest />);
    expect(
      screen.queryByRole('button', { name: `Record a visit this year (${CURRENT_YEAR})` }),
    ).toBeNull();
  });
});
