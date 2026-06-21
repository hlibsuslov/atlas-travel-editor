import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import type { Country, Stay, TravelData } from '@/domain/schema';
import { useEditorStore } from '@/features/editor/store';
import { DashboardPage } from './DashboardPage';

/** Minimal visited country with the given dominant status. */
function visited(name: string): Country {
  return {
    name,
    status: { visited: true, lived: false, birthplace: false },
    capitalVisit: { visited: false },
    timeline: { visited: [], lived: [] },
    cities: [],
  };
}

function loadData(countries: Country[], stays?: Stay[]): void {
  const data: TravelData = {
    person: { birthplace: { country: '' } },
    travel: { countries, ...(stays ? { stays } : {}) },
  };
  // markClean so the dashboard reads exactly this document. Wrapped in act() so
  // the Zustand subscription update is flushed inside React's commit phase.
  act(() => {
    useEditorStore.getState().setData(data, { markClean: true });
  });
}

afterEach(() => {
  // Reset the shared store between tests so counts don't leak.
  act(() => {
    useEditorStore
      .getState()
      .setData(
        { person: { birthplace: { country: '' } }, travel: { countries: [] } },
        { markClean: true },
      );
  });
});

describe('<DashboardPage> "% of the world"', () => {
  it('uses 193 UN members as the denominator and excludes Taiwan/Vatican', () => {
    // 3 UN members + Taiwan + Vatican. Only the 3 members count toward the %.
    loadData([
      visited('France'),
      visited('Japan'),
      visited('Brazil'),
      visited('Taiwan'),
      visited('Vatican City'),
    ]);
    render(<DashboardPage />);

    // The hero ring + headline both report "3 / 193", never "5 / 193".
    expect(screen.getAllByText('3 / 193').length).toBeGreaterThan(0);
    // 3 / 193 ≈ 1.55% → rounds to 2%.
    expect(screen.getByText('2%')).toBeInTheDocument();
    // The two non-members are acknowledged honestly but excluded from the %.
    expect(screen.getByText(/not counted toward the %/i)).toBeInTheDocument();
  });

  it('reports 0 / 193 with no visited UN members', () => {
    loadData([visited('Taiwan')]);
    render(<DashboardPage />);
    expect(screen.getAllByText('0 / 193').length).toBeGreaterThan(0);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows continent coverage as visited / UN-member denominator', () => {
    loadData([visited('France'), visited('Germany')]);
    render(<DashboardPage />);
    // Europe has 43 UN members; two visited → "2 / 43 · 100%" in one row.
    const byContinent = screen.getByRole('heading', { name: /by continent/i }).closest('.panel')!;
    const frac = within(byContinent as HTMLElement).getByText(/2\s*\/\s*43/);
    expect(frac).toBeInTheDocument();
  });
});

describe('<DashboardPage> "Travel spend"', () => {
  it('shows the spend section, per-currency total and a top stay when stays exist', () => {
    loadData(
      [visited('France')],
      [
        {
          name: 'Hotel Lumière',
          country: 'France',
          from: '2024-05-01',
          to: '2024-05-04',
          // 1240.00 EUR stored as integer minor units (cents).
          cost: { amount: 124000, currency: 'EUR' },
        },
      ],
    );
    render(<DashboardPage />);

    const spend = screen.getByRole('heading', { name: /travel spend/i }).closest('.panel')!;
    // Honest per-currency money string is formatted via Intl (no float storage).
    expect(within(spend as HTMLElement).getAllByText(/1,240\.00/).length).toBeGreaterThan(0);
    // The stay surfaces in the top-stays mini-list.
    expect(within(spend as HTMLElement).getByText('Hotel Lumière')).toBeInTheDocument();
  });

  it('hides the spend section entirely when there are no stays', () => {
    loadData([visited('France')]);
    render(<DashboardPage />);
    expect(screen.queryByRole('heading', { name: /travel spend/i })).not.toBeInTheDocument();
  });
});
