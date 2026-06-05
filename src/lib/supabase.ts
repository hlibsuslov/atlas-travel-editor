import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { env } from './env';

/**
 * Singleton Supabase client. Uses only the public anon key — all access control
 * is enforced server-side by Row Level Security. The service_role key must never
 * reach the browser.
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
