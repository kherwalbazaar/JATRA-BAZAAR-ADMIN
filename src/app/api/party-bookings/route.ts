import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { isAuthorizedAdminRequest } from '@/lib/partyBookingAccess';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function serviceKeyMissing(err: unknown): boolean {
  return (err as Error & { missingKey?: boolean })?.missingKey === true;
}

export async function GET(request: NextRequest) {
  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    if (serviceKeyMissing(err)) {
      return fail(
        'SUPABASE_SERVICE_ROLE_KEY is missing in .env.local. Add your Supabase service_role key to use Party Booking.',
        500
      );
    }
    return fail((err as Error).message, 500);
  }

  const { searchParams } = new URL(request.url);
  const partyId = String(searchParams.get('party_id') || '').trim();
  const statusParam = String(searchParams.get('status') || 'Confirmed').trim();
  const from = String(searchParams.get('from') || '').trim();
  const to = String(searchParams.get('to') || '').trim();
  const includeHistory = searchParams.get('history') === '1';

  // Cancelled rows are admin history — only released with the admin header.
  const isAdmin = isAuthorizedAdminRequest(request);
  let status = 'Confirmed';
  if (isAdmin) {
    if (statusParam === 'all' || includeHistory) status = 'all';
    else if (statusParam === 'Cancelled') status = 'Cancelled';
  }

  try {
    let query = supabase
      .from('party_bookings')
      .select('*')
      .order('booking_date', { ascending: false })
      .limit(2000);

    if (status !== 'all') query = query.eq('status', status);

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
  if (!isAuthorizedAdminRequest(request)) {
    return fail('Unauthorized: admin key header missing.', 401);
  }

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    if (serviceKeyMissing(err)) {
      return fail(
        'SUPABASE_SERVICE_ROLE_KEY is missing in .env.local. Add your Supabase service_role key to use Party Booking.',
        500
      );
    }
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
  const createdBy = String(body.createdBy || 'super_admin').trim();

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

  const committeeId =
    String(body.committeeId || '').trim() ||
    `committee-${committeeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

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
        committee_name: committeeName,
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

    return NextResponse.json({ success: true, booking });
  } catch (err) {
    return fail((err as Error).message || 'Server error', 500);
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return fail('Unauthorized: admin key header missing.', 401);
  }

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    if (serviceKeyMissing(err)) {
      return fail(
        'SUPABASE_SERVICE_ROLE_KEY is missing in .env.local. Add your Supabase service_role key to use Party Booking.',
        500
      );
    }
    return fail((err as Error).message, 500);
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  const action = String(body.action || 'cancel').trim().toLowerCase();

  if (!id) return fail('Booking id is required.');
  if (action !== 'cancel') return fail(`Unsupported action "${action}".`);

  try {
    const { data: booking, error } = await supabase
      .from('party_bookings')
      .update({
        status: 'Cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'Confirmed')
      .select('*')
      .maybeSingle();

    if (error) return fail(error.message, 500);
    if (!booking) return fail('Booking not found or already cancelled.', 404);

    return NextResponse.json({ success: true, booking });
  } catch (err) {
    return fail((err as Error).message || 'Server error', 500);
  }
}
