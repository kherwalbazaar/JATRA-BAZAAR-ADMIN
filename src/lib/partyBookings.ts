import { PartyBookingRecord } from '@/types';
import { sb } from './supabase-db';
import { PARTY_BOOKING_ADMIN_HEADER, PARTY_BOOKING_ADMIN_HEADER_VALUE } from './partyBookingAccess';

/**
 * Live updates for party_bookings. Any INSERT/UPDATE anywhere re-triggers a
 * refetch; the callback receives the event so callers can scope work.
 * Returns an unsubscribe function; safe against double-subscribe because a
 * fresh unique channel is created per call.
 */
export function subscribeToPartyBookings(
  onChange: (payload: { eventType: string; new: Record<string, unknown> | null; old: Record<string, unknown> | null }) => void
): () => void {
  const channelName = `party-bookings-live-${Date.now()}`;
  const channel = sb
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'party_bookings' },
      (msg: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
        onChange({ eventType: msg.eventType, new: msg.new || null, old: msg.old || null });
      }
    )
    .subscribe();

  return () => {
    try {
      sb.removeChannel(channel);
    } catch {
      /* ignore */
    }
  };
}
export interface CreatePartyBookingInput {
  partyId: string;
  partyName: string;
  committeeId?: string;
  committeeName: string;
  committeeAddress?: string;
  eventName: string;
  eventAddress: string;
  contactNumber?: string;
  bookingDate: string; // YYYY-MM-DD
  remarks?: string;
  createdBy?: string;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string') return body.error;
    if (body && typeof body.message === 'string') return body.message;
    return `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function fetchPartyBookings(params: {
  partyId?: string;
  status?: 'Confirmed' | 'Cancelled' | 'all';
  from?: string;
  to?: string;
  history?: boolean;
}): Promise<PartyBookingRecord[]> {
  const qs = new URLSearchParams();
  if (params.partyId) qs.set('party_id', params.partyId);
  if (params.status && params.status !== 'all') qs.set('status', params.status);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.history) qs.set('history', '1');
  const res = await fetch(`/api/party-bookings?${qs.toString()}`, {
    cache: 'no-store',
    headers: { [PARTY_BOOKING_ADMIN_HEADER]: PARTY_BOOKING_ADMIN_HEADER_VALUE },
  });
  if (!res.ok) throw new Error(await parseError(res));
  const body = await res.json();
  return (body.bookings || []) as PartyBookingRecord[];
}

export async function createPartyBooking(
  input: CreatePartyBookingInput
): Promise<PartyBookingRecord> {
  const res = await fetch('/api/party-bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [PARTY_BOOKING_ADMIN_HEADER]: PARTY_BOOKING_ADMIN_HEADER_VALUE,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const body = await res.json();
  return body.booking as PartyBookingRecord;
}

export async function cancelPartyBooking(id: string): Promise<PartyBookingRecord> {
  const res = await fetch('/api/party-bookings', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      [PARTY_BOOKING_ADMIN_HEADER]: PARTY_BOOKING_ADMIN_HEADER_VALUE,
    },
    body: JSON.stringify({ id, action: 'cancel' }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const body = await res.json();
  return body.booking as PartyBookingRecord;
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function committeeIdFor(name: string): string {
  return `committee-${String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
}
