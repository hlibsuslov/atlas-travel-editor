import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the persistence hook so the component renders without a QueryClient/Auth
// provider — we only assert how a given state maps to label + pill variant here.
const mockStatus = vi.hoisted(() => ({ value: { state: 'synced', invalid: false } as const }));
vi.mock('@/lib/persistence/useDataSync', () => ({
  useSaveStatus: () => mockStatus.value,
}));

const { SaveStatus } = await import('./SaveStatus');

describe('<SaveStatus>', () => {
  it('renders the auto-detected global state when no prop is given', () => {
    render(<SaveStatus />);
    const pill = screen.getByRole('status');
    expect(pill).toHaveTextContent('Saved');
    expect(pill).toHaveClass('pill', 'pill-ok');
    expect(pill).toHaveAttribute('aria-live', 'polite');
  });

  it('maps each explicit state to its label and pill variant', () => {
    const cases = [
      { state: 'saving', label: 'Saving…', variant: 'pill-warn' },
      { state: 'unsaved', label: 'Unsaved', variant: 'pill-warn' },
      { state: 'synced', label: 'Saved', variant: 'pill-ok' },
      { state: 'offline', label: 'Offline (cached)', variant: 'pill-bad' },
    ] as const;

    for (const c of cases) {
      const { unmount } = render(<SaveStatus state={c.state} />);
      const pill = screen.getByRole('status');
      expect(pill).toHaveTextContent(c.label);
      expect(pill).toHaveClass(c.variant);
      unmount();
    }
  });

  it('an explicit state prop overrides the auto-detected one', () => {
    // Global state is "synced" (mock), but the caller forces "saving".
    render(<SaveStatus state="saving" />);
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');
  });
});
