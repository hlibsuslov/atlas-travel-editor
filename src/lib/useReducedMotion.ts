import { useEffect, useState } from 'react';

/** Media query string matching the user's reduced-motion preference. */
const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Reads the current value of the reduced-motion media query in an
 * SSR/jsdom-safe way. Returns `false` when `window.matchMedia` is unavailable
 * (e.g. server rendering or environments without the API).
 */
function getInitialPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(QUERY).matches;
}

/**
 * Subscribes to the user's `prefers-reduced-motion: reduce` setting and returns
 * whether motion should be reduced.
 *
 * The hook keeps its value in sync by listening for `change` events on the
 * media query list, and removes the listener on unmount. It supports both the
 * modern `addEventListener`/`removeEventListener` API and the legacy
 * `addListener`/`removeListener` API (Safari < 14). When `window.matchMedia`
 * is missing — such as during server-side rendering — it returns `false` and
 * does not attempt to subscribe.
 *
 * @returns `true` when the user prefers reduced motion, otherwise `false`.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(getInitialPreference);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mql = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };

    // Sync immediately in case the value changed between the initial render and
    // this effect running.
    setReduced(mql.matches);

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }

    // Legacy API (Safari < 14, older environments).
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return reduced;
}
