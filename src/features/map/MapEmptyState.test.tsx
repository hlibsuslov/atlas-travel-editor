import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapEmptyState } from './MapEmptyState';
import { computeStats } from '@/domain/stats';
import type { TravelData } from '@/domain/schema';

const HEADING = 'Your map is empty';
const HINT = /Click a country to mark it/i;

const emptyData: TravelData = {
  person: { birthplace: { country: '' } },
  travel: { countries: [] },
};

const markedData: TravelData = {
  person: { birthplace: { country: '' } },
  travel: {
    countries: [
      {
        name: 'France',
        status: { visited: true, lived: false, birthplace: false },
        capitalVisit: { visited: false },
        timeline: { visited: [], lived: [] },
        cities: [],
      },
    ],
  },
};

describe('<MapEmptyState>', () => {
  it('renders the heading and hint text', () => {
    render(<MapEmptyState />);
    expect(screen.getByText(HEADING)).toBeInTheDocument();
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it('uses the Atlas .panel / .empty-note design language', () => {
    const { container } = render(<MapEmptyState />);
    expect(container.querySelector('.panel')).toBeInTheDocument();
    expect(container.querySelector('.empty-note')).toBeInTheDocument();
  });

  it('is store-independent and renders no action when onImport is omitted', () => {
    render(<MapEmptyState />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders an import action that calls onImport when provided', async () => {
    const onImport = vi.fn();
    render(<MapEmptyState onImport={onImport} />);
    await userEvent.click(screen.getByRole('button', { name: 'Import data' }));
    expect(onImport).toHaveBeenCalledTimes(1);
  });
});

// The MapPage gates the empty state on `computeStats(data).traveled === 0`.
// Exercising that exact predicate keeps the test fast (no heavy WorldMap render)
// while verifying the empty state appears for empty data and is gone once a
// country is marked.
describe('MapEmptyState visibility predicate (computeStats traveled === 0)', () => {
  function MapEmptyStateGate({ data }: { data: TravelData }) {
    return computeStats(data).traveled === 0 ? <MapEmptyState /> : null;
  }

  it('appears for default-empty data (no countries marked)', () => {
    render(<MapEmptyStateGate data={emptyData} />);
    expect(screen.getByText(HEADING)).toBeInTheDocument();
  });

  it('is absent once a country is marked', () => {
    render(<MapEmptyStateGate data={markedData} />);
    expect(screen.queryByText(HEADING)).toBeNull();
  });
});
