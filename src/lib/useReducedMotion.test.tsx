import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useReducedMotion } from './useReducedMotion';

/**
 * Minimal `MediaQueryList` mock that records its listeners and can dispatch a
 * synthetic `change` event so tests can simulate the OS preference flipping.
 */
function createMatchMediaMock(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = {
    matches: initialMatches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    // Helper to drive a change from the test.
    _emit(matches: boolean) {
      mql.matches = matches;
      for (const listener of listeners) {
        listener({ matches } as MediaQueryListEvent);
      }
    },
    _listenerCount() {
      return listeners.size;
    },
  };
  const matchMedia = vi.fn(() => mql as unknown as MediaQueryList);
  return { matchMedia, mql };
}

/** Test harness rendering the hook's boolean value as text. */
function Harness() {
  const reduced = useReducedMotion();
  return <span data-testid="value">{reduced ? 'reduced' : 'full'}</span>;
}

afterEach(() => {
  vi.restoreAllMocks();
  // Remove any matchMedia override so tests are isolated.
  // @ts-expect-error -- allow deleting the optional property for cleanup.
  delete window.matchMedia;
});

describe('useReducedMotion', () => {
  it('returns the matched value initially', () => {
    const { matchMedia } = createMatchMediaMock(true);
    window.matchMedia = matchMedia;

    render(<Harness />);

    expect(screen.getByTestId('value')).toHaveTextContent('reduced');
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('returns false when no preference is matched', () => {
    const { matchMedia } = createMatchMediaMock(false);
    window.matchMedia = matchMedia;

    render(<Harness />);

    expect(screen.getByTestId('value')).toHaveTextContent('full');
  });

  it('updates when the media query change event fires', () => {
    const { matchMedia, mql } = createMatchMediaMock(false);
    window.matchMedia = matchMedia;

    render(<Harness />);
    expect(screen.getByTestId('value')).toHaveTextContent('full');

    act(() => mql._emit(true));
    expect(screen.getByTestId('value')).toHaveTextContent('reduced');

    act(() => mql._emit(false));
    expect(screen.getByTestId('value')).toHaveTextContent('full');
  });

  it('removes the listener on unmount', () => {
    const { matchMedia, mql } = createMatchMediaMock(false);
    window.matchMedia = matchMedia;

    const { unmount } = render(<Harness />);
    expect(mql._listenerCount()).toBe(1);

    unmount();
    expect(mql._listenerCount()).toBe(0);
    expect(mql.removeEventListener).toHaveBeenCalled();
  });

  it('returns false when window.matchMedia is unavailable', () => {
    // @ts-expect-error -- simulate an environment without matchMedia.
    delete window.matchMedia;

    render(<Harness />);

    expect(screen.getByTestId('value')).toHaveTextContent('full');
  });

  it('supports the legacy addListener/removeListener API', () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mql = {
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      }),
      removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      }),
    };
    window.matchMedia = vi.fn(() => mql as unknown as MediaQueryList);

    const { unmount } = render(<Harness />);
    expect(mql.addListener).toHaveBeenCalled();
    expect(listeners.size).toBe(1);

    // Drive a change through the legacy listener.
    act(() => {
      mql.matches = true;
      for (const listener of listeners) {
        listener({ matches: true } as MediaQueryListEvent);
      }
    });
    expect(screen.getByTestId('value')).toHaveTextContent('reduced');

    unmount();
    expect(mql.removeListener).toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });
});
