import { describe, expect, it } from 'vitest';
import { backoffDelay, isRetriableError, retryTransient } from './mutationError';

describe('isRetriableError', () => {
  it('does not retry deterministic validation/auth errors', () => {
    expect(isRetriableError(new Error('Cannot save invalid data: name required'))).toBe(false);
    expect(isRetriableError(new Error('Not authenticated.'))).toBe(false);
    expect(isRetriableError(new Error('No travel document.'))).toBe(false);
  });

  it('retries transient errors', () => {
    expect(isRetriableError(new Error('Failed to fetch'))).toBe(true);
    expect(isRetriableError(new Error('network timeout'))).toBe(true);
  });
});

describe('retryTransient', () => {
  it('stops after max attempts and never retries non-retriable errors', () => {
    const retry = retryTransient(2);
    expect(retry(0, new Error('network'))).toBe(true);
    expect(retry(1, new Error('network'))).toBe(true);
    expect(retry(2, new Error('network'))).toBe(false); // hit the cap
    expect(retry(0, new Error('Not authenticated.'))).toBe(false);
  });
});

describe('backoffDelay', () => {
  it('grows exponentially and caps at 8s', () => {
    expect(backoffDelay(0)).toBe(1000);
    expect(backoffDelay(1)).toBe(2000);
    expect(backoffDelay(3)).toBe(8000);
    expect(backoffDelay(10)).toBe(8000);
  });
});
