import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CountryPanel } from './CountryPanel';
import { useEditorStore } from '@/features/editor/store';
import { makeDefaultData } from '@/domain/normalize';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const country = (name: string) =>
  useEditorStore.getState().data.travel.countries.find((c) => c.name === name);

function renderPanel(onClose = vi.fn(), onSetStatus = vi.fn()) {
  render(
    <MemoryRouter>
      <CountryPanel name="Portugal" onClose={onClose} onSetStatus={onSetStatus} />
    </MemoryRouter>,
  );
  return { onClose, onSetStatus };
}

describe('<CountryPanel>', () => {
  beforeEach(() => {
    useEditorStore.getState().setData(makeDefaultData(), { markClean: true });
    vi.clearAllMocks();
  });

  it('is a labelled dialog and moves focus to the country name', () => {
    renderPanel();
    const dialog = screen.getByRole('dialog', { name: 'Portugal' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Portugal' })).toHaveFocus();
  });

  it('closes on Escape and from the close button', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('sets the status through the radio group', async () => {
    const user = userEvent.setup();
    const { onSetStatus } = renderPanel();
    const group = screen.getByRole('radiogroup', { name: 'Status' });
    expect(within(group).getByRole('radio', { name: 'Not yet' })).toBeChecked();
    await user.click(within(group).getByRole('radio', { name: 'Lived' }));
    expect(onSetStatus).toHaveBeenCalledWith('Portugal', 'lived');
  });

  it('logs repeat visits with cities from the keyboard and lists them in order', async () => {
    const user = userEvent.setup();
    renderPanel();

    const year = screen.getByRole('spinbutton', { name: 'Year' });
    const cities = screen.getByRole('combobox', { name: 'Cities' });

    await user.clear(year);
    await user.type(year, '2023');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Month (optional)' }), '9');
    await user.type(cities, 'Lisbon, Madeira{Enter}');

    await user.clear(year);
    await user.type(year, '2016');
    await user.type(cities, 'lisbon{Enter}');

    const pt = country('Portugal')!;
    expect(pt.status.visited).toBe(true);
    expect(pt.timeline.visited).toEqual(['2023-09', '2016']);
    expect(pt.cities).toEqual([
      { name: 'Lisbon', timeline: { visited: [2016, 2023] } },
      { name: 'Madeira', timeline: { visited: [2023] } },
    ]);

    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('2016'),
      expect.stringContaining('September 2023'),
    ]);
    expect(rows[1]).toHaveTextContent('Lisbon, Madeira');
  });

  it('rejects an out-of-range year without touching the document', async () => {
    const user = userEvent.setup();
    renderPanel();
    const year = screen.getByRole('spinbutton', { name: 'Year' });
    await user.clear(year);
    await user.type(year, '1200{Enter}');
    expect(year).toHaveAttribute('aria-invalid', 'true');
    expect(country('Portugal')).toBeUndefined();
  });
});
