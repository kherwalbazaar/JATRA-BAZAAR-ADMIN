import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { normaliseMobile } from '@/lib/committee-registration';
import { writeAuditLog } from '@/lib/admin-auth/audit';

export const dynamic = 'force-dynamic';

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function codeMatches(provided: string): boolean {
  const expected = String(process.env.SUPER_ADMIN_BOOTSTRAP_CODE || '').trim();
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * One-time Super Admin provisioning.
 *
 * It stays reachable only while no administrator exists at all, and it demands
 * the SUPER_ADMIN_BOOTSTRAP_CODE environment value, so no credential ships in
 * source and the route seals itself the moment the first Super Admin exists.
 * Committee registration can never reach this path.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const name = String(body.name || '').trim();
  const mobile = normaliseMobile(String(body.mobile || ''));

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail('Enter a valid email address.', 422);
  if (password.length < 8) return fail('Password must be at least 8 characters.', 422);
  // Login requires this number, so a malformed or missing one would lock the account out.
  if (!/^[6-9]\d{9}$/.test(mobile)) return fail('Enter a valid 10-digit mobile number.', 422);
  if (!codeMatches(String(body.code || ''))) {
    return fail(
      process.env.SUPER_ADMIN_BOOTSTRAP_CODE
        ? 'Bootstrap code is incorrect.'
        : 'Bootstrap is not configured on this server. Set SUPER_ADMIN_BOOTSTRAP_CODE, restart, then retry.',
      403
    );
  }

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return fail((err as Error).message, 500);
  }

  try {
    const { count: adminCount } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true });
    if ((adminCount || 0) > 0) return fail('Super Admin already exists. This setup route is closed.', 403);

    const { count: roleCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin');
    if ((roleCount || 0) > 0) return fail('Super Admin already exists. This setup route is closed.', 403);

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: mobile ? { role: 'admin', admin_mobile: mobile } : { role: 'admin' },
    });
    if (createError || !created?.user) {
      return fail(createError?.message || 'Could not create the Super Admin account.', 500);
    }

    const { error: adminRowError } = await supabase
      .from('admin_users')
      .insert({ user_id: created.user.id, email, name: name || 'Super Admin', role: 'admin' });
    if (adminRowError) {
      await supabase.auth.admin.deleteUser(created.user.id).catch(() => undefined);
      return fail(adminRowError.message, 500);
    }

    // profiles.mobile is unique and a Super Admin may reuse a number that a
    // customer account already holds, so fall back to a placeholder row and
    // keep the real number in app_metadata (service-role writes only).
    const profileRow = (mobileValue: string) => ({
      id: created.user.id,
      mobile: mobileValue,
      full_name: name || 'Super Admin',
      email,
      role: 'super_admin',
      is_active: true,
      status: 'active',
    });

    let profile = await supabase.from('profiles').upsert(profileRow(mobile || `admin-${created.user.id.slice(0, 8)}`), {
      onConflict: 'id',
    });
    if (profile.error && mobile) {
      profile = await supabase
        .from('profiles')
        .upsert(profileRow(`admin-${created.user.id.slice(0, 8)}`), { onConflict: 'id' });
    }
    if (profile.error) {
      await supabase.auth.admin.deleteUser(created.user.id).catch(() => undefined);
      await supabase.from('admin_users').delete().eq('user_id', created.user.id);
      return fail(profile.error.message, 500);
    }

    await writeAuditLog({
      action: 'super_admin.provisioned',
      performedBy: created.user.id,
      targetId: created.user.id,
      metadata: { email },
    });

    return NextResponse.json({ success: true, userId: created.user.id });
  } catch (err) {
    return fail((err as Error).message || 'Server error', 500);
  }
}

export async function GET() {
  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return fail((err as Error).message, 500);
  }
  const { count: adminCount } = await supabase.from('admin_users').select('id', { count: 'exact', head: true });
  return NextResponse.json({
    success: true,
    needsBootstrap: (adminCount || 0) === 0,
    codeConfigured: Boolean(process.env.SUPER_ADMIN_BOOTSTRAP_CODE),
  });
}
