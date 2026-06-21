import type { StatusChoice } from './WorldMap';
import type { MapStatus } from './countryMatch';

/**
 * The active "status brush" the user paints countries with. Selecting a brush
 * makes a single click on a country APPLY that status directly — no hidden
 * modifier. `cycle` is the historical default (click cycles
 * none → visited → lived → none); `erase` clears a country to `none`.
 *
 * Each non-`cycle`/`erase` value matches a {@link StatusChoice} so the page can
 * forward it straight to the store, but they're modelled here as a distinct type
 * (with `cycle`) so the toolbar logic stays a pure, testable unit.
 */
export type Brush = 'cycle' | 'visited' | 'lived' | 'capital' | 'birthplace' | 'erase';

/** Brushes shown in the toolbar segmented control, left to right. */
export const BRUSHES: readonly Brush[] = [
  'cycle',
  'visited',
  'lived',
  'capital',
  'birthplace',
  'erase',
];

/** The status dot colour for a brush, or `null` for brushes with no single colour. */
export function brushSwatch(brush: Brush): MapStatus | null {
  switch (brush) {
    case 'visited':
    case 'lived':
    case 'capital':
    case 'birthplace':
      return brush;
    case 'erase':
      return 'none';
    case 'cycle':
      return null;
  }
}

/**
 * Resolve a click on a country whose current status is `current` under the
 * active `brush` into the {@link StatusChoice} to apply — the single source of
 * truth for "what does clicking do right now?".
 *
 * - `cycle` keeps the legacy behaviour: none → visited → lived → none. (Capital
 *   and birthplace are not part of the cycle; clicking a capital/birthplace
 *   country in cycle mode starts a fresh none → visited → … run.)
 * - `erase` always clears to `none`.
 * - Any explicit brush re-applies that status. Painting the SAME status a
 *   country already has toggles it off (clears), so a mistaken paint is one
 *   click to undo — marking still feels direct without trapping the user.
 */
export function resolveBrushClick(brush: Brush, current: MapStatus): StatusChoice {
  if (brush === 'erase') return 'none';
  if (brush === 'cycle') {
    if (current === 'visited') return 'lived';
    if (current === 'lived') return 'none';
    // none / capital / birthplace → start the visited→lived→none run.
    return 'visited';
  }
  // Explicit brush: toggle off if it's already exactly that status, else apply.
  return current === brush ? 'none' : brush;
}
