import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { requireSession, type SessionOutcome } from '@/lib/admin-auth/authorizer';
import { writeAuditLog } from '@/lib/admin-auth/audit';
import { readViewAsCommitteeId, writeViewAsCommitteeId } from '@/lib/admin-auth/view-as';

export const dynamic = 'force-dynamic';

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CommitteeRow {
  id: string;
  committee_name: string;
  application_ref: string | null;
  application_status: string;
}

function toOption(row: CommitteeRow) {
  return {
    id: row.id,
    name: row.committee_name,
    applicationRef: row.application_ref || row.id.slice(0, 8).toUpperCase(),
  };
}

/**
 * Deliberately the true role, not fullAccess: exiting a committee view has to
 * work while one is active. What the committee view then allows is decided by
 * the session builder, which re-reads that committee's grants.
 */
async function requireTrueSuperAdmin(): Promise<SessionOutcome> {
  const result = await requireSession();
  if (!result.ok) return result;
  if (!result.session.isSuperAdmin) {
    return { ok: false, status: 403, error: 'Super Admin access is required for this action.' };
  }
  return result;
}

export async function GET() {
  const auth = await requireTrueSuperAdmin();
  if (!auth.ok) return fail(auth.error, auth.status);

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('committees')
      .select('id, committee_name, application_ref, application_status')
      .order('committee_name');
    // Until the committee migration runs there simply are no committees to open.
    if (error && error.code !== 'PGRST205') return fail(error.message, 500);

    const committees = (((data || []) as CommitteeRow[])
      .filter((row) => String(row.application_status).toUpperCase() === 'APPROVED')
      .map(toOption));

    return NextResponse.json({ success: true, committees, viewAsId: await readViewAsCommitteeId() });
  } catch (err) {
    return fail((err as Error).message, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireTrueSuperAdmin();
  if (!auth.ok) return fail(auth.error, auth.status);

  const body = await request.json().catch(() => ({}));
  const committeeId = String(body.committeeId || '').trim();

  if (!committeeId) {
    await writeViewAsCommitteeId(null);
    await writeAuditLog({
      action: 'super_admin.view_as.exit',
      performedBy: auth.session.userId,
      targetId: auth.session.userId,
      metadata: { from: auth.session.viewingAs?.id || null },
    });
    return NextResponse.json({ success: true, viewAsId: null });
  }

  if (!UUID_RE.test(committeeId)) return fail('Unknown committee.', 422);

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('committees')
      .select('id, committee_name, application_ref, application_status')
      .eq('id', committeeId)
      .maybeSingle();
    if (error && error.code !== 'PGRST205') return fail(error.message, 500);

    const row = data as CommitteeRow | null;
    if (!row) return fail('That committee no longer exists.', 404);
    if (String(row.application_status).toUpperCase() !== 'APPROVED') {
      return fail('Only an approved committee can be opened.', 403);
    }

    await writeViewAsCommitteeId(row.id);
    await writeAuditLog({
      action: 'super_admin.view_as.enter',
      performedBy: auth.session.userId,
      targetId: row.id,
      metadata: { committeeName: row.committee_name },
    });

    return NextResponse.json({ success: true, viewAsId: row.id, committee: toOption(row) });
  } catch (err) {
    return fail((err as Error).message, 500);
  }
}
