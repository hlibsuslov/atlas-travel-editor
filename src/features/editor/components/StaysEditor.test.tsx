import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaysEditor } from './StaysEditor';
import { useEditorStore } from '@/features/editor/store';
import { makeDefaultData } from '@/domain/normalize';

const stays = () => useEditorStore.getState().data.travel.stays;

describe('<StaysEditor> bound to the store', () => {
  beforeEach(() => {
    useEditorStore.getState().setData(makeDefaultData(), { markClean: true });
  });

  it('adds a stay by name', async () => {
    const user = userEvent.setup();
    render(<StaysEditor />);
    await user.type(screen.getByPlaceholderText('Hotel / place name'), 'Hotel Sacher');
    await user.click(screen.getByRole('button', { name: 'Add stay' }));
    expect(stays()).toHaveLength(1);
    expect(stays()![0]).toEqual({ name: 'Hotel Sacher' });
  });

  it('edits the cost into integer minor units on blur ("42.50" → 4250)', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().addStay({ name: 'Hotel Sacher' });
    render(<StaysEditor />);

    await user.type(screen.getByLabelText('Cost'), '42.50');
    // A 3-letter manual code commits the currency alongside the amount.
    const code = screen.getByLabelText('Currency code');
    await user.clear(code);
    await user.type(code, 'EUR');
    await user.tab(); // blur commits

    expect(stays()![0]!.cost).toEqual({ amount: 4250, currency: 'EUR' });
  });

  it('omits optional fields that are left empty', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().addStay({ name: 'Just a name' });
    render(<StaysEditor />);

    // Touch the city field but leave it blank, then blur to force a commit.
    const city = screen.getByLabelText('City');
    await user.click(city);
    await user.tab();

    const stay = stays()![0]!;
    expect(stay).toEqual({ name: 'Just a name' });
    expect('country' in stay).toBe(false);
    expect('city' in stay).toBe(false);
    expect('from' in stay).toBe(false);
    expect('to' in stay).toBe(false);
    expect('cost' in stay).toBe(false);
    expect('note' in stay).toBe(false);
  });

  it('removes a stay', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().addStay({ name: 'To be removed' });
    render(<StaysEditor />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    // The optional key is dropped entirely once the diary is empty (legacy-slim).
    expect('stays' in useEditorStore.getState().data.travel).toBe(false);
  });

  it('shows the running total grouped by currency', () => {
    useEditorStore.getState().addStay({ name: 'A', cost: { amount: 10000, currency: 'EUR' } });
    useEditorStore.getState().addStay({ name: 'B', cost: { amount: 5000, currency: 'EUR' } });
    useEditorStore.getState().addStay({ name: 'C', cost: { amount: 2000, currency: 'USD' } });
    render(<StaysEditor />);

    const totals = screen.getByText('Total').parentElement!;
    // EUR 100 + 50 = 150, USD = 20; both shown, never summed across currencies.
    expect(within(totals).getByText(/150/)).toBeInTheDocument();
    expect(within(totals).getByText(/20/)).toBeInTheDocument();
  });

  it('computes nights when both dates are set', () => {
    useEditorStore
      .getState()
      .addStay({ name: 'Two nighter', from: '2023-01-01', to: '2023-01-03' });
    render(<StaysEditor />);
    expect(screen.getByText(/2 nights/)).toBeInTheDocument();
  });

  it('commits a single undo step per edited field (commit-on-blur)', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().addStay({ name: 'Place' });
    render(<StaysEditor />);

    const depthBefore = useEditorStore.getState().past.length;
    const note = screen.getByLabelText('Note (optional)');
    await user.type(note, 'Lovely view');
    // Mid-typing, nothing is committed yet (no per-keystroke undo entries).
    expect(useEditorStore.getState().past.length).toBe(depthBefore);

    await user.tab(); // blur commits exactly one step
    expect(stays()![0]!.note).toBe('Lovely view');
    expect(useEditorStore.getState().past.length).toBe(depthBefore + 1);
  });
});
