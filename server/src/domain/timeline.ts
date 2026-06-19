import {
  MAX_YEAR,
  MIN_YEAR,
  RE_YEAR,
  RE_YEAR_MONTH,
  RE_YEAR_MONTH_DAY,
  RE_YEAR_RANGE,
} from './constants';

/** True when `year` is a finite integer within the accepted [MIN_YEAR, MAX_YEAR] range. */
export function isValidYear(year: unknown): boolean {
  const n = Number(year);
  return Number.isInteger(n) && n >= MIN_YEAR && n <= MAX_YEAR;
}

/** Validate that a YYYY-MM-DD string is a real calendar date (rejects e.g. 2021-02-30). */
function isRealDate(yyyy: number, mm: number, dd: number): boolean {
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return d.getUTCFullYear() === yyyy && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd;
}

/**
 * Validate a country-level timeline string.
 * Accepts: `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or a `YYYY-YYYY` range (end >= start).
 * All embedded years must fall within [MIN_YEAR, MAX_YEAR].
 */
export function isValidTimelineString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (!s) return false;

  if (RE_YEAR.test(s)) return isValidYear(s);

  if (RE_YEAR_MONTH.test(s)) return isValidYear(s.slice(0, 4));

  if (RE_YEAR_MONTH_DAY.test(s)) {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    return isValidYear(y) && isRealDate(y, m, d);
  }

  const range = RE_YEAR_RANGE.exec(s);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    return isValidYear(start) && isValidYear(end) && end >= start;
  }

  return false;
}
