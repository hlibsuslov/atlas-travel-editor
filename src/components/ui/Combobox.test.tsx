import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox, type ComboboxOption } from './Combobox';

const OPTIONS: ComboboxOption[] = [
  { value: 'de', label: 'Germany' },
  { value: 'fr', label: 'France' },
  { value: 'it', label: 'Italy' },
];

function renderCombobox(overrides: Partial<Parameters<typeof Combobox>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <Combobox value="" options={OPTIONS} onChange={onChange} ariaLabel="Country" {...overrides} />,
  );
  return { onChange };
}

describe('<Combobox>', () => {
  it('exposes combobox semantics on the search input once open', async () => {
    const user = userEvent.setup();
    renderCombobox();
    await user.click(screen.getByRole('button', { name: 'Country' }));

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');

    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('id');
    expect(input).toHaveAttribute('aria-controls', listbox.getAttribute('id'));
  });

  it('gives each option a stable unique id', async () => {
    const user = userEvent.setup();
    renderCombobox();
    await user.click(screen.getByRole('button', { name: 'Country' }));

    const ids = screen.getAllByRole('option').map((o) => o.getAttribute('id'));
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points aria-activedescendant at the active option as the user arrows down', async () => {
    const user = userEvent.setup();
    renderCombobox();
    await user.click(screen.getByRole('button', { name: 'Country' }));

    const input = screen.getByRole('combobox');
    const idOf = (index: number) => screen.getAllByRole('option')[index]?.getAttribute('id');

    // First option is active on open.
    expect(input).toHaveAttribute('aria-activedescendant', idOf(0));

    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', idOf(1));

    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', idOf(2));

    await user.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', idOf(1));
  });

  it('selects the active option with Enter and fires onChange', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCombobox();
    await user.click(screen.getByRole('button', { name: 'Country' }));

    await user.keyboard('{ArrowDown}'); // move to France
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('fr');
    // Closing the popover removes the listbox.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selects an option with the mouse and fires onChange', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCombobox();
    await user.click(screen.getByRole('button', { name: 'Country' }));

    await user.click(screen.getByRole('option', { name: 'Italy' }));
    expect(onChange).toHaveBeenCalledWith('it');
  });

  it('closes on Escape without selecting', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCombobox();
    await user.click(screen.getByRole('button', { name: 'Country' }));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps existing ARIA on the trigger and options intact', async () => {
    const user = userEvent.setup();
    renderCombobox({ value: 'fr' });

    const trigger = screen.getByRole('button', { name: 'Country' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(screen.getByRole('option', { name: 'France' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Germany' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });
});
