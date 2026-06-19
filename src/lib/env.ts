import { z } from 'zod';

/**
 * Environment configuration. Only `VITE_`-prefixed vars are exposed to the client
 * by Vite, and they are embedded at BUILD time.
 *
 * The app is **local-first by default**: it needs NO backend at all. A clean clone
 * runs entirely on IndexedDB — no accounts, no cloud, no login wall. An optional,
 * self-hostable Atlas Server instance (the OSS sharing/social backend) can be
 * pointed at via `VITE_SELFHOST_URL`; when absent, every social capability simply
 * stays hidden and the app works fully offline.
 */
const flag = z.enum(['0', '1']).optional();

const envSchema = z.object({
  VITE_APP_URL: z.string().url().optional(),
  /** Optional Atlas Server instance URL (the self-hostable sharing/social backend). */
  VITE_SELFHOST_URL: z.string().url('VITE_SELFHOST_URL must be a valid URL.').optional(),
  VITE_LOCAL_ONLY: flag,
  VITE_DEMO_AUTH: flag,
  VITE_DEMO_LOGIN: z.string().optional(),
  VITE_DEMO_PASSWORD: z.string().optional(),
  VITE_SENTRY_DSN: z.string().optional(),
});

const parsed = envSchema.safeParse(import.meta.env);

/**
 * A human-readable description of invalid (optional) configuration, or `null` when
 * the config is valid.
 *
 * We deliberately do NOT throw at module load — a thrown error here runs before
 * React mounts and produces a blank white screen. Instead `main.tsx` reads
 * `envError` and renders a readable configuration screen. With no required backend
 * variables, a clean clone is always valid and boots straight into the editor.
 */
export const envError: string | null = parsed.success
  ? null
  : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');

const fallbackAppUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';

const selfHostUrl = (parsed.success && parsed.data.VITE_SELFHOST_URL) || undefined;
const forceLocal = parsed.success && parsed.data.VITE_LOCAL_ONLY === '1';

export const env = {
  appUrl: (parsed.success && parsed.data.VITE_APP_URL) || fallbackAppUrl,
  /** Optional Atlas Server (self-hostable sharing/social backend) instance URL. */
  selfHostUrl,
  /**
   * True when running with no remote backend — pure local-first, no login wall.
   * This is the default; `VITE_LOCAL_ONLY=1` forces it even if a backend URL is set.
   */
  localOnly: forceLocal || !selfHostUrl,
  /** Demo login form (default credentials 1/1) for the explorable demo. */
  demoAuth: parsed.success ? parsed.data.VITE_DEMO_AUTH === '1' : false,
  /** Whether a sharing/social backend is configured at all (false until wired). */
  socialBackendConfigured: !!selfHostUrl,
  sentryDsn: (parsed.success && parsed.data.VITE_SENTRY_DSN) || undefined,
} as const;
