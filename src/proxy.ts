import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/proxy';

/**
 * Panels paths that must not be opened without a signed-in admin session.
 * Committee approval state is resolved by the dashboard and the API routes
 * themselves; proxy only knows "signed in or not".
 */
const PROTECTED_PAGES = ['/', '/create-event', '/edit-event', '/event-details', '/admin'];
const PROTECTED_APIS = ['/api/party-bookings', '/api/committee-applications', '/api/admin/view-as'];

const PUBLIC_API = [
  '/api/auth/admin-login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/committee-register',
  '/api/admin-contact',
];

function isProtectedPage(pathname: string): boolean {
  if (pathname === '/') return true;
  return PROTECTED_PAGES.filter((p) => p !== '/').some((prefix) => pathname.startsWith(prefix));
}

function isProtectedApi(pathname: string): boolean {
  if (PUBLIC_API.some((path) => pathname.startsWith(path))) return false;
  return PROTECTED_APIS.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPage = isProtectedPage(pathname);
  const isApi = isProtectedApi(pathname);

  if (!isPage && !isApi) {
    const { supabaseResponse } = createClient(request);
    return supabaseResponse;
  }

  const { supabase, supabaseResponse } = createClient(request);

  // IMPORTANT: nothing runs between createClient and getUser() — refreshing the
  // session has to happen first so an expired token is renewed before we judge it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isApi) {
      return NextResponse.json(
        { success: false, error: 'Sign in to use the Admin Panel.' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

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
