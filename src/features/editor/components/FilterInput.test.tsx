import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterInput } from './FilterInput';

function Harness({ initial = '', onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <FilterInput
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
      ariaLabel="Filter"
    />
  );
}

describe('<FilterInput>', () => {
  it('hides the clear button when the value is empty', () => {
    render(<FilterInput value="" onChange={vi.fn()} ariaLabel="Filter" />);
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('shows the clear button when the value is non-empty', () => {
    render(<FilterInput value="spain" onChange={vi.fn()} ariaLabel="Filter" />);
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('exposes an accessible name on the clear button', () => {
    render(<FilterInput value="spain" onChange={vi.fn()} ariaLabel="Filter" />);
    expect(screen.getByRole('button', { name: 'Clear' })).toHaveAccessibleName('Clear');
  });

  it('clears the value when the clear button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="spain" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(screen.getByRole('textbox', { name: 'Filter' })).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('clears the value via keyboard activation of the clear button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="spain" onChange={onChange} />);
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Clear' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('clears the value when Escape is pressed in the input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="spain" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Filter' });
    input.focus();
    await user.keyboard('{Escape}');
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(input).toHaveValue('');
  });
});
