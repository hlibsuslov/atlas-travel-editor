import { z } from 'zod';

/**
 * Validate environment configuration. Only `VITE_`-prefixed vars are exposed to
 * the client by Vite, and they are embedded at BUILD time — so they must be set
 * in the host (e.g. Vercel) before the build runs, not just at runtime.
 *
 * Supabase credentials are normally required, but become OPTIONAL when the app is
 * running in a backendless mode — local-only (`VITE_LOCAL_ONLY=1`) or demo auth
 * (`VITE_DEMO_AUTH=1`) — so the no-backend quickstart works on a clean clone.
 */
const flag = z.enum(['0', '1']).optional();

const localOnly = import.meta.env.VITE_LOCAL_ONLY === '1';
const demoAuth = import.meta.env.VITE_DEMO_AUTH === '1';
/** When true, the app can boot with no Supabase configuration at all. */
const backendOptional = localOnly || demoAuth;

const supabaseUrl = backendOptional
  ? z.string().url('VITE_SUPABASE_URL must be a valid URL.').optional()
  : z.string().url('VITE_SUPABASE_URL must be a valid URL.');
const supabaseAnonKey = backendOptional
  ? z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required.').optional()
  : z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required.');

const envSchema = z.object({
  VITE_SUPABASE_URL: supabaseUrl,
  VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
  VITE_APP_URL: z.string().url().optional(),
  VITE_LOCAL_ONLY: flag,
  VITE_DEMO_AUTH: flag,
  VITE_DEMO_LOGIN: z.string().optional(),
  VITE_DEMO_PASSWORD: z.string().optional(),
  VITE_SENTRY_DSN: z.string().optional(),
});

const parsed = envSchema.safeParse(import.meta.env);

/**
 * A human-readable description of missing/invalid configuration, or `null` when
 * the config is valid.
 *
 * We deliberately do NOT throw at module load. A thrown error here runs before
 * React mounts (env is imported by the Supabase client, which is imported by the
 * very first module), producing a blank white screen with no explanation — the
 * opposite of "fail loud". Instead `main.tsx` reads `envError` and renders a
 * readable configuration screen.
 */
export const envError: string | null = parsed.success
  ? null
  : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');

const fallbackAppUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';

/** Whether real Supabase credentials are present (independent of mode). */
const supabaseConfigured =
  !!parsed.success && !!parsed.data.VITE_SUPABASE_URL && !!parsed.data.VITE_SUPABASE_ANON_KEY;

export const env = {
  // Safe placeholders when misconfigured/absent so the Supabase client
  // constructor doesn't throw at import; in backendless mode the placeholder
  // client simply never gets called (every Supabase access path degrades).
  supabaseUrl: (parsed.success && parsed.data.VITE_SUPABASE_URL) || 'http://supabase.invalid',
  supabaseAnonKey: (parsed.success && parsed.data.VITE_SUPABASE_ANON_KEY) || 'invalid-anon-key',
  appUrl: (parsed.success && parsed.data.VITE_APP_URL) || fallbackAppUrl,
  /** True when running without any backend (local-only or demo auth). */
  localOnly,
  /** True when the demo auth bypass is enabled. */
  demoAuth,
  /** True when real Supabase credentials are present. */
  supabaseConfigured,
  /** The app can boot with no Supabase configuration at all. */
  backendOptional,
  sentryDsn: (parsed.success && parsed.data.VITE_SENTRY_DSN) || undefined,
} as const;
