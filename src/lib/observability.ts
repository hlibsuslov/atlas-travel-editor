import * as Sentry from '@sentry/react';

/**
 * Initialize error/performance monitoring. No-op unless VITE_SENTRY_DSN is set,
 * so local dev and tests stay quiet and the dependency adds no runtime behavior
 * until explicitly configured for an environment.
 */
export function initObservability(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}

export { Sentry };
