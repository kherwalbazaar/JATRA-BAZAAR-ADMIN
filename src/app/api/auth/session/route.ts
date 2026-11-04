import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth/session';

export const dynamic = 'force-dynamic';

/**
 * Read-only view of the signed-in panel user. The SPA uses it to pick which
 * sidebar modules to render; the same values are re-checked on every API call,
 * so hiding a menu item is a convenience and never the actual boundary.
 */
export async function GET() {
  const session = await getAdminSession();

  if (!session) {
    return NextResponse.json({ success: true, signedIn: false }, { status: 200 });
  }

  const canEnterDashboard = session.isSuperAdmin || session.committee?.status === 'APPROVED';

  return NextResponse.json({
    success: true,
    signedIn: true,
    canEnterDashboard,
    role: session.isSuperAdmin ? 'super_admin' : 'committee',
    user: {
      id: session.userId,
      email: session.email,
      name: session.displayName,
    },
    fullAccess: session.fullAccess,
    viewingAs: session.viewingAs,
    permissions: session.permissions,
    allowedTabs: session.allowedTabs,
    committee: session.committee,
  });
}
