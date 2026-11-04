import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { requireModule } from '@/lib/admin-auth/authorizer';
import { writeAuditLog } from '@/lib/admin-auth/audit';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function GET(request: NextRequest) {
  const auth = await requireModule('party-booking', 'view');
  if (!auth.ok) return fail(auth.error, auth.status);

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return fail((err as Error).message, 500);
  }

  const { searchParams } = new URL(request.url);
  const partyId = String(searchParams.get('party_id') || '').trim();
  const statusParam = String(searchParams.get('status') || 'Confirmed').trim();
  const from = String(searchParams.get('from') || '').trim();
  const to = String(searchParams.get('to') || '').trim();
  const includeHistory = searchParams.get('history') === '1';

  // Cancelled rows are panel history; the caller is already authorised here.
  let status = 'Confirmed';
  if (statusParam === 'all' || includeHistory) status = 'all';
  else if (statusParam === 'Cancelled') status = 'Cancelled';

  try {
    let query = supabase
      .from('party_bookings')
      .select('*')
      .order('booking_date', { ascending: false })
      .limit(2000);

    if (status !== 'all') query = query.eq('status', status);

    // A committee reading this list is scoped to its own bookings; the row it
    // belongs to is decided by the session, never by the query string.
    if (!auth.session.isSuperAdmin && auth.session.committee) {
      query = query.eq('committee_id', `committee-${auth.session.committee.id}`);
    }

    if (partyId) query = query.eq('party_id', partyId);
    if (DATE_RE.test(from)) query = query.gte('booking_date', from);
    if (DATE_RE.test(to)) query = query.lte('booking_date', to);

    const { data, error } = await query;
    if (error) return fail(error.message, 500);

    return NextResponse.json({ success: true, bookings: data || [] });
  } catch (err) {
    return fail((err as Error).message || 'Server error', 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireModule('party-booking', 'create');
  if (!auth.ok) return fail(auth.error, auth.status);

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return fail((err as Error).message, 500);
  }

  const body = await request.json().catch(() => ({}));

  const partyId = String(body.partyId || '').trim();
  const partyName = String(body.partyName || '').trim();
  const committeeName = String(body.committeeName || '').trim();
  const committeeAddress = String(body.committeeAddress || '').trim();
  const eventName = String(body.eventName || '').trim();
  const eventAddress = String(body.eventAddress || '').trim();
  const contactNumber = String(body.contactNumber || '').trim();
  const bookingDate = String(body.bookingDate || '').trim();
  const remarks = String(body.remarks || '').trim();

  if (!partyId) return fail('Party selection is compulsory.');
  if (!partyName) return fail('Party name is missing for the selected party.');
  if (!DATE_RE.test(bookingDate)) return fail('A valid booking date (YYYY-MM-DD) is compulsory.');
  if (!committeeName) return fail('Committee selection is compulsory.');
  if (!eventName) return fail('Programme / Event name is compulsory.');
  if (!eventAddress) return fail('Programme address / venue is compulsory.');

  const year = Number(bookingDate.slice(0, 4));
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return fail('Booking date is out of range.');
  }

  // A committee books only as itself — the session decides this, not the body.
  const actingCommittee = auth.session.isSuperAdmin ? null : auth.session.committee;
  const resolvedCommitteeName = actingCommittee
    ? actingCommittee.committeeName
    : committeeName;

  const committeeId =
    actingCommittee
      ? `committee-${actingCommittee.id}`
      : String(body.committeeId || '').trim() ||
        `committee-${resolvedCommitteeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

  const createdBy = actingCommittee
    ? `committee:${actingCommittee.applicationRef}`
    : auth.session.isSuperAdmin
      ? 'super_admin'
      : auth.session.userId;

  try {
    // Validate the party reference against the parties directory.
    const { data: settingsRow, error: settingsError } = await supabase
      .from('settings')
      .select('id, data')
      .eq('id', 'parties')
      .maybeSingle();
    if (settingsError) return fail(`Party validation failed: ${settingsError.message}`, 500);

    const directory: { id?: string; name?: string }[] =
      (settingsRow?.data?.parties as typeof directory) || [];
    const knownIds = new Set(directory.map((p) => String(p.id || '')));
    const knownNames = new Set(
      directory.map((p) => String(p.name || '').trim().toUpperCase()).filter(Boolean)
    );
    const isSeeded =
      ['party-adim-owar-jarpa', 'party-ramraj-gayan-mohal'].includes(partyId) ||
      ['ADIM OWAR JARPA OPERA', 'RAMRAJ GAYAN MOHAL'].includes(partyName.toUpperCase());
    if (!knownIds.has(partyId) && !knownNames.has(partyName.toUpperCase()) && !isSeeded) {
      return fail(`Party "${partyName}" was not found in the registered parties directory.`, 400);
    }

    const { data: booking, error } = await supabase
      .from('party_bookings')
      .insert({
        party_id: partyId,
        party_name: partyName,
        committee_id: committeeId,
        committee_name: resolvedCommitteeName,
        committee_address: committeeAddress || null,
        event_name: eventName,
        event_address: eventAddress,
        contact_number: contactNumber || null,
        booking_date: bookingDate,
        status: 'Confirmed',
        remarks: remarks || null,
        created_by: createdBy,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return fail(
          `This party is already booked on ${bookingDate}. Duplicate confirmed bookings are not allowed.`,
          409
        );
      }
      return fail(error.message, 500);
    }

    await writeAuditLog({
      action: 'party_booking.created',
      performedBy: auth.session.userId,
      targetId: String(booking.id),
      metadata: { partyName, committeeName: resolvedCommitteeName, bookingDate, eventName, createdBy },
    });

    return NextResponse.json({ success: true, booking });
  } catch (err) {
    return fail((err as Error).message || 'Server error', 500);
  }
}

export async function PATCH(request: NextRequest) {
  // Cancelling is the approve-level right, so a plain viewer cannot erase a
  // confirmed slot.
  const auth = await requireModule('party-booking', 'approve');
  if (!auth.ok) return fail(auth.error, auth.status);

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return fail((err as Error).message, 500);
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  const action = String(body.action || 'cancel').trim().toLowerCase();

  if (!id) return fail('Booking id is required.');
  if (action !== 'cancel') return fail(`Unsupported action "${action}".`);

  try {
    let cancelQuery = supabase
      .from('party_bookings')
      .update({
        status: 'Cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'Confirmed');

    // A committee may cancel only a slot it booked itself.
    if (!auth.session.isSuperAdmin && auth.session.committee) {
      cancelQuery = cancelQuery.eq('committee_id', `committee-${auth.session.committee.id}`);
    }

    const { data: booking, error } = await cancelQuery.select('*').maybeSingle();

    if (error) return fail(error.message, 500);
    if (!booking) return fail('Booking not found or already cancelled.', 404);

    await writeAuditLog({
      action: 'party_booking.cancelled',
      performedBy: auth.session.userId,
      targetId: id,
      metadata: {
        partyName: booking.party_name,
        committeeName: booking.committee_name,
        bookingDate: booking.booking_date,
      },
    });

    return NextResponse.json({ success: true, booking });
  } catch (err) {
    return fail((err as Error).message || 'Server error', 500);
  }
}
