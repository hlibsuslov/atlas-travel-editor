import { z } from 'zod';

/**
 * Validate environment configuration. Only `VITE_`-prefixed vars are exposed to
 * the client by Vite, and they are embedded at BUILD time — so they must be set
 * in the host (e.g. Vercel) before the build runs, not just at runtime.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL.'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required.'),
  VITE_APP_URL: z.string().url().optional(),
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

export const env = {
  // Safe placeholders when misconfigured so the Supabase client constructor
  // doesn't throw at import; the app shows the config screen instead of running.
  supabaseUrl: parsed.success ? parsed.data.VITE_SUPABASE_URL : 'http://supabase.invalid',
  supabaseAnonKey: parsed.success ? parsed.data.VITE_SUPABASE_ANON_KEY : 'invalid-anon-key',
  appUrl: (parsed.success && parsed.data.VITE_APP_URL) || fallbackAppUrl,
} as const;
