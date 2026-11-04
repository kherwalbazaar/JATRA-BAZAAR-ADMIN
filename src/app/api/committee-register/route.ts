import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import {
  normaliseEmail,
  normaliseMobile,
  validateCommitteeRegistration,
  buildApplicationRef,
  type CommitteeRegistrationInput,
} from '@/lib/committee-registration';
import { writeAuditLog } from '@/lib/admin-auth/audit';

export const dynamic = 'force-dynamic';

function fail(error: string, status = 400, fields?: Record<string, string>) {
  return NextResponse.json({ success: false, error, fields }, { status });
}

/**
 * Public committee self-registration. Creates a Supabase Auth account and a
 * PENDING application with zero permissions — approval is the only path to the
 * dashboard, and Super Admin is never produced here.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as CommitteeRegistrationInput;

  const errors = validateCommitteeRegistration(body);
  if (Object.keys(errors).length > 0) {
    return fail('Please correct the highlighted fields.', 422, errors);
  }

  const email = normaliseEmail(body.email);
  const mobile = normaliseMobile(body.primaryMobile);

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return fail((err as Error).message, 500);
  }

  try {
    const { data: takenEmail, error: emailCheckError } = await supabase
      .from('committees')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (emailCheckError) return fail(emailCheckError.message, 500);
    if (takenEmail) return fail('This email has already been used to register a committee.', 409, {
      email: 'Email already registered.',
    });

    const { data: takenMobile } = await supabase
      .from('committees')
      .select('id')
      .eq('primary_mobile', mobile)
      .maybeSingle();
    if (takenMobile) {
      return fail('This mobile number already has a committee application.', 409, {
        primaryMobile: 'Mobile already registered.',
      });
    }

    // Supabase Auth owns the password; only a salted hash is stored, never the
    // plain text. email_confirm keeps the review workflow (not an inbox click)
    // as the gate, which is what approval-by-Super-Admin means here.
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
    });
    if (createError || !created?.user) {
      const message = String(createError?.message || '');
      if (/already registered|already exists/i.test(message)) {
        return fail('This email already has an account. Use a different address.', 409, {
          email: 'Email already registered.',
        });
      }
      return fail(message || 'Could not create the committee account.', 500);
    }

    const applicationRef = buildApplicationRef();
    const { data: committee, error: committeeError } = await supabase
      .from('committees')
      .insert({
        user_id: created.user.id,
        application_ref: applicationRef,
        committee_name: body.committeeName.trim(),
        primary_mobile: mobile,
        address: body.address.trim(),
        email,
        event_date: body.eventDate.trim(),
        application_status: 'PENDING',
      })
      .select('id, application_ref')
      .single();

    if (committeeError || !committee) {
      // Leave no orphaned auth account behind a half-written application.
      await supabase.auth.admin.deleteUser(created.user.id).catch(() => undefined);
      return fail(committeeError?.message || 'Could not save the committee application.', 500);
    }

    // Best effort: a duplicate customer mobile must not block a valid panel
    // application, and the committees row is the source of truth either way.
    await supabase.from('profiles').upsert(
      {
        id: created.user.id,
        mobile,
        full_name: body.committeeName.trim(),
        email,
        role: 'committee',
        is_active: false,
        status: 'pending',
      },
      { onConflict: 'id' }
    );

    await writeAuditLog({
      action: 'committee.registered',
      performedBy: created.user.id,
      targetId: committee.id,
      metadata: { applicationRef: committee.application_ref, committeeName: body.committeeName.trim(), email },
    });

    return NextResponse.json({
      success: true,
      applicationRef: committee.application_ref,
      committeeId: committee.id,
    });
  } catch (err) {
    return fail((err as Error).message || 'Registration failed.', 500);
  }
}
