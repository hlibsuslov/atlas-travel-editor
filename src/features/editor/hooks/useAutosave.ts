import { useEffect, useRef } from 'react';
import type { TravelData } from '@/domain/schema';

interface AutosaveArgs {
  /** The current working document. Changes re-arm the debounce timer. */
  data: TravelData;
  /** Whether there are unsaved local changes. */
  dirty: boolean;
  /** Gate: only autosave when it's safe to (e.g. valid + online). */
  canSave: boolean;
  /** Debounce window in ms after the last edit before saving. */
  delayMs?: number;
  /** Persist the document. */
  onSave: (data: TravelData) => void;
}

/**
 * Debounced autosave. While the document is dirty and saving is allowed, it
 * persists the latest document `delayMs` after the user stops editing. It also
 * flushes a pending save when the tab is hidden or closed, so changes aren't
 * lost on navigation. Manual saving stays available as an explicit fallback.
 */
export function useAutosave({ data, dirty, canSave, delayMs = 1500, onSave }: AutosaveArgs) {
  // Keep the latest values in refs so the page-hide listener (registered once)
  // always flushes the current document without re-subscribing on every edit.
  const latest = useRef({ data, dirty, canSave, onSave });
  latest.current = { data, dirty, canSave, onSave };

  // Debounced save after edits settle.
  useEffect(() => {
    if (!dirty || !canSave) return;
    const id = window.setTimeout(() => onSave(data), delayMs);
    return () => window.clearTimeout(id);
    // `onSave` is intentionally excluded — it's read fresh from the closure and
    // is stable enough; including it would reset the timer on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dirty, canSave, delayMs]);

  // Flush on tab hide / close so navigating away doesn't drop pending edits.
  useEffect(() => {
    const flush = () => {
      const { data: d, dirty: dy, canSave: cs, onSave: save } = latest.current;
      if (dy && cs) save(d);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
