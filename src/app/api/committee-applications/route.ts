import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { requireSuperAdmin } from '@/lib/admin-auth/authorizer';
import { writeAuditLog } from '@/lib/admin-auth/audit';
import { ADMIN_MODULES } from '@/lib/admin-modules';
import {
  buildApplicationRef,
  generateCommitteePassword,
  normaliseEmail,
  normaliseMobile,
  validateCommitteeBasics,
  type CommitteeBasics,
} from '@/lib/committee-registration';

export const dynamic = 'force-dynamic';

function fail(error: string, status = 400, fields?: Record<string, string>) {
  return NextResponse.json({ success: false, error, fields }, { status });
}

const ASSIGNABLE_MODULES = ADMIN_MODULES.filter((m) => !m.superAdminOnly).map((m) => m.key);

interface PermissionPayload {
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

function sanitisePermissions(input: unknown): PermissionPayload[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input
    .map((raw) => {
      const row = raw as Partial<PermissionPayload>;
      const key = String(row.module_key || '').trim();
      if (!ASSIGNABLE_MODULES.includes(key) || seen.has(key)) return null;
      seen.add(key);
      return {
        module_key: key,
        can_view: Boolean(row.can_view),
        can_create: Boolean(row.can_create),
        can_edit: Boolean(row.can_edit),
        can_delete: Boolean(row.can_delete),
        can_approve: Boolean(row.can_approve),
      };
    })
    .filter((row): row is PermissionPayload => row !== null);
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return fail(auth.error, auth.status);

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return fail((err as Error).message, 500);
  }

  const { searchParams } = new URL(request.url);
  const committeeId = String(searchParams.get('committee_id') || '').trim();

  try {
    if (committeeId) {
      const { data: history, error } = await supabase
        .from('audit_logs')
        .select('id, action, performed_by, timestamp, metadata')
        .eq('target_id', committeeId)
        .order('timestamp', { ascending: false })
        .limit(100);
      if (error) return fail(error.message, 500);
      return NextResponse.json({ success: true, history: history || [] });
    }

    const [committeesRes, permissionsRes] = await Promise.all([
      supabase
        .from('committees')
        .select('*')
        .order('submitted_at', { ascending: false })
        .limit(1000),
      supabase.from('committee_permissions').select('committee_id, module_key, can_view, can_create, can_edit, can_delete, can_approve'),
    ]);

    if (committeesRes.error) return fail(committeesRes.error.message, 500);

    const permissionsByCommittee = new Map<string, unknown[]>();
    (permissionsRes.data || []).forEach((row: Record<string, unknown>) => {
      const key = String(row.committee_id);
      const list = permissionsByCommittee.get(key) || [];
      list.push(row);
      permissionsByCommittee.set(key, list);
    });

    const committees = (committeesRes.data || []).map((row: Record<string, unknown>) => ({
      ...row,
      permissions: permissionsByCommittee.get(String(row.id)) || [],
    }));

    return NextResponse.json({ success: true, committees });
  } catch (err) {
    return fail((err as Error).message || 'Server error', 500);
  }
}

/**
 * Super Admin creates a ready-to-use committee: APPROVED straight away, with a
 * generated sign-in password returned once so it can be handed over. Like the
 * public flow it starts with zero permission rows, because no grant means no
 * module is visible until the permission matrix says otherwise.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return fail(auth.error, auth.status);
  const actor = auth.session.userId;

  const body = (await request.json().catch(() => ({}))) as CommitteeBasics;
  const errors = validateCommitteeBasics(body);
  if (Object.keys(errors).length > 0) {
    return fail('Please correct the highlighted fields.', 422, errors);
  }

  const email = normaliseEmail(body.email);
  const mobile = normaliseMobile(body.primaryMobile);
  const committeeName = String(body.committeeName).trim();

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return fail((err as Error).message, 500);
  }

  try {
    // Three unique indexes guard this row, so the name is checked as well as the
    // email and mobile the public flow looks at. Separate filters, because an
    // `.or()` string would have to interpolate user input into the query.
    const [emailHit, mobileHit, nameHit] = await Promise.all([
      supabase.from('committees').select('id').ilike('email', email).maybeSingle(),
      supabase.from('committees').select('id').eq('primary_mobile', mobile).maybeSingle(),
      supabase.from('committees').select('id').ilike('committee_name', committeeName).maybeSingle(),
    ]);
    for (const res of [emailHit, mobileHit, nameHit]) {
      if (res.error) return fail(res.error.message, 500);
    }
    if (emailHit.data) {
      return fail('A committee already uses this email.', 409, { email: 'Email already used.' });
    }
    if (mobileHit.data) {
      return fail('A committee already uses this mobile number.', 409, {
        primaryMobile: 'Mobile already used.',
      });
    }
    if (nameHit.data) {
      return fail('A committee already has this name.', 409, { committeeName: 'Name already used.' });
    }

    const password = generateCommitteePassword();
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created?.user) {
      const message = String(createError?.message || '');
      if (/already registered|already exists/i.test(message)) {
        return fail('This email already has a panel account. Use a different address.', 409, {
          email: 'Email already used.',
        });
      }
      return fail(message || 'Could not create the committee account.', 500);
    }

    const now = new Date().toISOString();
    const applicationRef = buildApplicationRef();
    const { data: committee, error: insertError } = await supabase
      .from('committees')
      .insert({
        user_id: created.user.id,
        application_ref: applicationRef,
        committee_name: committeeName,
        primary_mobile: mobile,
        address: String(body.address).trim(),
        email,
        event_date: String(body.eventDate).trim(),
        application_status: 'APPROVED',
        reviewed_at: now,
        reviewed_by: actor,
      })
      .select('id, application_ref')
      .single();

    if (insertError || !committee) {
      // No auth account may survive a half-written committee row.
      await supabase.auth.admin.deleteUser(created.user.id).catch(() => undefined);
      if (insertError?.code === '23505') {
        return fail('Another committee was created with the same details a moment ago.', 409);
      }
      return fail(insertError?.message || 'Could not save the committee.', 500);
    }

    await supabase.from('profiles').upsert(
      {
        id: created.user.id,
        mobile,
        full_name: committeeName,
        email,
        role: 'committee',
        is_active: true,
        status: 'active',
      },
      { onConflict: 'id' }
    );

    await writeAuditLog({
      action: 'super_admin.committee_created',
      performedBy: actor,
      targetId: committee.id,
      metadata: { applicationRef, committeeName, email, eventDate: body.eventDate },
    });

    return NextResponse.json({
      success: true,
      committeeId: committee.id,
      applicationRef,
      email,
      password,
    });
  } catch (err) {
    return fail((err as Error).message || 'Server error', 500);
  }
}

/**
 * Approval workflow. Every branch is Super Admin only and stamps the reviewer,
 * so the audit trail names the person who changed a committee's fate.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return fail(auth.error, auth.status);
  const actor = auth.session.userId;

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return fail((err as Error).message, 500);
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  const action = String(body.action || '').trim().toLowerCase();

  if (!id) return fail('Committee id is required.');
  if (!['approve', 'reject', 'deactivate', 'reactivate', 'permissions'].includes(action)) {
    return fail(`Unsupported action "${action}".`);
  }

  try {
    const { data: existing, error: lookupError } = await supabase
      .from('committees')
      .select('id, user_id, committee_name, application_ref, application_status')
      .eq('id', id)
      .maybeSingle();
    if (lookupError) return fail(lookupError.message, 500);
    if (!existing) return fail('Committee application not found.', 404);

    const now = new Date().toISOString();

    if (action === 'reject') {
      const reason = String(body.reason || '').trim();
      if (!reason) return fail('A rejection reason is required.', 422);

      const { error } = await supabase
        .from('committees')
        .update({ application_status: 'REJECTED', rejection_reason: reason, reviewed_at: now, reviewed_by: actor })
        .eq('id', id);
      if (error) return fail(error.message, 500);

      await supabase.from('committee_permissions').delete().eq('committee_id', id);
      await supabase.from('profiles').update({ is_active: false, status: 'rejected' }).eq('id', existing.user_id);
      await writeAuditLog({
        action: 'committee.rejected',
        performedBy: actor,
        targetId: id,
        metadata: { committeeName: existing.committee_name, reason },
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'deactivate') {
      const { error } = await supabase
        .from('committees')
        .update({ application_status: 'DEACTIVATED', reviewed_at: now, reviewed_by: actor })
        .eq('id', id);
      if (error) return fail(error.message, 500);

      await supabase.from('profiles').update({ is_active: false, status: 'deactivated' }).eq('id', existing.user_id);
      await writeAuditLog({
        action: 'committee.deactivated',
        performedBy: actor,
        targetId: id,
        metadata: { committeeName: existing.committee_name },
      });
      return NextResponse.json({ success: true });
    }

    // approve / reactivate / permissions all write the grant matrix.
    const permissions = sanitisePermissions(body.permissions);
    if ((action === 'approve' || action === 'reactivate') && permissions.length === 0) {
      return fail('Assign at least one feature permission before approving.', 422);
    }

    if (permissions.length > 0) {
      await supabase.from('committee_permissions').delete().eq('committee_id', id);
      const rows = permissions.map((p) => ({ ...p, updated_by: actor }));
      const { error: grantError } = await supabase.from('committee_permissions').insert(rows);
      if (grantError) return fail(grantError.message, 500);
    }

    const nextStatus = action === 'deactivate' ? 'DEACTIVATED' : 'APPROVED';
    const { error: statusError } = await supabase
      .from('committees')
      .update({
        application_status: nextStatus,
        rejection_reason: null,
        reviewed_at: now,
        reviewed_by: actor,
      })
      .eq('id', id);
    if (statusError) return fail(statusError.message, 500);

    await supabase
      .from('profiles')
      .update({ is_active: true, status: 'active' })
      .eq('id', existing.user_id);

    await writeAuditLog({
      action:
        action === 'approve'
          ? 'committee.approved'
          : action === 'reactivate'
            ? 'committee.reactivated'
            : 'committee.permissions_updated',
      performedBy: actor,
      targetId: id,
      metadata: {
        committeeName: existing.committee_name,
        applicationRef: existing.application_ref,
        modules: permissions.map((p) => p.module_key),
        previousStatus: existing.application_status,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return fail((err as Error).message || 'Server error', 500);
  }
}
