import 'server-only';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
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
  isSuperAdmin: boolean;
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

async function buildSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string
): Promise<AdminSession> {
  const [profileRes, adminRes, committeeRes] = await Promise.all([
    supabase.from('profiles').select('full_name, role').eq('id', userId).maybeSingle(),
    supabase.from('admin_users').select('role').eq('user_id', userId).maybeSingle(),
    supabase
      .from('committees')
      .select(
        'id, application_ref, committee_name, application_status, rejection_reason, submitted_at, reviewed_at, last_login_at'
      )
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const profile = profileRes.data as { full_name?: string; mobile?: string; role?: string } | null;
  const isSuperAdmin =
    adminRes.data?.role === 'admin' || String(profile?.role || '') === 'super_admin';

  const committeeRow = committeeRes.data as CommitteeRow | null;
  const committee: CommitteeProfile | null = committeeRow
    ? {
        id: committeeRow.id,
        applicationRef: committeeRow.application_ref || committeeRow.id.slice(0, 8).toUpperCase(),
        committeeName: committeeRow.committee_name,
        status: STATUS_MAP[String(committeeRow.application_status).toUpperCase()] || 'PENDING',
        rejectionReason: committeeRow.rejection_reason,
        submittedAt: committeeRow.submitted_at,
        reviewedAt: committeeRow.reviewed_at,
        lastLoginAt: committeeRow.last_login_at,
      }
    : null;

  const permissions: Record<string, string[]> = {};
  if (committee && committee.status === 'APPROVED') {
    const { data: permissionRows } = await supabase
      .from('committee_permissions')
      .select('module_key, can_view, can_create, can_edit, can_delete, can_approve')
      .eq('committee_id', committee.id);

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
  }

  const grantedModules = Object.keys(permissions).filter((key) => permissions[key].includes('view'));
  const tabs = allowedTabs(isSuperAdmin, grantedModules);

  return {
    userId,
    email,
    displayName: String(profile?.full_name || committee?.committeeName || email || 'Administrator'),
    isSuperAdmin,
    permissions,
    allowedTabs: Array.from(tabs),
    committee,
  };
}
