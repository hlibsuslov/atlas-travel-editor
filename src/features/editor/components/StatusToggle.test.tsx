import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusToggle } from './StatusToggle';

describe('<StatusToggle>', () => {
  it('renders the label text', () => {
    render(<StatusToggle label="Visited" on={false} status="visited" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Visited' })).toBeInTheDocument();
  });

  it('exposes aria-pressed=true when on', () => {
    render(<StatusToggle label="Lived" on status="lived" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Lived' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('exposes aria-pressed=false when off', () => {
    render(<StatusToggle label="Lived" on={false} status="lived" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Lived' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('fires onClick when activated', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<StatusToggle label="Birthplace" on={false} status="birthplace" onClick={onClick} />);
    await user.click(screen.getByRole('button', { name: 'Birthplace' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
