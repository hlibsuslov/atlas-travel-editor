import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportMenu } from './ExportMenu';
import { StorageProvider } from '@/features/storage/StorageProvider';
import { makeDefaultData } from '@/domain/normalize';

// The menu only reads the registry's static store list; toasts are noise here.
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

function renderMenu() {
  return render(
    <StorageProvider>
      <ExportMenu data={makeDefaultData()} />
    </StorageProvider>,
  );
}

describe('<ExportMenu> honest storage destinations', () => {
  it('opens a shared .atlas-pop menu from the toolbar button', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /export|save|сохран/i }));
    const menu = screen.getByRole('menu');
    expect(menu).toHaveClass('atlas-pop');
  });

  it('groups destinations into on-device vs server/cloud with honest copy', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /export|save|сохран/i }));

    // The local group is labelled and the device/file destinations are described.
    expect(screen.getByText('On this device')).toBeInTheDocument();
    expect(screen.getByText('Sync to a server / cloud')).toBeInTheDocument();
    // Honest local-first footnote.
    expect(screen.getByText(/local-first/i)).toBeInTheDocument();
  });

  it('marks the active (default IndexedDB) destination as checked', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /export|save|сохран/i }));
    const checked = screen.getAllByRole('menuitemradio', { checked: true });
    // Exactly one destination is active at a time.
    expect(checked).toHaveLength(1);
  });

  it('keeps one-off copy / download export actions', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: /export|save|сохран/i }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /download/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /copy/i })).toBeInTheDocument();
  });
});
