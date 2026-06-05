import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFocusTrap } from './useFocusTrap';

/**
 * Test harness: a button that opens a dialog. The dialog adopts the focus trap
 * on its container and can be closed, exercising both the Tab wrapping and the
 * focus-restoration behaviors of the hook.
 */
function Harness() {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, cardRef);

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <button type="button">Outside</button>
      {open && (
        <div ref={cardRef}>
          <button type="button">First</button>
          <button type="button">Middle</button>
          <button type="button" onClick={() => setOpen(false)}>
            Last
          </button>
        </div>
      )}
    </div>
  );
}

describe('useFocusTrap', () => {
  it('wraps Tab from the last focusable element to the first', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    screen.getByRole('button', { name: 'Last' }).focus();
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('wraps Shift+Tab from the first focusable element to the last', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    screen.getByRole('button', { name: 'First' }).focus();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  it('keeps Tab focus inside the dialog between interior elements', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    screen.getByRole('button', { name: 'First' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Middle' })).toHaveFocus();
  });

  it('restores focus to the trigger element when the dialog closes', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);
    // The trigger was the active element when the trap opened.
    await user.click(screen.getByRole('button', { name: 'Last' }));

    expect(trigger).toHaveFocus();
  });
});
