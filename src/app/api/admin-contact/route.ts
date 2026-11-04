import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { requireSuperAdmin } from '@/lib/admin-auth/authorizer';
import { writeAuditLog } from '@/lib/admin-auth/audit';

export const dynamic = 'force-dynamic';

const SETTINGS_ID = 'admin_contact';

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function clean(value: unknown, max = 160): string {
  return String(value ?? '').trim().slice(0, max);
}

function shapeContact(data: Record<string, unknown> | null | undefined) {
  const row = data || {};
  return {
    contactName: clean(row.contactName),
    primaryMobile: clean(row.primaryMobile, 20).replace(/[^\d+]/g, ''),
    whatsappNumber: clean(row.whatsappNumber, 20).replace(/[^\d+]/g, ''),
    supportEmail: clean(row.supportEmail).toLowerCase(),
    supportMessage: clean(row.supportMessage, 400),
  };
}

export type AdminContact = ReturnType<typeof shapeContact>;

/**
 * Read is intentionally open: the committee waiting and rejection pages must be
 * able to show a way to reach the admin before anyone is approved.
 */
export async function GET() {
  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return fail((err as Error).message, 500);
  }

  const { data, error } = await supabase.from('settings').select('data').eq('id', SETTINGS_ID).maybeSingle();
  if (error) return fail(error.message, 500);

  return NextResponse.json({ success: true, contact: shapeContact(data?.data as Record<string, unknown>) });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return fail(auth.error, auth.status);

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return fail((err as Error).message, 500);
  }

  const body = await request.json().catch(() => ({}));
  const contact = shapeContact(body);

  if (contact.primaryMobile && !/^\+?\d{10,15}$/.test(contact.primaryMobile)) {
    return fail('Primary mobile must be 10-15 digits, optionally with a country code.', 422);
  }
  if (contact.whatsappNumber && !/^\+?\d{10,15}$/.test(contact.whatsappNumber)) {
    return fail('WhatsApp number must be 10-15 digits, optionally with a country code.', 422);
  }
  if (contact.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.supportEmail)) {
    return fail('Support email is not valid.', 422);
  }

  const { error } = await supabase.from('settings').upsert(
    {
      id: SETTINGS_ID,
      key: SETTINGS_ID,
      description: 'Admin Contact Information',
      data: contact,
      updated_by: auth.session.userId,
    },
    { onConflict: 'id' }
  );
  if (error) return fail(error.message, 500);

  await writeAuditLog({
    action: 'settings.admin_contact_updated',
    performedBy: auth.session.userId,
    targetId: SETTINGS_ID,
    metadata: { contact },
  });

  return NextResponse.json({ success: true, contact });
}
