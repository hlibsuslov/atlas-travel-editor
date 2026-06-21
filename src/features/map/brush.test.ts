import { describe, expect, it } from 'vitest';
import { BRUSHES, brushSwatch, resolveBrushClick, type Brush } from './brush';
import type { MapStatus } from './countryMatch';

describe('BRUSHES', () => {
  it('lists every brush exactly once, with cycle first and erase last', () => {
    expect(BRUSHES).toEqual(['cycle', 'visited', 'lived', 'capital', 'birthplace', 'erase']);
    expect(new Set(BRUSHES).size).toBe(BRUSHES.length);
  });
});

describe('brushSwatch', () => {
  it('returns the matching status colour key for a paint brush', () => {
    expect(brushSwatch('visited')).toBe('visited');
    expect(brushSwatch('lived')).toBe('lived');
    expect(brushSwatch('capital')).toBe('capital');
    expect(brushSwatch('birthplace')).toBe('birthplace');
  });

  it('maps erase to the "none" swatch and cycle to no single colour', () => {
    expect(brushSwatch('erase')).toBe('none');
    expect(brushSwatch('cycle')).toBeNull();
  });
});

describe('resolveBrushClick', () => {
  const allStatuses: MapStatus[] = ['none', 'visited', 'lived', 'capital', 'birthplace'];

  it('cycle: none → visited → lived → none', () => {
    expect(resolveBrushClick('cycle', 'none')).toBe('visited');
    expect(resolveBrushClick('cycle', 'visited')).toBe('lived');
    expect(resolveBrushClick('cycle', 'lived')).toBe('none');
  });

  it('cycle: capital / birthplace start a fresh visited run', () => {
    expect(resolveBrushClick('cycle', 'capital')).toBe('visited');
    expect(resolveBrushClick('cycle', 'birthplace')).toBe('visited');
  });

  it('erase always clears to none, whatever the current status', () => {
    for (const s of allStatuses) expect(resolveBrushClick('erase', s)).toBe('none');
  });

  it('an explicit brush applies that status when the country differs', () => {
    expect(resolveBrushClick('visited', 'none')).toBe('visited');
    expect(resolveBrushClick('lived', 'visited')).toBe('lived');
    expect(resolveBrushClick('capital', 'none')).toBe('capital');
    expect(resolveBrushClick('birthplace', 'lived')).toBe('birthplace');
  });

  it('painting the SAME status a country already has toggles it off (clears)', () => {
    const paints: Brush[] = ['visited', 'lived', 'capital', 'birthplace'];
    for (const b of paints) {
      // b as MapStatus is sound: each paint brush name is also a status name.
      expect(resolveBrushClick(b, b as MapStatus)).toBe('none');
    }
  });
});
