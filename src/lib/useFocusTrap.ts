import { useEffect, type RefObject } from 'react';

/**
 * Selector matching elements that are normally keyboard-focusable. Disabled and
 * `tabindex="-1"` elements are filtered out separately because they should not
 * participate in the Tab cycle.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'iframe',
  'object',
  'embed',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]',
  '[tabindex]',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
  return nodes.filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    // `tabindex="-1"` elements are programmatically focusable but not part of
    // the Tab order, so they must not participate in the wrap-around cycle.
    if (el.tabIndex < 0) return false;
    // Hidden subtrees should not capture focus. `hidden` and `display:none`
    // are the common cases; `getComputedStyle` is used so CSS-hidden ancestors
    // are respected in real browsers (jsdom returns empty visibility, treated
    // as visible).
    if (el.closest('[hidden]')) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  });
}

/**
 * Traps keyboard focus within a dialog container while it is open, and restores
 * focus to whatever element was focused before opening once it closes/unmounts.
 *
 * While `open` is true:
 * - Tab from the last focusable element wraps to the first.
 * - Shift+Tab from the first focusable element wraps to the last.
 * - Tab pressed while focus is outside the container pulls focus back in.
 *
 * On open the currently focused element (`document.activeElement`) is recorded,
 * and on close/unmount focus is returned to it. Initial focus placement is left
 * to the caller so that existing behavior (ConfirmDialog focusing Cancel,
 * ImportModal autoFocusing the textarea) is preserved.
 *
 * @param open       Whether the dialog is currently open.
 * @param containerRef Ref to the dialog container element (the `.modal-card`).
 */
export function useFocusTrap(
  open: boolean,
  containerRef: RefObject<HTMLElement>,
): void {
  useEffect(() => {
    if (!open) return;

    // Record the trigger element so we can restore focus on close/unmount.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;

      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        // Nothing focusable inside: keep focus pinned to the container itself.
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Restore focus to the trigger element if it is still in the document.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open, containerRef]);
}
