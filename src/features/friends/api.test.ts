import { describe, expect, it } from 'vitest';
import { extractSlug } from './api';

describe('extractSlug', () => {
  it('returns a bare slug unchanged', () => {
    expect(extractSlug('abc123XYZ')).toBe('abc123XYZ');
  });

  it('extracts the slug from a full share URL', () => {
    expect(extractSlug('https://app.example.com/share/abc123')).toBe('abc123');
    expect(extractSlug('http://localhost:5173/share/xy-_Z9?x=1')).toBe('xy-_Z9');
  });

  it('strips unsafe characters and whitespace', () => {
    expect(extractSlug('  abc/123  ')).toBe('abc123');
    expect(extractSlug('a b c!@#')).toBe('abc');
  });

  it('returns empty string for empty input', () => {
    expect(extractSlug('   ')).toBe('');
  });
});
