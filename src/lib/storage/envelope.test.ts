import { describe, expect, it } from 'vitest';
import { makeDefaultData } from '@/domain/normalize';
import { APP_ID, SCHEMA_VERSION, readEnvelope, wrapEnvelope } from './envelope';

describe('portable envelope', () => {
  it('round-trips a document through wrap → read', () => {
    const data = makeDefaultData();
    const env = wrapEnvelope(data, '2026-06-19T00:00:00.000Z');

    expect(env.app).toBe(APP_ID);
    expect(env.schemaVersion).toBe(SCHEMA_VERSION);
    expect(env.updatedAt).toBe('2026-06-19T00:00:00.000Z');

    const read = readEnvelope(env);
    expect(read.data).toEqual(data);
    expect(read.updatedAt).toBe('2026-06-19T00:00:00.000Z');
  });

  it('stamps updatedAt automatically when omitted', () => {
    const before = Date.now();
    const env = wrapEnvelope(makeDefaultData());
    const stamped = Date.parse(env.updatedAt);
    expect(stamped).toBeGreaterThanOrEqual(before);
  });

  it('accepts a bare legacy document with no envelope', () => {
    const bare = makeDefaultData();
    const read = readEnvelope(bare);
    expect(read.data.person.birthplace.country).toBe('Ukraine');
    expect(read.updatedAt).toBeUndefined();
  });

  it('normalizes the data on read (coerces legacy / loose input)', () => {
    // A loosely-shaped blob inside an envelope: missing fields, string city.
    const loose = {
      app: APP_ID,
      schemaVersion: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      data: {
        person: { birthplace: { country: '  France  ' } },
        travel: { countries: [{ name: 'Japan', cities: ['Tokyo'] }] },
      },
    };
    const read = readEnvelope(loose);
    // Trimmed birthplace, country defaults filled, bare-string city expanded.
    expect(read.data.person.birthplace.country).toBe('France');
    const japan = read.data.travel.countries[0]!;
    expect(japan.name).toBe('Japan');
    expect(japan.status).toEqual({ visited: false, lived: false, birthplace: false });
    expect(japan.cities[0]).toEqual({ name: 'Tokyo', timeline: { visited: [] } });
  });
});
