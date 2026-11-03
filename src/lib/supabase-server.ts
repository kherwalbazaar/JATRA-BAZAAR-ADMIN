import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client (service role).
 *
 * The `server-only` import makes any attempt to pull this module into a client
 * component fail at build time, so the service-role key can never reach the
 * browser bundle or a NEXT_PUBLIC_ variable.
 */

// The project URL is public and already hard-coded elsewhere in the codebase,
// so a missing NEXT_PUBLIC_SUPABASE_URL must not by itself break Party Booking.
const DEFAULT_SUPABASE_URL = 'https://fmiaiuhmmlyciafxgvna.supabase.co';

const SERVICE_KEY_ENV_NAMES = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY'];

function readServiceKey(): string {
  for (const name of SERVICE_KEY_ENV_NAMES) {
    // Strip quotes/whitespace introduced by copy-pasting into a dashboard.
    const value = String(process.env[name] ?? '').trim().replace(/^['"]|['"]$/g, '');
    if (value) return value;
  }
  return '';
}

export class SupabaseServiceKeyMissingError extends Error {
  readonly missingKey = true;

  constructor() {
    super(
      `Supabase service-role key is not configured in this server environment. Set ` +
        `${SERVICE_KEY_ENV_NAMES[0]} to your Supabase service_role secret wherever this app runs: ` +
        `locally in .env.local, and on Vercel under Project Settings → Environment Variables ` +
        `with the Production environment enabled, then redeploy. Never expose it as a ` +
        `NEXT_PUBLIC_ variable.`
    );
    this.name = 'SupabaseServiceKeyMissingError';
  }
}

export function createSupabaseAdminClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  const serviceKey = readServiceKey();

  if (!serviceKey) {
    throw new SupabaseServiceKeyMissingError();
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
