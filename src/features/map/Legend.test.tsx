import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Legend } from './Legend';

describe('<Legend>', () => {
  it('exposes the legend as an accessible list with a name', () => {
    render(<Legend />);
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('aria-label', 'Map legend');
  });

  it('renders the four status items as listitems', () => {
    render(<Legend />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(screen.getByText('Birthplace')).toBeInTheDocument();
    expect(screen.getByText('Lived')).toBeInTheDocument();
    expect(screen.getByText('Visited')).toBeInTheDocument();
    expect(screen.getByText('Capital only')).toBeInTheDocument();
  });

  it('marks the decorative colour swatches as hidden from assistive tech', () => {
    const { container } = render(<Legend />);
    const swatches = container.querySelectorAll('.legend-sw');
    expect(swatches).toHaveLength(4);
    swatches.forEach((sw) => {
      expect(sw).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('omits counts when none are provided', () => {
    render(<Legend />);
    const items = screen.getAllByRole('listitem');
    items.forEach((item) => {
      expect(item.querySelector('.mono')).toBeNull();
    });
  });

  it('exposes counts as part of each item accessible text when provided', () => {
    render(<Legend counts={{ birthplace: 1, lived: 2, visited: 3, capital: 0 }} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);

    const byLabel = (label: string) => items.find((item) => within(item).queryByText(label))!;

    expect(byLabel('Birthplace')).toHaveTextContent('1');
    expect(byLabel('Lived')).toHaveTextContent('2');
    expect(byLabel('Visited')).toHaveTextContent('3');
    expect(byLabel('Capital only')).toHaveTextContent('0');
  });

  it('gives each item an accessible name of the localized status label when no counts', () => {
    render(<Legend />);
    // Screen readers should announce the status label, not the decorative swatch.
    expect(screen.getByRole('listitem', { name: 'Birthplace' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Lived' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Visited' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Capital only' })).toBeInTheDocument();
  });

  it('includes the count in each item accessible name when counts are provided', () => {
    render(<Legend counts={{ birthplace: 1, lived: 2, visited: 12, capital: 0 }} />);
    // e.g. a screen reader announces "Visited, 12" rather than just the label.
    expect(screen.getByRole('listitem', { name: 'Birthplace, 1' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Lived, 2' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Visited, 12' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Capital only, 0' })).toBeInTheDocument();
  });
});
