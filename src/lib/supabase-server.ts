import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client (service role). NEVER import this from a
 * client component — the key must not reach the browser bundle.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.');
  }
  if (!serviceKey) {
    const err: Error & { missingKey?: boolean } = new Error(
      'SUPABASE_SERVICE_ROLE_KEY is missing in .env.local. Add your Supabase service_role key to enable Party Booking writes.'
    );
    err.missingKey = true;
    throw err;
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
