import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './Switch';

describe('<Switch>', () => {
  it('is queryable by its accessible name and exposes the switch role', () => {
    render(<Switch label="Public map" checked={false} onChange={vi.fn()} />);
    const control = screen.getByRole('switch', { name: 'Public map' });
    expect(control).toBeInTheDocument();
  });

  it('reflects aria-checked matching the checked prop', () => {
    const { rerender } = render(<Switch label="Public map" checked={false} onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: 'Public map' })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    rerender(<Switch label="Public map" checked={true} onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: 'Public map' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('calls onChange with the new boolean when toggled on', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Public map" checked={false} onChange={onChange} />);
    await user.click(screen.getByRole('switch', { name: 'Public map' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with the new boolean when toggled off', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Public map" checked={true} onChange={onChange} />);
    await user.click(screen.getByRole('switch', { name: 'Public map' }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('toggles via native keyboard support', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Public map" checked={false} onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'Public map' });
    control.focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
