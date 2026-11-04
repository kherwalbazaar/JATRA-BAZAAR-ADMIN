import 'server-only';
import { getAdminSession, type AdminSession } from '@/lib/admin-auth/session';
import { getModule } from '@/lib/admin-modules';

export type SessionOutcome =
  | { ok: true; session: AdminSession }
  | { ok: false; status: number; error: string };

/** Any authenticated panel user. */
export async function requireSession(): Promise<SessionOutcome> {
  const session = await getAdminSession();
  if (!session) {
    return { ok: false, status: 401, error: 'Sign in to use the Admin Panel.' };
  }
  if (!session.isSuperAdmin && session.committee?.status !== 'APPROVED') {
    return {
      ok: false,
      status: 403,
      error: 'This account has no active committee approval.',
    };
  }
  return { ok: true, session };
}

/** Super Admin only — committee approvals, permissions, admin settings. */
export async function requireSuperAdmin(): Promise<SessionOutcome> {
  const result = await requireSession();
  if (!result.ok) return result;
  if (!result.session.fullAccess) {
    return {
      ok: false,
      status: 403,
      error: result.session.isSuperAdmin
        ? 'Leave the committee view to use Super Admin features.'
        : 'Super Admin access is required for this action.',
    };
  }
  return result;
}

/**
 * Server-side permission check. The answer comes from the session resolved out
 * of the database, never from anything the browser sent.
 */
export async function requireModule(
  moduleKey: string,
  action: 'view' | 'create' | 'edit' | 'delete' | 'approve' = 'view'
): Promise<SessionOutcome> {
  const result = await requireSession();
  if (!result.ok) return result;

  const module = getModule(moduleKey);
  if (!module) {
    return { ok: false, status: 400, error: `Unknown module "${moduleKey}".` };
  }
  if (module.superAdminOnly && !result.session.fullAccess) {
    return { ok: false, status: 403, error: `Access to ${module.label} is restricted to Super Admin.` };
  }
  if (hasPermission(result.session, moduleKey, action)) {
    return result;
  }
  return {
    ok: false,
    status: 403,
    error: `Your committee has not been granted ${action.toUpperCase()} access to ${module.label}.`,
  };
}

export function hasPermission(
  session: AdminSession,
  moduleKey: string,
  action: 'view' | 'create' | 'edit' | 'delete' | 'approve' = 'view'
): boolean {
  // While browsing as a committee, a Super Admin is held to that committee's
  // grants, so the simulation cannot be escaped by calling an API directly.
  if (session.fullAccess) return true;
  return (session.permissions[moduleKey] || []).includes(action);
}
