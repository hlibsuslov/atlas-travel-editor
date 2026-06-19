import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useImportPreview } from './useImportPreview';
import { makeDefaultData } from '@/domain/normalize';
import { wrapEnvelope } from '@/lib/storage/envelope';

const preview = (raw: string) => renderHook(() => useImportPreview(raw)).result.current;

describe('useImportPreview', () => {
  it('reports an empty state for blank input', () => {
    expect(preview('   ').state).toBe('empty');
  });

  it('reports a parse error for invalid JSON', () => {
    const p = preview('{not json');
    expect(p.state).toBe('parse');
  });

  it('imports a bare legacy TravelData document', () => {
    const p = preview(JSON.stringify(makeDefaultData()));
    expect(p.state).toBe('ok');
    if (p.state === 'ok' || p.state === 'warn') {
      expect(p.countries).toBe(1);
      expect(p.data.person.birthplace.country).toBe('Ukraine');
    }
  });

  it('imports a portable envelope produced by wrapEnvelope (round-trip)', () => {
    const original = makeDefaultData();
    original.person.birthplace.country = 'France';
    const p = preview(JSON.stringify(wrapEnvelope(original)));
    expect(p.state).toBe('ok');
    if (p.state === 'ok' || p.state === 'warn') {
      // The envelope is unwrapped — we see the inner TravelData, not {app,data,…}.
      expect(p.data.person.birthplace.country).toBe('France');
      expect(p.countries).toBe(1);
    }
  });

  it('normalizes loose data inside an envelope (string city, missing fields)', () => {
    const raw = JSON.stringify({
      app: 'travel-editor',
      schemaVersion: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      data: { person: { birthplace: { country: 'Japan' } }, travel: { countries: [{ name: 'Italy', cities: ['Rome'] }] } },
    });
    const p = preview(raw);
    expect(p.state === 'ok' || p.state === 'warn').toBe(true);
    if (p.state === 'ok' || p.state === 'warn') {
      expect(p.data.travel.countries[0]!.cities[0]).toEqual({ name: 'Rome', timeline: { visited: [] } });
    }
  });
});
