import { z } from 'zod';

/**
 * Validate environment configuration at startup. Fail loud and early with a
 * clear message rather than producing confusing "undefined" errors deep in the
 * app. Only `VITE_`-prefixed vars are exposed to the client by Vite.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL.'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required.'),
  VITE_APP_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(
    `Invalid environment configuration. Check your .env file against .env.example:\n${details}`,
  );
}

export const env = {
  supabaseUrl: parsed.data.VITE_SUPABASE_URL,
  supabaseAnonKey: parsed.data.VITE_SUPABASE_ANON_KEY,
  appUrl: parsed.data.VITE_APP_URL ?? window.location.origin,
} as const;
