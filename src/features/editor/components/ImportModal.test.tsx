import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportModal } from './ImportModal';
import { useEditorStore } from '@/features/editor/store';
import { makeDefaultData } from '@/domain/normalize';
import { wrapEnvelope } from '@/lib/storage/envelope';

describe('<ImportModal> restyled flows', () => {
  beforeEach(() => {
    useEditorStore.getState().setData(makeDefaultData(), { markClean: true });
  });

  it('shows an awaiting hint before anything is pasted (empty state)', () => {
    render(<ImportModal open onClose={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByText(/drop or paste a file to preview/i)).toBeInTheDocument();
  });

  it('surfaces a parse error for malformed JSON and keeps Load disabled', async () => {
    const user = userEvent.setup();
    render(<ImportModal open onClose={vi.fn()} onImport={vi.fn()} />);
    await user.click(screen.getByLabelText('Paste JSON'));
    await user.paste('{ not json');
    // The bad-JSON pill appears ("Invalid JSON: …")...
    expect(await screen.findByText(/invalid json/i)).toBeInTheDocument();
    // ...and the primary Load action stays disabled.
    expect(screen.getByRole('button', { name: 'Load' })).toBeDisabled();
  });

  it('replaces the document with a valid imported envelope', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(<ImportModal open onClose={vi.fn()} onImport={onImport} />);

    const data = makeDefaultData();
    data.travel.countries = [
      {
        name: 'Japan',
        status: { visited: true, lived: false, birthplace: false },
        capitalVisit: { visited: false },
        timeline: { visited: [], lived: [] },
        cities: [],
      },
    ];
    // Paste the serialized envelope rather than typing it char-by-char.
    const textarea = screen.getByLabelText('Paste JSON');
    await user.click(textarea);
    await user.paste(JSON.stringify(wrapEnvelope(data)));

    const load = screen.getByRole('button', { name: 'Load' });
    expect(load).toBeEnabled();
    await user.click(load);
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0]![0].travel.countries[0].name).toBe('Japan');
  });

  it('offers explanatory Replace / Merge choices that are toggleable', async () => {
    const user = userEvent.setup();
    render(<ImportModal open onClose={vi.fn()} onImport={vi.fn()} />);
    const replace = screen.getByRole('button', { name: /Replace/i });
    const merge = screen.getByRole('button', { name: /Merge/i });
    // Replace is the default.
    expect(replace).toHaveAttribute('aria-pressed', 'true');
    expect(merge).toHaveAttribute('aria-pressed', 'false');
    await user.click(merge);
    expect(merge).toHaveAttribute('aria-pressed', 'true');
    expect(replace).toHaveAttribute('aria-pressed', 'false');
  });

  it('merges a pasted country list into the current document', async () => {
    const user = userEvent.setup();
    render(<ImportModal open onClose={vi.fn()} onImport={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: 'Paste list' }));
    await user.click(screen.getByLabelText('Paste list'));
    await user.paste('Japan: Tokyo 2023\nFrance');
    // Summary pill reports two resolved countries.
    expect(screen.getByText(/2 resolved/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    const names = useEditorStore.getState().data.travel.countries.map((c) => c.name);
    expect(names).toContain('Japan');
    expect(names).toContain('France');
  });
});
