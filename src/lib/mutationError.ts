/**
 * Shared retry policy for mutations. Transient failures (network blips, RPC
 * timeouts) are worth retrying with backoff; deterministic failures (client-side
 * validation, auth) are not — retrying them just delays the inevitable error.
 */

/** Error messages that are deterministic and must not be retried. */
const NON_RETRIABLE = [/^Cannot save invalid data/i, /not authenticated/i, /no travel document/i];

export function isRetriableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return !NON_RETRIABLE.some((re) => re.test(message));
}

/** react-query `retry` predicate: retry transient errors up to `max` times. */
export function retryTransient(max = 2) {
  return (failureCount: number, error: unknown) => failureCount < max && isRetriableError(error);
}

/** Exponential backoff capped at 8s: 1s, 2s, 4s, 8s, 8s… */
export const backoffDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 8000);
