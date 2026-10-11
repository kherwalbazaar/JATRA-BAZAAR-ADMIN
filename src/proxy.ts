import { type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/proxy';

export async function proxy(request: NextRequest) {
  const { supabase, supabaseResponse } = createClient(request);

  // IMPORTANT: Do not run code between createClient and supabase.auth.getUser()
  // - Potential hard to debug bugs / security issues.

  // Refresh session if expired - required for Server Components.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
