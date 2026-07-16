import { describe, expect, it } from 'vitest';
import { UN_MEMBER_CODES, UN_MEMBER_COUNT, isUnMember, recognition } from './sovereignty';

describe('UN member truth', () => {
  it('declares exactly 193 members', () => {
    expect(UN_MEMBER_COUNT).toBe(193);
    expect(UN_MEMBER_CODES).toHaveLength(193);
  });

  it('has no duplicate codes', () => {
    expect(new Set(UN_MEMBER_CODES).size).toBe(193);
  });

  it('contains only well-formed alpha-2 codes', () => {
    for (const code of UN_MEMBER_CODES) expect(code).toMatch(/^[A-Z]{2}$/);
  });
});

describe('isUnMember', () => {
  it('recognizes members by ISO code', () => {
    expect(isUnMember('FR')).toBe(true);
    expect(isUnMember('US')).toBe(true);
    expect(isUnMember('JP')).toBe(true);
  });

  it('recognizes members by English name', () => {
    expect(isUnMember('France')).toBe(true);
    expect(isUnMember('United States')).toBe(true);
    expect(isUnMember(' Japan ')).toBe(true);
  });

  it('never counts Taiwan or the Vatican as UN members', () => {
    expect(isUnMember('TW')).toBe(false);
    expect(isUnMember('Taiwan')).toBe(false);
    expect(isUnMember('VA')).toBe(false);
    expect(isUnMember('Vatican City')).toBe(false);
    expect(isUnMember('Holy See')).toBe(false);
  });

  it('rejects unknown / empty input', () => {
    expect(isUnMember('')).toBe(false);
    expect(isUnMember('Atlantis')).toBe(false);
    expect(isUnMember('XK')).toBe(false); // Kosovo: not a UN member, not in picker
  });
});

describe('recognition', () => {
  it('classifies members, observers, and others', () => {
    expect(recognition('FR')).toBe('un-member');
    expect(recognition('France')).toBe('un-member');
    expect(recognition('VA')).toBe('observer');
    expect(recognition('Vatican City')).toBe('observer');
    expect(recognition('TW')).toBe('other');
    expect(recognition('Taiwan')).toBe('other');
    expect(recognition('Atlantis')).toBe('other');
  });
});
