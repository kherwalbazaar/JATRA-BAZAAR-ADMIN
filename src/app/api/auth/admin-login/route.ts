import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { getSessionForUser } from '@/lib/admin-auth/session';
import { normaliseMobile } from '@/lib/committee-registration';
import { writeAuditLog } from '@/lib/admin-auth/audit';

export const dynamic = 'force-dynamic';

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Super Admin and Committee sign-in. Supabase Auth verifies the password; the
 * role, approval state and permissions are then read from the database so the
 * browser never declares who it is.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const suppliedMobile = normaliseMobile(String(body.mobile || ''));

  if (!email || !password) return fail('Enter your email and password.', 400);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return fail('Email or password is incorrect.', 401);
  }

  const session = await getSessionForUser(data.user.id, String(data.user.email || email));
  if (!session) return fail('Session could not be created. Try again.', 500);

  // A Super Admin carries a second factor: the mobile recorded on the account.
  // app_metadata is written only by the service role, so the client cannot widen it.
  if (session.isSuperAdmin) {
    const expected = normaliseMobile(String(data.user.app_metadata?.admin_mobile || ''));
    if (!expected || !suppliedMobile || expected !== suppliedMobile) {
      await supabase.auth.signOut();
      return fail('Mobile number does not match this Super Admin account.', 403);
    }
  }

  if (!session.isSuperAdmin) {
    if (!session.committee) {
      await supabase.auth.signOut();
      return fail('This account is not registered for the Admin Panel.', 403);
    }

    await writeAuditLog({
      action: `committee.login.${session.committee.status.toLowerCase()}`,
      performedBy: data.user.id,
      targetId: session.committee.id,
      metadata: { email, applicationRef: session.committee.applicationRef },
    });

    if (session.committee.status !== 'APPROVED') {
      return NextResponse.json({
        success: true,
        role: 'committee',
        next: 'status',
        status: session.committee.status,
      });
    }
  }

  // Stamp the login and record it; both use the service role because a
  // committee has no write policy of its own.
  try {
    const admin = createSupabaseAdminClient();
    if (session.committee) {
      await admin
        .from('committees')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', session.committee.id);
    }
    await admin.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', data.user.id);
  } catch (err) {
    console.warn('[login] last-login stamp skipped:', (err as Error).message);
  }

  await writeAuditLog({
    action: session.isSuperAdmin ? 'super_admin.login' : 'committee.login',
    performedBy: data.user.id,
    targetId: session.committee?.id || data.user.id,
    metadata: { email },
  });

  return NextResponse.json({
    success: true,
    role: session.isSuperAdmin ? 'super_admin' : 'committee',
    next: 'dashboard',
  });
}
