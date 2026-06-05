import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CountryCard } from './CountryCard';
import { useEditorStore } from '@/features/editor/store';
import { makeDefaultData } from '@/domain/normalize';

function CardUnderTest() {
  const country = useEditorStore((s) => s.data.travel.countries[0]!);
  return <CountryCard country={country} index={0} invalid={false} defaultOpen />;
}

describe('<CountryCard> bound to the store', () => {
  beforeEach(() => {
    useEditorStore.getState().setData(makeDefaultData(), { markClean: true });
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
    await user.click(screen.getByRole('button', { name: 'Lived' }));
    expect(useEditorStore.getState().data.travel.countries[0]!.status.lived).toBe(true);
  });

  it('adds a city', async () => {
    const user = userEvent.setup();
    render(<CardUnderTest />);
    await user.type(screen.getByPlaceholderText('City name'), 'Vienna');
    await user.click(screen.getByRole('button', { name: 'Add city' }));
    const cities = useEditorStore.getState().data.travel.countries[0]!.cities;
    expect(cities[0]).toEqual({ name: 'Vienna', timeline: { visited: [] } });
  });
});
