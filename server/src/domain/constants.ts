/**
 * Domain constants — the bounds and formats that define a valid travel record.
 * Kept separate so they can be reused by validators, UI hints, and DB checks.
 */

/** Earliest year we accept for any travel/birth event. */
export const MIN_YEAR = 1900;
/** Latest year we accept. Generous upper bound to allow near-future plans. */
export const MAX_YEAR = 2100;

/** The current calendar year — used as the default for one-tap "this year" inputs. */
export const CURRENT_YEAR = new Date().getFullYear();

/** Accepted free-form timeline string formats for country-level timelines. */
export const TIMELINE_FORMATS = ['YYYY', 'YYYY-MM', 'YYYY-MM-DD', 'YYYY-YYYY'] as const;

/** Human-readable hint shown next to timeline inputs. */
export const TIMELINE_HINT = TIMELINE_FORMATS.join(' / ');

export const RE_YEAR = /^\d{4}$/;
export const RE_YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const RE_YEAR_MONTH_DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const RE_YEAR_RANGE = /^(\d{4})-(\d{4})$/;
