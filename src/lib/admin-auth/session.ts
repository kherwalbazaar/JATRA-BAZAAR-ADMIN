import 'server-only';
import { createClient } from '@/utils/supabase/server';
import { readViewAsCommitteeId } from '@/lib/admin-auth/view-as';
import { allowedTabs, type CommitteeStatus } from '@/lib/admin-modules';

export type { CommitteeStatus };
import type { NavigationTab } from '@/types';

export interface CommitteeProfile {
  id: string;
  applicationRef: string;
  committeeName: string;
  status: CommitteeStatus;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  lastLoginAt: string | null;
}

export interface AdminSession {
  userId: string;
  email: string;
  displayName: string;
  /** The true role, never changed by a view-as switch. */
  isSuperAdmin: boolean;
  /** Super Admin powers, or false while browsing as a committee. */
  fullAccess: boolean;
  /** Set when a Super Admin is viewing the panel as this committee. */
  viewingAs: CommitteeProfile | null;
  /** Module keys the session may act on, mapped to its granted actions. */
  permissions: Record<string, string[]>;
  allowedTabs: NavigationTab[];
  committee: CommitteeProfile | null;
}

interface CommitteeRow {
  id: string;
  application_ref: string | null;
  committee_name: string;
  application_status: string;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  last_login_at: string | null;
}

const STATUS_MAP: Record<string, CommitteeStatus> = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  DEACTIVATED: 'DEACTIVATED',
};

/**
 * Resolves the signed-in identity from the Supabase Auth cookie and then reads
 * role, committee status and permission grants out of the database. The client
 * never supplies any of it, so a forged header or localStorage edit cannot
 * widen access.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) return null;
  return buildSession(supabase, user.id, String(user.email || ''));
}

/** Same resolution, from an email/password pair already verified by Supabase Auth. */
export async function getSessionForUser(userId: string, email: string): Promise<AdminSession | null> {
  const supabase = await createClient();
  return buildSession(supabase, userId, email);
}

const COMMITTEE_COLUMNS =
  'id, application_ref, committee_name, application_status, rejection_reason, submitted_at, reviewed_at, last_login_at';

function toCommitteeProfile(row: CommitteeRow | null): CommitteeProfile | null {
  if (!row) return null;
  return {
    id: row.id,
    applicationRef: row.application_ref || row.id.slice(0, 8).toUpperCase(),
    committeeName: row.committee_name,
    status: STATUS_MAP[String(row.application_status).toUpperCase()] || 'PENDING',
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    lastLoginAt: row.last_login_at,
  };
}

async function loadPermissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  committeeId: string
): Promise<Record<string, string[]>> {
  const permissions: Record<string, string[]> = {};
  const { data: permissionRows } = await supabase
    .from('committee_permissions')
    .select('module_key, can_view, can_create, can_edit, can_delete, can_approve')
    .eq('committee_id', committeeId);

  ((permissionRows || []) as {
    module_key: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
    can_approve: boolean;
  }[]).forEach((row) => {
    const actions: string[] = [];
    if (row.can_view) actions.push('view');
    if (row.can_create) actions.push('create');
    if (row.can_edit) actions.push('edit');
    if (row.can_delete) actions.push('delete');
    if (row.can_approve) actions.push('approve');
    if (actions.length) permissions[row.module_key] = actions;
  });
  return permissions;
}

async function buildSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string
): Promise<AdminSession> {
  const [profileRes, adminRes, committeeRes] = await Promise.all([
    supabase.from('profiles').select('full_name, role').eq('id', userId).maybeSingle(),
    supabase.from('admin_users').select('role').eq('user_id', userId).maybeSingle(),
    supabase.from('committees').select(COMMITTEE_COLUMNS).eq('user_id', userId).maybeSingle(),
  ]);

  const profile = profileRes.data as { full_name?: string; role?: string } | null;
  const isSuperAdmin =
    adminRes.data?.role === 'admin' || String(profile?.role || '') === 'super_admin';

  let committee = toCommitteeProfile(committeeRes.data as CommitteeRow | null);
  let permissions =
    committee?.status === 'APPROVED' ? await loadPermissions(supabase, committee.id) : {};

  /*
   * A Super Admin may browse the panel through one committee's grants. The
   * cookie only names a row; the committee and its permissions are re-read from
   * the database here, so a stale or forged value can only ever narrow this
   * session down to an approved committee's own access.
   */
  let viewingAs: CommitteeProfile | null = null;
  if (isSuperAdmin) {
    const targetId = await readViewAsCommitteeId();
    if (targetId && targetId !== committee?.id) {
      const { data: targetRow } = await supabase
        .from('committees')
        .select(COMMITTEE_COLUMNS)
        .eq('id', targetId)
        .maybeSingle();
      const target = toCommitteeProfile(targetRow as CommitteeRow | null);
      if (target?.status === 'APPROVED') {
        viewingAs = target;
        committee = target;
        permissions = await loadPermissions(supabase, target.id);
      }
    }
  }

  const fullAccess = isSuperAdmin && !viewingAs;
  const grantedModules = Object.keys(permissions).filter((key) => permissions[key].includes('view'));
  const tabs = allowedTabs(fullAccess, grantedModules);

  return {
    userId,
    email,
    displayName: String(profile?.full_name || committee?.committeeName || email || 'Administrator'),
    isSuperAdmin,
    fullAccess,
    viewingAs,
    permissions,
    allowedTabs: Array.from(tabs),
    committee,
  };
}
