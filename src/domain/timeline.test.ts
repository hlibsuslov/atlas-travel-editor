import { describe, expect, it } from 'vitest';
import { isValidTimelineString, isValidYear } from './timeline';
import { MAX_YEAR, MIN_YEAR } from './constants';

describe('isValidYear', () => {
  it('accepts integers within bounds', () => {
    expect(isValidYear(MIN_YEAR)).toBe(true);
    expect(isValidYear(2025)).toBe(true);
    expect(isValidYear(MAX_YEAR)).toBe(true);
  });

  it('rejects out-of-range, non-integer, and non-numeric values', () => {
    expect(isValidYear(MIN_YEAR - 1)).toBe(false);
    expect(isValidYear(MAX_YEAR + 1)).toBe(false);
    expect(isValidYear(2025.5)).toBe(false);
    expect(isValidYear('abc')).toBe(false);
    expect(isValidYear(null)).toBe(false);
    expect(isValidYear(NaN)).toBe(false);
  });
});

describe('isValidTimelineString', () => {
  it('accepts the four documented formats', () => {
    expect(isValidTimelineString('2020')).toBe(true);
    expect(isValidTimelineString('2020-03')).toBe(true);
    expect(isValidTimelineString('2020-03-15')).toBe(true);
    expect(isValidTimelineString('2018-2020')).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(isValidTimelineString('  2020  ')).toBe(true);
  });

  it('rejects impossible calendar dates', () => {
    expect(isValidTimelineString('2021-02-30')).toBe(false);
    expect(isValidTimelineString('2021-13-01')).toBe(false);
    expect(isValidTimelineString('2021-00-01')).toBe(false);
  });

  it('rejects ranges where end precedes start', () => {
    expect(isValidTimelineString('2020-2018')).toBe(false);
  });

  it('rejects out-of-bounds years in every position', () => {
    expect(isValidTimelineString('1899')).toBe(false);
    expect(isValidTimelineString('2101-01')).toBe(false);
    expect(isValidTimelineString('1899-2000')).toBe(false);
  });

  it('rejects junk and non-strings', () => {
    expect(isValidTimelineString('')).toBe(false);
    expect(isValidTimelineString('not-a-date')).toBe(false);
    expect(isValidTimelineString('20-03')).toBe(false);
    expect(isValidTimelineString(2020)).toBe(false);
    expect(isValidTimelineString(null)).toBe(false);
  });
});
