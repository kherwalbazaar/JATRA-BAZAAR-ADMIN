import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  runTransaction,
  writeBatch,
  collectionGroup,
  arrayUnion,
  serverTimestamp,
  Unsubscribe,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, FIRESTORE_COLLECTIONS } from './firebase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  sbMirrorBooking,
  sbMirrorBookingUpdate,
  sbMirrorTicket,
  sbMirrorTicketUpdate,
  sbSeatUpdateSync,
  sbUpsertMany,
  sbMirrorEvent,
  sbMirrorEventUpdate,
  sbMirrorTicketType,
  sbMirrorTicketTypeUpdate,
  sbMirrorScannerMember,
  sbMirrorScannerMemberUpdate,
  sbMirrorTicketEntry,
  sbMirrorTicketEntryUpdate,
  sbMirrorGate,
  sbMirrorGateUpdate,
  sbMirrorCounter,
  sbMirrorCounterUpdate,
  sbMirrorBlockCategories,
  sbMirrorSettings,
  sbMirrorAuditLog,
  sbMirrorDelete,
  sb,
  sbUpdate,
} from './supabase-db';
import { BlockCategory } from '@/lib/blockCategories';
import {
  EventItem,
  TicketType,
  BookingItem,
  GateInfo,
  CounterBooth,
  ScannerMember,
  TicketEntry,
  AuditLog,
  Seat,
  TicketItem,
  IdentifiedBooking,
  BatchEntryResult,
  ScanResult,
} from '@/types';

const C = FIRESTORE_COLLECTIONS;

// ─── Generic helpers ──────────────────────────────────────────────

function colRef(name: string) {
  return collection(db, name);
}

function docRef(name: string, id: string) {
  return doc(db, name, id);
}

/** Recursively remove undefined values so Firestore setDoc / updateDoc does not throw. */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const res: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        res[key] = stripUndefined(value);
      }
    }
    return res as T;
  }
  return obj;
}

/** Safely write to Firestore with undefined stripped and errors swallowed. */
export function safeSetDoc(ref: any, data: any, options?: any): Promise<void> {
  return Promise.resolve(setDoc(ref, stripUndefined(data), options)).then(
    () => {},
    () => {}
  );
}

export function mapSupabaseBooking(row: Record<string, any>): BookingItem {
  const seats = Array.isArray(row.seats) ? row.seats.map(String) : [];
  const quantity = Number(row.quantity) || (seats.length > 0 ? seats.length : 1);
  const amount = Number(row.amount) || Number(row.final_customer_amount) || Number(row.ticket_amount) || 0;
  const statusRaw = String(row.status || row.booking_status || 'Confirmed');
  let status: BookingItem['status'] = 'Confirmed';
  if (/cancel/i.test(statusRaw)) status = 'Cancelled';
  else if (/refund/i.test(statusRaw)) status = 'Refunded';
  else if (/check.*in/i.test(statusRaw)) status = 'Checked-in';
  else status = 'Confirmed';

  const docId = String(row.id || row.ticket_number || '');
  const bookingId = String(row.ticket_number || row.booking_id || docId);
  const showId = String(row.show_id || row.event_id || '');
  const eventId = String(row.event_id || row.show_id || '');

  return {
    id: docId,
    bookingId: bookingId,
    showId: showId,
    eventId: eventId,
    eventName: String(row.event_name || ''),
    ticketNumber: bookingId,
    customerName: String(row.customer_name || 'Walk-in'),
    customerPhone: String(row.customer_phone || ''),
    customerEmail: row.customer_email ? String(row.customer_email) : '',
    ticketTypeId: String(row.ticket_type_id || ''),
    ticketTypeName: String(row.ticket_type_name || 'Standard'),
    quantity: quantity,
    unitPrice: Number(row.unit_price) || 0,
    ticketAmount: Number(row.ticket_amount) || (Number(row.unit_price) || 0) * quantity,
    baseAmount: Number(row.base_amount) || Number(row.ticket_amount) || 0,
    convenienceFee: Number(row.convenience_fee) || 0,
    gstOnConvenienceFee: Number(row.gst_on_convenience_fee) || 0,
    platformCharge: Number(row.platform_charge) || 0,
    totalFees: Number(row.total_fees) || 0,
    amount: amount,
    finalCustomerAmount: Number(row.final_customer_amount) || amount,
    date: String(row.date || (row.created_at ? String(row.created_at).split('T')[0] : '')),
    time: String(row.time || ''),
    source: (row.source as any) || 'Online',
    paymentMethod: (row.payment_method as any) || 'UPI',
    transactionId: String(row.transaction_id || row.gateway_transaction_id || ''),
    status: status,
    bookingStatus: status === 'Cancelled' ? 'Cancelled' : 'Confirmed',
    assignedGate: String(row.assigned_gate || ''),
    block: String(row.block || (seats.length > 0 ? seats[0].split('-')[0] : '')),
    seats: seats,
    seatCount: Number(row.seat_count) || quantity,
    seatNumber: row.seat_number ? String(row.seat_number) : seats.join(', '),
    enteredCount: Number(row.entered_count) || 0,
    remainingCount: Number(row.remaining_count ?? (quantity - (Number(row.entered_count) || 0))),
    usedTickets: Array.isArray(row.used_tickets) ? row.used_tickets.map(String) : [],
    usedSeats: Array.isArray(row.used_seats) ? row.used_seats.map(String) : [],
    usedCount: Number(row.used_count) || 0,
    usedAt: row.used_at ? String(row.used_at) : undefined,
    paymentStatus: (row.payment_status as any) || 'Successful',
    paymentChannel: row.payment_channel === 'Counter' ? 'Counter' : 'Online',
    gatewayTransactionId: String(row.gateway_transaction_id || row.transaction_id || ''),
    paymentDate: String(row.payment_date || row.created_at || ''),
    ticketIds: Array.isArray(row.ticket_ids) ? row.ticket_ids.map(String) : [],
    counterName: row.counter_name ? String(row.counter_name) : '',
    otherCharges: Number(row.other_charges) || 0,
    gatewayFee: Number(row.gateway_fee) || 0,
    actualCost: Number(row.actual_cost) || 0,
    profit: Number(row.profit) || 0,
    createdAt: String(row.created_at || (row.date ? `${row.date}T${row.time || '00:00:00'}` : new Date().toISOString())),
  };
}

export function mapSupabaseSeat(row: Record<string, any>): Seat {
  const parts = String(row.seat_id || row.id || '').split('_').pop()?.split('-') || [];
  const block = String(row.block_id || row.block || (parts.length >= 3 ? parts[0] : '')).trim().toUpperCase();
  const rowId = String(row.row_id || row.row || (parts.length >= 3 ? parts[1] : parts.length === 2 ? parts[0] : '')).trim().toUpperCase();
  const seatNumber = Number(row.seat_number || row.number) || (parts.length >= 3 ? Number(parts[2]) : parts.length === 2 ? Number(parts[1]) : 0);
  const canonicalId = String(row.seat_id || `${block}-${rowId}-${seatNumber}`);
  const eventId = String(row.event_id || row.show_id || '');

  return {
    id: canonicalId,
    eventId: eventId,
    blockId: block,
    rowId: rowId,
    seatNumber: seatNumber,
    seatLabel: String(row.seat_label || `${rowId}${seatNumber}`),
    status: (row.status || 'available') as Seat['status'],
    price: Number(row.price) || 0,
    bookingId: row.booking_id ? String(row.booking_id) : null,
    bookedAt: row.booked_at ? String(row.booked_at) : null,
    reservedAt: row.reserved_at ? String(row.reserved_at) : null,
    reservedBy: row.reserved_by ? String(row.reserved_by) : null,
    createdAt: String(row.created_at || ''),
  };
}

export function mapSupabaseTicket(row: Record<string, any>): TicketItem {
  return {
    id: String(row.id || row.ticket_id || ''),
    ticketId: String(row.ticket_id || row.id || ''),
    bookingId: String(row.booking_id || ''),
    bookingDocId: String(row.booking_doc_id || ''),
    ticketIndex: Number(row.ticket_index) || 1,
    totalTickets: Number(row.total_tickets) || 1,
    eventId: String(row.event_id || row.show_id || ''),
    eventName: String(row.event_name || ''),
    ticketTypeId: String(row.ticket_type_id || ''),
    ticketTypeName: String(row.ticket_type_name || ''),
    seat: String(row.seat || ''),
    seatIndex: Number(row.seat_index) || 1,
    seatCount: Number(row.seat_count) || 1,
    block: String(row.block || ''),
    assignedGate: String(row.assigned_gate || ''),
    customerName: String(row.customer_name || ''),
    customerPhone: String(row.customer_phone || ''),
    serialNumber: String(row.serial_number || row.id || ''),
    qrToken: String(row.qr_token || ''),
    status: (row.status || 'ACTIVE') as any,
    date: String(row.date || ''),
    time: String(row.time || ''),
    unitPrice: Number(row.unit_price) || 0,
    scannedAt: row.scanned_at ? String(row.scanned_at) : null,
    scannedBy: row.scanned_by ? String(row.scanned_by) : null,
    scannerMemberId: row.scanner_member_id ? String(row.scanner_member_id) : null,
    scannerMemberName: row.scanner_member_name ? String(row.scanner_member_name) : null,
    scanGateId: row.scan_gate_id ? String(row.scan_gate_id) : null,
    scanDate: row.scan_date ? String(row.scan_date) : null,
    scanTime: row.scan_time ? String(row.scan_time) : null,
    createdAt: String(row.created_at || ''),
  };
}

// ─── Events ───────────────────────────────────────────────────────

// "Create New Event" form structure — stored in settings/createEventFormat
export const CREATE_EVENT_FORM_FORMAT = {
  id: 'createEventFormat',
  name: 'Create New Event',
  version: 7,
  collection: C.EVENTS,
  sections: [
    {
      n: 1,
      title: 'Event Details',
      fields: [
        { key: 'committeeName', label: 'Committee Name', type: 'text', required: false, placeholder: 'e.g. Jatra Bazaar Committee' },
        { key: 'committeeLocation', label: 'Committee Location', type: 'text', required: false, placeholder: 'e.g. Khunta, Mayurbhanj, Odisha' },
        { key: 'partyName', label: 'Party Name', type: 'text', required: false, placeholder: 'e.g. ADIM OWAR JARPA OPERA' },
        { key: 'title', label: 'Story Name', type: 'text', required: true, placeholder: 'e.g. Okoy Hirla rechom Bagiyanj Kan' },
        { key: 'eventTitle', label: 'Event Title', type: 'text', required: true, placeholder: 'e.g. PARBON PATA' },
        { key: 'language', label: 'Language', type: 'select', required: false, default: 'Santali', options: ['Santali', 'Odia', 'Hindi', 'Bengali', 'English'] },
        { key: 'audience', label: 'Audience', type: 'select', required: false, options: ['All Ages', 'Family', 'Kids (Below 12)', 'Teenagers (13-17)', 'Adults (18+)', 'Senior Citizens (60+)', 'Students', 'General', 'Other'] },
        { key: 'saleMode', label: 'Ticket Selling', type: 'select', required: true, default: 'Counter', options: ['Online', 'Counter'] },
        { key: 'date', label: 'Event Date', type: 'date-group', required: true, fields: [
          { key: 'dayOfMonth', label: 'Day', type: 'select', options: '1-31' },
          { key: 'month', label: 'Month', type: 'select', options: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
          { key: 'year', label: 'Year', type: 'select', options: 'currentYear-2 .. currentYear+6' },
        ] },
        { key: 'description', label: 'About', type: 'textarea', required: false, placeholder: 'e.g. Grand folk opera theater with live orchestral music.' },
      ],
    },
    {
      n: 2,
      title: 'Date & Time',
      fields: [
        { key: 'entryTime', label: 'Gate Entry', type: 'time-select', required: false, note: '12-hour format, 30-minute intervals' },
        { key: 'startTime', label: 'Event Start', type: 'time-select', required: false, note: '12-hour format, 30-minute intervals' },
        { key: 'endTime', label: 'End Time', type: 'time-select', required: false, note: '12-hour format, 30-minute intervals' },
        { key: 'duration', label: 'Duration (auto)', type: 'readonly', computed: 'end - start (handles overnight)' },
      ],
    },
    {
      n: 3,
      title: 'Party Contact Details',
      fields: [
        { key: 'address', label: 'Address', type: 'text', required: true, placeholder: 'e.g. At/PO Khunta, Mayurbhanj, Odisha', alsoSavedAs: 'venue' },
        { key: 'phone', label: 'Phone Number', type: 'tel', required: false, placeholder: 'e.g. +91 98765 43210' },
      ],
    },
    {
      n: 4,
      title: 'Cast & Crew',
      fields: [
        { key: 'actors', label: 'Actors', type: 'list', repeatable: true, itemFields: [
          { key: 'name', label: 'Actor Name', type: 'text', placeholder: 'e.g. Balakram Tudu' },
          { key: 'photo', label: 'Actor Photo', type: 'url', placeholder: 'e.g. https://example.com/actor.jpg' },
        ] },
      ],
    },
    {
      n: 5,
      title: 'Banner',
      fields: [
        { key: 'poster', label: 'Main Banner', type: 'url', required: false, placeholder: 'e.g. https://example.com/main-banner.jpg' },
        { key: 'additionalBanners', label: 'Additional Banners', type: 'list', repeatable: true, itemType: 'url', placeholder: 'e.g. https://example.com/banner-2.jpg' },
      ],
    },
    {
      n: 6,
      title: 'Creative',
      fields: [
        { key: 'writer', label: 'Writer', type: 'text', required: false, placeholder: 'e.g. Balakram Tudu' },
        { key: 'director', label: 'Director', type: 'text', required: false, placeholder: 'e.g. Dasarath Singh' },
        { key: 'musicDirector', label: 'Music Director', type: 'text', required: false, placeholder: 'e.g. Pandit Soren' },
        { key: 'singer', label: 'Singer', type: 'text', required: false, placeholder: 'e.g. Pandit Soren' },
      ],
    },
    {
      n: 7,
      title: 'Trailer',
      fields: [
        { key: 'trailerUrl', label: 'YouTube Trailer URL', type: 'url', required: false, placeholder: 'e.g. https://www.youtube.com/watch?v=...' },
      ],
    },
  ],
  autoComputedFields: ['date', 'day', 'time', 'duration'],
  updatedAt: '',
};

// Upsert the form format document to settings/createEventFormat
export async function saveEventFormFormat(): Promise<void> {
  const payload = {
    ...CREATE_EVENT_FORM_FORMAT,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(docRef(C.SETTINGS, 'createEventFormat'), payload, { merge: true });
  sbMirrorSettings('createEventFormat', payload);
}

// Read the form format document back from Firestore
export async function getEventFormFormat(): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(docRef(C.SETTINGS, 'createEventFormat'));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

// ─── Diagram block categories ─────────────────────────────────────
// Live list of block categories (name / enabled / channel flags).
export function listenBlockCategories(
  callback: (blocks: BlockCategory[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    colRef(C.BLOCK_CATEGORIES),
    (snap) => {
      const blocks = snap.docs.map((d) => ({ ...d.data(), id: d.id } as BlockCategory));
      blocks.sort((a, b) => {
        const ao = typeof (a as BlockCategory & { order?: number }).order === 'number'
          ? (a as BlockCategory & { order?: number }).order!
          : 999;
        const bo = typeof (b as BlockCategory & { order?: number }).order === 'number'
          ? (b as BlockCategory & { order?: number }).order!
          : 999;
        return ao - bo;
      });
      callback(blocks);
    },
    (err) => {
      console.warn('listenBlockCategories error:', err);
      onError?.(err);
    }
  );
}

// Replace the whole block category set (upsert current, delete removed).
export async function saveBlockCategories(blocks: BlockCategory[]): Promise<void> {
  const snap = await getDocs(colRef(C.BLOCK_CATEGORIES));
  const keep = new Set(blocks.map((b) => b.id));
  const batch = writeBatch(db);
  for (const d of snap.docs) {
    if (!keep.has(d.id)) batch.delete(d.ref);
  }
  blocks.forEach((b, index) => {
    const { id, ...rest } = b;
    batch.set(docRef(C.BLOCK_CATEGORIES, id), { ...rest, order: index });
  });
  await batch.commit();
  sbMirrorBlockCategories(blocks.map((b, index) => ({ ...b, order: index })));
}

export async function getEventsOnce(): Promise<EventItem[]> {
  try {
    const snap = await getDocs(colRef('shows'));
    if (!snap.empty) {
      const events = snap.docs.map((d) => ({ ...d.data(), id: d.id, showId: d.id, eventId: d.id } as unknown as EventItem));
      events.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      return events;
    }
  } catch (err) {
    console.warn('getEventsOnce shows failed, checking events:', err);
  }
  const snap = await getDocs(colRef(C.EVENTS));
  const events = snap.docs.map((d) => ({ ...d.data(), id: d.id, showId: d.id, eventId: d.id } as unknown as EventItem));
  events.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  return events;
}

export function listenEvents(
  callback: (events: EventItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  // Primary uniform schema: shows/{showId}
  const showsQuery = colRef('shows');
  let fallbackUnsub: Unsubscribe | null = null;
  let active = true;

  const unsub = onSnapshot(
    showsQuery,
    (snap) => {
      if (!active) return;
      if (!snap.empty) {
        if (fallbackUnsub) {
          fallbackUnsub();
          fallbackUnsub = null;
        }
        const events = snap.docs.map((d) => ({ ...d.data(), id: d.id, showId: d.id, eventId: d.id } as unknown as EventItem));
        events.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        callback(events);
      } else {
        // Fallback to legacy events if shows is empty
        if (!fallbackUnsub) {
          fallbackUnsub = onSnapshot(
            colRef(C.EVENTS),
            (evSnap) => {
              if (!active || !snap.empty) return;
              const events = evSnap.docs.map((d) => ({ ...d.data(), id: d.id, showId: d.id, eventId: d.id } as unknown as EventItem));
              events.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
              callback(events);
            },
            onError
          );
        }
      }
    },
    (err) => {
      console.warn('listenEvents shows error, trying events fallback:', err);
      if (!fallbackUnsub) {
        fallbackUnsub = onSnapshot(
          colRef(C.EVENTS),
          (evSnap) => {
            const events = evSnap.docs.map((d) => ({ ...d.data(), id: d.id, showId: d.id, eventId: d.id } as unknown as EventItem));
            events.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
            callback(events);
          },
          onError
        );
      }
    }
  );

  return () => {
    active = false;
    unsub();
    if (fallbackUnsub) fallbackUnsub();
  };
}

export async function addEvent(event: Omit<EventItem, 'id'>): Promise<string> {
  const payload: Record<string, unknown> = { ...event };
  delete payload.id;
  // Write to shows/{showId} as primary uniform schema
  const ref = await addDoc(colRef('shows'), payload as Omit<EventItem, 'id'>);
  const showId = ref.id;

  // Dual-write to events/{showId} for backwards compatibility
  try {
    await setDoc(docRef(C.EVENTS, showId), { ...payload, id: showId, showId, eventId: showId }, { merge: true });
    await updateDoc(docRef('shows', showId), { id: showId, showId, eventId: showId });
  } catch (e) {
    console.warn('Dual-sync notice:', e);
  }

  // Mirror to Supabase. Only `events` exists as a table; `public.shows` is a view
  // over it and rejects DML, so there is nothing to mirror there.
  sbMirrorEvent({ ...payload, id: showId, showId, eventId: showId });

  return showId;
}

export async function updateEvent(id: string, data: Partial<EventItem>): Promise<void> {
  const payload: Record<string, unknown> = { ...data };
  delete payload.id;
  // Update both shows and events
  await setDoc(docRef('shows', id), payload, { merge: true });
  try {
    await setDoc(docRef(C.EVENTS, id), payload, { merge: true });
  } catch (e) {
    console.warn('Dual-update notice:', e);
  }
  sbMirrorEventUpdate(id, payload);
}

export async function deleteEvent(id: string): Promise<void> {
  console.log('Attempting to delete show/event with ID:', id);
  try {
    await deleteDoc(docRef('shows', id));
  } catch (e) {
    console.warn('Delete from shows notice:', e);
  }
  try {
    await deleteDoc(docRef(C.EVENTS, id));
  } catch (e) {
    console.warn('Delete from events notice:', e);
  }
  sbMirrorDelete('events', id);
  console.log('Successfully deleted show/event:', id);
}

// ─── Ticket Types ─────────────────────────────────────────────────

export function listenTicketTypes(
  eventId: string,
  callback: (types: TicketType[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(colRef(C.TICKET_TYPES), where('eventId', '==', eventId));
  return onSnapshot(
    q,
    (snap) => {
      // Firestore doc id is the source of truth — never let a stored `id` field (e.g. TT-447) override it,
      // otherwise updates/deletes would target a non-existent document.
      const types = snap.docs.map((d) => ({ ...d.data(), id: d.id } as TicketType));
      callback(types);
    },
    (err) => {
      console.warn('listenTicketTypes error:', err);
      onError?.(err);
    }
  );
}

export async function addTicketType(type: Omit<TicketType, 'id'> & { eventId: string }): Promise<string> {
  // Don't persist a client-generated id (TT-xxx) — Firestore doc id is used everywhere.
  const { id: _clientId, ...rest } = type as TicketType & { eventId: string };
  const ref = await addDoc(colRef(C.TICKET_TYPES), rest);
  sbMirrorTicketType({ ...rest, id: ref.id });
  return ref.id;
}

export async function updateTicketType(id: string, data: Partial<TicketType>): Promise<void> {
  // Upsert: legacy/local ticket types (e.g. TT-447) may not exist in Firestore yet.
  await setDoc(docRef(C.TICKET_TYPES, id), data as Partial<TicketType>, { merge: true });
  sbMirrorTicketTypeUpdate(id, data as Record<string, unknown>);
}

export async function deleteTicketType(id: string): Promise<void> {
  await deleteDoc(docRef(C.TICKET_TYPES, id));
  sbMirrorDelete('ticket_types', id);
}

// ─── Bookings ─────────────────────────────────────────────────────

export function listenBookings(
  showIdOrEventId: string,
  callback: (bookings: BookingItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const targetId = String(showIdOrEventId || '').trim();
  const bookingsCol = colRef(C.BOOKINGS);

  const byShow = new Map<string, BookingItem>();
  const byEvent = new Map<string, BookingItem>();
  const bySupabase = new Map<string, BookingItem>();
  let showDone = false;
  let eventDone = false;
  let showError: Error | null = null;
  let eventError: Error | null = null;
  let disposed = false;

  const emit = () => {
    if (disposed) return;
    const merged = new Map<string, BookingItem>();
    byEvent.forEach((b, id) => merged.set(id, b));
    byShow.forEach((b, id) => merged.set(id, b));
    bySupabase.forEach((b, id) => {
      const existingKey = Array.from(merged.keys()).find(
        (k) => k === id || (b.ticketNumber && k === b.ticketNumber)
      );
      if (existingKey) {
        merged.set(existingKey, { ...merged.get(existingKey)!, ...b });
      } else {
        merged.set(id, b);
      }
    });
    const bookings = Array.from(merged.values());
    bookings.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA && timeB) return timeB - timeA;
      return (b.time || '').localeCompare(a.time || '');
    });
    callback(bookings);
  };

  // 1. Supabase initial fetch
  const sbQuery = targetId
    ? sb.from('bookings').select('*').or(`event_id.eq.${targetId},show_id.eq.${targetId}`).order('created_at', { ascending: false })
    : sb.from('bookings').select('*').order('created_at', { ascending: false });

  Promise.resolve(sbQuery)
    .then(({ data, error }: any) => {
      if (disposed) return;
      if (!error && Array.isArray(data)) {
        data.forEach((row) => {
          const b = mapSupabaseBooking(row);
          bySupabase.set(b.id, b);
          safeSetDoc(doc(colRef(C.BOOKINGS), b.id), b, { merge: true });
        });
        emit();
      }
    })
    .catch((err: any) => {
      console.warn('listenBookings Supabase initial fetch error:', err);
    });

  // 2. Supabase Realtime channel
  const channelName = `bookings-rt-${targetId || 'all'}-${Math.random().toString(36).slice(2, 9)}`;
  const channel = sb
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bookings' },
      (payload) => {
        if (disposed) return;
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as any)?.id;
          if (oldId) {
            bySupabase.delete(oldId);
            emit();
          }
        } else if (payload.new) {
          const row = payload.new as Record<string, unknown>;
          const matches = !targetId || row.event_id === targetId || row.show_id === targetId;
          if (matches) {
            const b = mapSupabaseBooking(row);
            bySupabase.set(b.id, b);
            safeSetDoc(doc(colRef(C.BOOKINGS), b.id), b, { merge: true });
            emit();
          }
        }
      }
    )
    .subscribe();

  // 3. Firestore listeners
  const handle = (
    which: 'show' | 'event',
    snap: { docs: { id: string; data: () => Record<string, unknown> }[] }
  ) => {
    if (disposed) return;
    const map = which === 'show' ? byShow : byEvent;
    map.clear();
    snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as BookingItem));
    if (which === 'show') showDone = true;
    else eventDone = true;
    emit();
  };

  const fail = (which: 'show' | 'event', err: Error) => {
    if (disposed) return;
    if (which === 'show') {
      showError = err;
      showDone = true;
    } else {
      eventError = err;
      eventDone = true;
    }
    if (byShow.size === 0 && byEvent.size === 0 && bySupabase.size === 0 && showError && eventError) {
      console.error('listenBookings error:', showError);
      onError?.(showError);
    }
    emit();
  };

  let unsubShow: Unsubscribe;
  let unsubEvent: Unsubscribe;

  if (targetId) {
    unsubShow = onSnapshot(
      query(bookingsCol, where('showId', '==', targetId), orderBy('createdAt', 'desc')),
      (snap) => handle('show', snap),
      (err) => fail('show', err)
    );
    unsubEvent = onSnapshot(
      query(bookingsCol, where('eventId', '==', targetId)),
      (snap) => handle('event', snap),
      (err) => fail('event', err)
    );
  } else {
    unsubShow = onSnapshot(
      query(bookingsCol, orderBy('createdAt', 'desc')),
      (snap) => handle('show', snap),
      (err) => fail('show', err)
    );
    unsubEvent = () => {};
    eventDone = true;
  }

  return () => {
    disposed = true;
    unsubShow();
    unsubEvent();
    sb.removeChannel(channel);
  };
}

// Streams bookings across every event — used by the Online History section.
export function listenAllBookings(
  callback: (bookings: BookingItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  let disposed = false;
  const fsMap = new Map<string, BookingItem>();
  const sbMap = new Map<string, BookingItem>();

  const emit = () => {
    if (disposed) return;
    const merged = new Map<string, BookingItem>();
    fsMap.forEach((b, id) => merged.set(id, b));
    sbMap.forEach((b, id) => {
      const existingKey = Array.from(merged.keys()).find(
        (k) => k === id || (b.ticketNumber && k === b.ticketNumber)
      );
      if (existingKey) {
        merged.set(existingKey, { ...merged.get(existingKey)!, ...b });
      } else {
        merged.set(id, b);
      }
    });

    const bookings = Array.from(merged.values());
    bookings.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA && timeB) return timeB - timeA;
      return (b.time || '').localeCompare(a.time || '');
    });
    callback(bookings);
  };

  // 1. Supabase initial fetch
  Promise.resolve(sb.from('bookings').select('*').order('created_at', { ascending: false }))
    .then(({ data, error }: any) => {
      if (disposed) return;
      if (!error && Array.isArray(data)) {
        data.forEach((row) => {
          const b = mapSupabaseBooking(row);
          sbMap.set(b.id, b);
          safeSetDoc(doc(colRef(C.BOOKINGS), b.id), b, { merge: true });
        });
        emit();
      }
    })
    .catch((err: any) => console.warn('listenAllBookings Supabase fetch error:', err));

  // 2. Supabase Realtime channel
  const channel = sb
    .channel(`all-bookings-${Math.random().toString(36).slice(2, 9)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bookings' },
      (payload) => {
        if (disposed) return;
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as any)?.id;
          if (oldId) {
            sbMap.delete(oldId);
            emit();
          }
        } else if (payload.new) {
          const b = mapSupabaseBooking(payload.new as Record<string, unknown>);
          sbMap.set(b.id, b);
          safeSetDoc(doc(colRef(C.BOOKINGS), b.id), b, { merge: true });
          emit();
        }
      }
    )
    .subscribe();

  // 3. Firestore onSnapshot
  const unsubFs = onSnapshot(
    colRef(C.BOOKINGS),
    (snap) => {
      if (disposed) return;
      fsMap.clear();
      snap.docs.forEach((d) => fsMap.set(d.id, { id: d.id, ...d.data() } as BookingItem));
      emit();
    },
    (err) => {
      console.warn('listenAllBookings error:', err);
      onError?.(err);
      emit();
    }
  );

  return () => {
    disposed = true;
    unsubFs();
    sb.removeChannel(channel);
  };
}

export async function getAllBookingsOnce(): Promise<BookingItem[]> {
  const merged = new Map<string, BookingItem>();
  try {
    const snap = await getDocs(colRef(C.BOOKINGS));
    snap.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() } as BookingItem));
  } catch (err) {
    console.warn('getAllBookingsOnce Firestore error:', err);
  }

  try {
    const { data, error }: any = await Promise.resolve(sb.from('bookings').select('*').order('created_at', { ascending: false }));
    if (!error && Array.isArray(data)) {
      data.forEach((row) => {
        const b = mapSupabaseBooking(row);
        const existingKey = Array.from(merged.keys()).find(
          (k) => k === b.id || (b.ticketNumber && k === b.ticketNumber)
        );
        if (existingKey) {
          merged.set(existingKey, { ...merged.get(existingKey)!, ...b });
        } else {
          merged.set(b.id, b);
        }
      });
    }
  } catch (err) {
    console.warn('getAllBookingsOnce Supabase error:', err);
  }

  const bookings = Array.from(merged.values());
  bookings.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA && timeB) return timeB - timeA;
    return (b.time || '').localeCompare(a.time || '');
  });
  return bookings;
}

/**
 * Synchronizes all bookings and tickets from Supabase into Firestore.
 * Seats are not backfilled — the seat map reads Supabase directly.
 */
export async function syncAllFromSupabase(): Promise<{ bookingsCount: number; ticketsCount: number; seatsCount: number }> {
  let bookingsCount = 0;
  let ticketsCount = 0;
  let seatsCount = 0;

  try {
    const { data: bData }: any = await Promise.resolve(sb.from('bookings').select('*'));
    if (Array.isArray(bData)) {
      for (const row of bData) {
        const b = mapSupabaseBooking(row);
        if (b.id) {
          await safeSetDoc(doc(colRef(C.BOOKINGS), b.id), b, { merge: true });
          bookingsCount++;
        }
      }
    }
  } catch (err) {
    console.warn('syncAllFromSupabase bookings error:', err);
  }

  try {
    const { data: tData }: any = await Promise.resolve(sb.from('tickets').select('*'));
    if (Array.isArray(tData)) {
      for (const row of tData) {
        const t = mapSupabaseTicket(row);
        if (t.id) {
          await safeSetDoc(doc(colRef(C.TICKETS), t.id), t, { merge: true });
          ticketsCount++;
        }
      }
    }
  } catch (err) {
    console.warn('syncAllFromSupabase tickets error:', err);
  }

  // Seats are Supabase-owned now — the admin seat map reads them live from
  // public.seats, so no seat backfill into Firestore is needed.

  return { bookingsCount, ticketsCount, seatsCount };
}

export type SeatGroup = { block: string; seats: string[] };

// Customer-app holds: a seat "reserved" by a live checkout blocks the counter
// only for the hold TTL — after that it becomes sellable again.
const RESERVE_TTL_MS = 10 * 60 * 1000;
function isFreshReserved(data: { status?: string; reservedAt?: unknown } | undefined): boolean {
  if (String(data?.status || '').toLowerCase() !== 'reserved') return false;
  const at = Date.parse(String(data?.reservedAt || ''));
  if (Number.isNaN(at)) return false;
  return Date.now() - at < RESERVE_TTL_MS;
}

export async function addBooking(
  booking: Omit<BookingItem, 'id'> & { eventId: string },
  seatGroups?: SeatGroup[]
): Promise<string> {
  const bookingRef = doc(colRef(C.BOOKINGS));
  const bookingId = bookingRef.id;

  const count = Number(booking.quantity) || (Array.isArray(booking.seats) ? booking.seats.length : 1);
  const seats = Array.isArray(booking.seats) ? booking.seats.filter(Boolean) : [];
  const baseTicketNumber = booking.ticketNumber;

  const nowIso = new Date().toISOString();
  const showId = (booking as any).showId || booking.eventId;

  const fullBooking: Omit<BookingItem, 'id'> = {
    ...booking,
    showId,
    eventId: booking.eventId || showId,
    bookingId: baseTicketNumber,
    enteredCount: 0,
    remainingCount: count,
    usedTickets: [],
    usedSeats: [],
    createdAt: (booking as any).createdAt || nowIso,
  };

  // Seat targets this booking must claim: explicit groups (multi-block counter
  // selection) or every seat under the booking's single block.
  const primaryBlock = (booking.block || '').trim().toUpperCase();
  const groups: SeatGroup[] =
    seatGroups && seatGroups.length
      ? seatGroups.map((g) => ({ block: String(g.block || '').trim().toUpperCase(), seats: g.seats }))
      : seats.length && primaryBlock
        ? [{ block: primaryBlock, seats }]
        : [];

  // Enforce selling channel rule for counter bookings: if a block is active for Online selling,
  // it cannot be sold at the counter.
  if (booking.source === 'Counter') {
    const blocksToCheck = new Set<string>();
    if (primaryBlock) blocksToCheck.add(primaryBlock);
    for (const g of groups) {
      if (g.block) blocksToCheck.add(g.block);
    }
    for (const bId of Array.from(blocksToCheck)) {
      try {
        const { data: catData } = await sb
          .from('block_categories')
          .select('online, counter')
          .eq('id', bId)
          .maybeSingle();

        if (catData && (catData.online === true || catData.counter === false)) {
          throw new Error(`Block ${bId} is active for Online selling only. Seats in this block cannot be sold at the counter.`);
        }
      } catch (checkErr: any) {
        if (checkErr.message && checkErr.message.includes('active for Online selling only')) {
          throw checkErr;
        }
      }
    }
  }

  // Supabase seats are the source of truth for seat states. Normalise every
  // seat key to its seat_id form ("B1-A-1") and look it up in one query.
  const seatKeyMeta = new Map<string, { id: string; block: string; row: string; num: number }>();
  for (const group of groups) {
    if (!group.block) continue;
    for (const seatKey of group.seats) {
      const cleanKey = String(seatKey || '').trim().toUpperCase();
      if (!cleanKey) continue;
      const parts = cleanKey.split('-');
      const labelMatch = cleanKey.match(/^([A-Z]+)(\d+)$/);
      const row = parts.length >= 3 ? parts[parts.length - 2] : parts.length === 2 ? parts[0] : labelMatch ? labelMatch[1] : '';
      const num = parts.length >= 2 ? Number(parts[parts.length - 1]) : labelMatch ? Number(labelMatch[2]) : 0;
      const liveId = parts.length >= 3 ? cleanKey : labelMatch ? `${group.block}-${labelMatch[1]}-${labelMatch[2]}` : `${group.block}-${row}-${num}`;
      if (!seatKeyMeta.has(liveId)) {
        seatKeyMeta.set(liveId, { id: liveId, block: group.block, row, num });
      }
    }
  }
  const seatIds = Array.from(seatKeyMeta.keys());

  const sbSeatStates = new Map<string, { status: string; reservedAt: string | null; reservedBy: string | null; price: number }>();
  if (showId && seatIds.length > 0) {
    const orParts: string[] = [];
    for (const id of seatIds) {
      orParts.push(`seat_id.eq.${id}`, `id.eq.${id}`, `id.eq.${showId}_${id}`);
      const lm = id.match(/^[A-Z0-9]+-([A-Z]+)(\d+)$/);
      if (lm) orParts.push(`seat_label.eq.${lm[1]}${lm[2]}`);
    }
    try {
      const { data: seatRows, error: seatReadErr } = await sb
        .from('seats')
        .select('id, seat_id, block_id, row_id, seat_number, price, status, reserved_at, reserved_by')
        .eq('event_id', showId)
        .or(orParts.join(','));
      if (seatReadErr) console.warn('addBooking Supabase seat read:', seatReadErr.message);
      (Array.isArray(seatRows) ? seatRows : []).forEach((r: any) => {
        const state = {
          status: String(r.status || 'available').toLowerCase(),
          reservedAt: r.reserved_at ? String(r.reserved_at) : null,
          reservedBy: r.reserved_by ? String(r.reserved_by) : null,
          price: Number(r.price) || 0,
        };
        const block = String(r.block_id || '').trim().toUpperCase();
        const rowId = String(r.row_id || '').trim().toUpperCase();
        const number = Number(r.seat_number) || 0;
        if (block && rowId && number) seatKeyMeta.set(`${block}-${rowId}-${number}`, { id: `${block}-${rowId}-${number}`, block, row: rowId, num: number });
        const idKeys = [r.id, r.seat_id].filter(Boolean).map(String);
        if (number && rowId) {
          idKeys.push(`${block}-${rowId}-${number}`);
          idKeys.push(`${rowId}${number}`);
        }
        for (const k of idKeys) {
          if (seatKeyMeta.has(k)) seatKeyMeta.set(k, { id: k, block, row: rowId, num: number });
          sbSeatStates.set(k, state);
        }
      });
    } catch (err) {
      console.warn('addBooking Supabase seat read failed:', err);
    }
  }

  const taken: string[] = [];
  for (const id of seatIds) {
    const st = sbSeatStates.get(id);
    if (!st) continue;
    if (st.status === 'booked' || st.status === 'sold' || st.status === 'locked') taken.push(id);
    else if (st.status === 'reserved' && isFreshReserved({ status: st.status, reservedAt: st.reservedAt })) taken.push(id);
  }
  if (taken.length > 0) {
    throw new Error(
      `Seat ${taken.join(', ')} ${taken.length > 1 ? 'are' : 'is'} currently held or booked by someone else.`
    );
  }

  const ticketItems: { ref: ReturnType<typeof doc>; item: TicketItem }[] = [];

  for (let i = 0; i < count; i++) {
    const ticketId = count === 1 ? baseTicketNumber : `${baseTicketNumber}-${i + 1}`;
    const seat = seats[i] || booking.seatNumber || null;
    const ticketDocRef = doc(db, C.TICKETS, ticketId);
    const qrToken =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : 'tkn_' + Math.random().toString(36).slice(2) + Date.now().toString(36);

    const ticketItem: TicketItem = {
      id: ticketId,
      ticketId,
      bookingId: baseTicketNumber,
      bookingDocId: bookingId,
      ticketIndex: i + 1,
      totalTickets: count,
      eventId: booking.eventId || showId,
      eventName: booking.eventName || '',
      ticketTypeId: booking.ticketTypeId,
      ticketTypeName: booking.ticketTypeName,
      seat,
      seatIndex: i + 1,
      seatCount: count,
      block: booking.block || null,
      assignedGate: booking.assignedGate,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      serialNumber: ticketId,
      qrToken,
      status: 'ACTIVE',
      date: booking.date,
      time: booking.time,
      unitPrice: booking.unitPrice,
      scannedAt: null,
      scannedBy: null,
      createdAt: nowIso,
    };

    ticketItems.push({ ref: ticketDocRef, item: ticketItem });
  }

  // Booking + tickets commit atomically in Firestore so two counters can
  // never race on the same ticket number (Firestore retries automatically).
  try {
    await runTransaction(db, async (tx) => {
      tx.set(bookingRef, fullBooking);
      for (const t of ticketItems) tx.set(t.ref, t.item);
    });
  } catch (err) {
    if (err instanceof Error) {
      if (/held or booked by someone else/.test(err.message)) throw err;
      if (/active for Online selling only/.test(err.message)) throw err;
    }
    console.error('addBooking failed:', err);
    throw new Error('Failed to save booking');
  }

  // Seats are Supabase-owned: claim them there now that the booking exists.
  const claimed: string[] = [];
  for (const id of seatIds) {
    const meta = seatKeyMeta.get(id)!;
    const existing = sbSeatStates.get(id);
    const payload: Record<string, unknown> = {
      status: 'booked',
      booked_at: nowIso,
      booking_id: baseTicketNumber,
      reserved_by: null,
      reserved_at: null,
      updated_at: nowIso,
    };
    let result: { ok: boolean; error?: string };
    if (existing) {
      result = await sbSeatUpdateSync(id, payload, showId);
    } else {
      result = await sbUpsertMany(
        'seats',
        [
          {
            id: `${showId}_${meta.id}`,
            seat_id: meta.id,
            block: meta.block,
            block_id: meta.block,
            row: meta.row,
            row_id: meta.row,
            seat_number: meta.num,
            seat_label: `${meta.row}${meta.num}`,
            price: Number(booking.unitPrice) || 100,
            event_id: showId,
            show_id: showId,
            created_at: nowIso,
            ...payload,
          },
        ],
        { onConflict: 'id' }
      );
    }
    if (result.ok) claimed.push(id);
    else console.error(`[seats] counter booking: Supabase claim failed for ${id}:`, result.error);
  }

  if (seatIds.length > 0 && claimed.length < seatIds.length) {
    console.error(
      `[seats] counter booking ${baseTicketNumber}: ${seatIds.length - claimed.length} seat(s) failed to mark booked in Supabase — customer app may still offer them.`
    );
  }

  // Mirror booking & ticket docs to Supabase (fire-and-forget after Firebase commit)
  sbMirrorBooking({ ...fullBooking, id: bookingId });
  for (const t of ticketItems) sbMirrorTicket(t.item as unknown as Record<string, unknown>);

  return bookingId;
}

export async function updateBooking(id: string, data: Partial<BookingItem>): Promise<void> {
  await updateDoc(docRef(C.BOOKINGS, id), data);
  sbMirrorBookingUpdate(id, data as Record<string, unknown>);
}

export async function checkInBooking(bookingId: string): Promise<void> {
  await updateDoc(docRef(C.BOOKINGS, bookingId), { status: 'Checked-in' });
  sbMirrorBookingUpdate(bookingId, { status: 'Checked-in' });
}

/**
 * Cancel a booking and release its seats back to "available" on BOTH seat
 * paths, so the seats instantly become sellable again online and at counter.
 * Also cancels the per-ticket docs so QR scans reject them.
 */
export async function cancelBookingWithRelease(booking: {
  id: string;
  ticketNumber?: string;
  eventId?: string;
  showId?: string;
  block?: string;
  seats?: string[];
}): Promise<void> {
  const nowIso = new Date().toISOString();

  // 1. Mark the booking cancelled (both status fields — online app reads both).
  await updateBooking(booking.id, {
    status: 'Cancelled',
    bookingStatus: 'Cancelled',
  } as Partial<BookingItem>);

  // 2. Cancel every ticket issued for this booking.
  try {
    if (booking.ticketNumber) {
      const tickets = await getTicketsByBookingId(booking.ticketNumber);
      for (const t of tickets) {
        await updateDoc(docRef(C.TICKETS, t.id), { status: 'CANCELLED', cancelledAt: nowIso });
        sbMirrorTicketUpdate(t.id, { status: 'CANCELLED', cancelledAt: nowIso });
      }
    }
  } catch (err) {
    console.warn('cancelBookingWithRelease tickets:', err);
  }

  // 3. Seats live in Supabase — release the claimed rows back to available.
  const showId = String(booking.showId || booking.eventId || '').trim();
  const blockHint = String(booking.block || '').trim().toUpperCase();
  const seatKeys = (Array.isArray(booking.seats) ? booking.seats : [])
    .map((s) => String(s || '').trim().toUpperCase())
    .filter(Boolean);
  if (!showId || seatKeys.length === 0) return;

  const releaseIds = new Set<string>();
  for (const key of seatKeys) {
    const parts = key.split('-');
    if (parts.length >= 3) {
      releaseIds.add(parts.join('-'));
    } else {
      const m = key.match(/^([A-Z]+)(\d+)$/);
      const row = parts.length === 2 ? parts[0] : m ? m[1] : '';
      const num = parts.length === 2 ? parts[1] : m ? m[2] : '';
      if (row && num) releaseIds.add(`${blockHint}-${row}-${num}`);
    }
  }

  const releasePatch = {
    status: 'available',
    booked_at: null,
    booking_id: null,
    reserved_at: null,
    reserved_by: null,
    updated_at: nowIso,
  };

  for (const id of releaseIds) {
    try {
      const { data: released, error } = await sb
        .from('seats')
        .update(releasePatch)
        .eq('event_id', showId)
        .eq('seat_id', id)
        .in('status', ['booked', 'reserved', 'sold'])
        .or(`booking_id.is.null,booking_id.eq.${booking.ticketNumber || ''}`)
        .select('id');
      if (error) console.warn('cancelBookingWithRelease seat release:', error.message);
      else if (!released || released.length === 0) {
        console.warn(`cancelBookingWithRelease: seat ${id} not found/already free in Supabase`);
      }
    } catch (err) {
      console.warn('cancelBookingWithRelease seat release failed:', err);
    }
  }
}

/**
 * Delete a booking: release seats, hard-delete all individual ticket docs,
 * then hard-delete the booking document itself — full database removal.
 */
export async function deleteBooking(booking: {
  id: string;
  ticketNumber?: string;
  eventId?: string;
  showId?: string;
  block?: string;
  seats?: string[];
}): Promise<void> {
  // 1. Hard-delete individual ticket documents.
  try {
    if (booking.ticketNumber) {
      const tickets = await getTicketsByBookingId(booking.ticketNumber);
      for (const t of tickets) {
        await deleteDoc(docRef(C.TICKETS, t.id));
        sbMirrorDelete('tickets', t.id);
      }
    }
  } catch (err) {
    console.warn('deleteBooking ticket removal:', err);
  }

  // 2. Seats live in Supabase — release the claimed rows back to available.
  const showId = String(booking.showId || booking.eventId || '').trim();
  const blockHint = String(booking.block || '').trim().toUpperCase();
  const seatKeys = (Array.isArray(booking.seats) ? booking.seats : [])
    .map((s) => String(s || '').trim().toUpperCase())
    .filter(Boolean);

  if (showId && seatKeys.length > 0) {
    const releaseIds = new Set<string>();
    for (const key of seatKeys) {
      const parts = key.split('-');
      if (parts.length >= 3) {
        releaseIds.add(parts.join('-'));
      } else {
        const m = key.match(/^([A-Z]+)(\d+)$/);
        const row = parts.length === 2 ? parts[0] : m ? m[1] : '';
        const num = parts.length === 2 ? parts[1] : m ? m[2] : '';
        if (row && num) releaseIds.add(`${blockHint}-${row}-${num}`);
      }
    }

    const releasePatch = {
      status: 'available',
      booked_at: null,
      booking_id: null,
      reserved_at: null,
      reserved_by: null,
      updated_at: new Date().toISOString(),
    };

    for (const id of releaseIds) {
      try {
        const { error } = await sb
          .from('seats')
          .update(releasePatch)
          .eq('event_id', showId)
          .eq('seat_id', id)
          .in('status', ['booked', 'reserved', 'sold'])
          .or(`booking_id.is.null,booking_id.eq.${booking.ticketNumber || ''}`);
        if (error) console.warn('deleteBooking seat release:', error.message);
      } catch (err) {
        console.warn('deleteBooking seat release failed:', err);
      }
    }
  }

  // 3. Hard-delete the booking document.
  try {
    await deleteDoc(docRef(C.BOOKINGS, booking.id));
    sbMirrorDelete('bookings', booking.id);
  } catch (err) {
    console.warn('deleteBooking doc removal failed:', err);
    throw err;
  }
}

// ─── Gates ────────────────────────────────────────────────────────

export function listenGates(
  eventId: string,
  callback: (gates: GateInfo[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(colRef(C.GATES), where('eventId', '==', eventId));
  return onSnapshot(
    q,
    (snap) => {
      const gates = snap.docs.map((d) => ({ id: d.id, ...d.data() } as GateInfo));
      callback(gates);
    },
    (err) => {
      console.warn('listenGates error:', err);
      onError?.(err);
    }
  );
}

export async function addGate(gate: Omit<GateInfo, 'id'> & { eventId: string }): Promise<string> {
  const ref = await addDoc(colRef(C.GATES), gate);
  sbMirrorGate({ ...gate, id: ref.id });
  return ref.id;
}

export async function updateGate(id: string, data: Partial<GateInfo>): Promise<void> {
  await updateDoc(docRef(C.GATES, id), data);
  sbMirrorGateUpdate(id, data as Record<string, unknown>);
}

export async function incrementGateEntry(gateId: string, delta: number): Promise<void> {
  const snap = await getDoc(docRef(C.GATES, gateId));
  if (!snap.exists()) return;
  const gate = snap.data() as GateInfo;
  const newEntered = Math.max(0, gate.entered + delta);
  const patch = {
    entered: newEntered,
    percentage: Math.round((newEntered / gate.capacity) * 100),
    status: newEntered >= gate.capacity ? 'full' : newEntered >= gate.capacity * 0.8 ? 'congested' : 'normal',
  };
  await updateDoc(docRef(C.GATES, gateId), patch);
  sbMirrorGateUpdate(gateId, patch);
}

export async function resetGate(gateId: string): Promise<void> {
  await updateDoc(docRef(C.GATES, gateId), { entered: 0, percentage: 0, status: 'normal' });
  sbMirrorGateUpdate(gateId, { entered: 0, percentage: 0, status: 'normal' });
}

// ─── Seats (Supabase source of truth: public.seats) ──────────────
// Seat reservation/booking state lives entirely in Supabase — the customer
// app holds and books seats there, and the admin panel reads the same rows.
// Firestore seat paths (shows/{id}/seats, legacy seats/{id}/{block}) are no
// longer consulted.

// Live seat changes reach the admin map through two paths:
//   • realtime (instant, once public.seats is in the supabase_realtime
//     publication) and
//   • a 5s poll of the seat status columns, which is what makes a customer
//     hold visible even when the realtime socket is down. The poll selects
//     only the columns that change during sales, so a 1000-seat event costs a
//     few KB instead of the full row set.
const SEAT_POLL_MS = 5000;

// Active seat maps per event, so a seat-management write can re-read exactly
// what it changed instead of waiting for the next poll.
const seatRefetchers = new Map<string, Set<() => void>>();

/** Re-run the full seat read for every listener of an event (or all events). */
export function refreshSeatMaps(showId?: string): void {
  if (showId) seatRefetchers.get(showId)?.forEach((refetch) => refetch());
  else seatRefetchers.forEach((set) => set.forEach((refetch) => refetch()));
}

export function listenSeats(
  showIdOrEventId: string,
  callback: (seats: Seat[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const showId = String(showIdOrEventId || '').trim();
  if (!showId) {
    callback([]);
    return () => {};
  }

  let active = true;
  /** canonical seat_id → Seat */
  const seatMap = new Map<string, Seat>();

  // A "reserved" hold older than the checkout TTL is a stale hold from an
  // abandoned session — show it as available, same as the customer app does.
  const isHoldFresh = (reservedAt?: unknown): boolean => {
    if (!reservedAt) return false;
    const t = typeof reservedAt === 'string' ? Date.parse(reservedAt) : NaN;
    if (isNaN(t)) return false;
    return Date.now() - t < 10 * 60 * 1000;
  };

  const emit = () => {
    if (!active) return;
    const unique = Array.from(seatMap.values());
    unique.sort((a, b) => {
      if (a.blockId !== b.blockId) return a.blockId.localeCompare(b.blockId);
      if (a.rowId !== b.rowId) return a.rowId.localeCompare(b.rowId);
      return a.seatNumber - b.seatNumber;
    });
    callback(
      unique.map((s) =>
        s.status === 'reserved' && !isHoldFresh(s.reservedAt)
          ? { ...s, status: 'available', reservedAt: null, reservedBy: null }
          : s
      )
    );
  };

  const applyRow = (row: Record<string, any>) => {
    const s = mapSupabaseSeat(row);
    const eventId = String(row.event_id || row.show_id || '');
    if (eventId && eventId !== showId) return;
    seatMap.set(s.id, s);
  };

  const removeRow = (row: Record<string, any>) => {
    const s = mapSupabaseSeat(row || {});
    if (s.id) seatMap.delete(s.id);
  };

  const eventSeats = (cols = '*') =>
    sb.from('seats').select(cols).or(`event_id.eq.${showId},show_id.eq.${showId}`);

  // PostgREST caps every response at 1000 rows, and an event can easily hold
  // more (blocks beyond the cap would otherwise never reach the seat map), so
  // every read walks the table in pages.
  const SEAT_PAGE = 1000;
  const fetchSeatsPaged = async (cols: string): Promise<Record<string, any>[]> => {
    const out: Record<string, any>[] = [];
    for (let from = 0; ; from += SEAT_PAGE) {
      const { data, error }: any = await Promise.resolve(
        eventSeats(cols).range(from, from + SEAT_PAGE - 1)
      );
      if (error) throw new Error(error.message);
      const chunk = Array.isArray(data) ? data : [];
      out.push(...chunk);
      if (chunk.length < SEAT_PAGE) break;
    }
    return out;
  };

  let fullReadInFlight = false;
  const refetchAll = () => {
    if (fullReadInFlight) return;
    fullReadInFlight = true;
    void fetchSeatsPaged('*')
      .then((data) => {
        if (!active) return;
        seatMap.clear();
        data.forEach(applyRow);
        emit();
      })
      .catch((err: any) => {
        console.warn('listenSeats Supabase fetch error:', err);
        onError?.(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        fullReadInFlight = false;
      });
  };

  // 1. Initial state for this event.
  refetchAll();

  // 2. Status poll. Reading only the columns that change during sales keeps the
  // response small, and reconciling the whole set means a seat deleted or
  // released in the customer app cannot linger in the admin map as a ghost.
  const STATUS_COLS = 'seat_id, status, price, booked_at, reserved_at, reserved_by, booking_id';
  let pollInFlight = false;
  const pollStatuses = () => {
    if (pollInFlight || fullReadInFlight) return;
    pollInFlight = true;
    void fetchSeatsPaged(STATUS_COLS)
      .then((data) => {
        if (!active) return;
        const stillThere = new Set<string>();
        let changed = false;
        let added = false;
        data.forEach((row: Record<string, any>) => {
          const s = mapSupabaseSeat(row);
          stillThere.add(s.id);
          const prev = seatMap.get(s.id);
          if (!prev) {
            added = true;
            return;
          }
          if (
            prev.status !== s.status ||
            prev.price !== s.price ||
            prev.reservedAt !== s.reservedAt ||
            prev.reservedBy !== s.reservedBy ||
            prev.bookedAt !== s.bookedAt ||
            prev.bookingId !== s.bookingId
          ) {
            seatMap.set(s.id, {
              ...prev,
              status: s.status,
              price: s.price,
              reservedAt: s.reservedAt,
              reservedBy: s.reservedBy,
              bookedAt: s.bookedAt,
              bookingId: s.bookingId,
            });
            changed = true;
          }
        });
        if (added) {
          // Seats created since the last full read — they need block/row/label,
          // so take the complete set again rather than half-applying them.
          refetchAll();
          return;
        }
        seatMap.forEach((_s, id) => {
          if (!stillThere.has(id)) {
            seatMap.delete(id);
            changed = true;
          }
        });
        if (changed) emit();
      })
      .catch(() => {})
      .finally(() => {
        pollInFlight = false;
      });
  };

  // 3. Live push (instant when the publication is configured). Filtered
  // postgres_changes subscriptions can silently miss rows written with only
  // show_id, so the channel watches all seat events and buckets per row
  // client-side.
  let channel: RealtimeChannel | null = null;
  try {
    channel = sb
      .channel(`seats-rt-${showId}-${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seats' },
        (payload: any) => {
          if (!active) return;
          if (payload.eventType === 'DELETE') {
            removeRow(payload.old as Record<string, any>);
          } else if (payload.new) {
            applyRow(payload.new as Record<string, any>);
          } else {
            return;
          }
          emit();
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('listenSeats realtime setup failed:', err);
  }

  const refetchers = seatRefetchers.get(showId) || new Set<() => void>();
  refetchers.add(refetchAll);
  seatRefetchers.set(showId, refetchers);

  const poll = setInterval(pollStatuses, SEAT_POLL_MS);
  // Expire abandoned checkout holds even when no write wakes the map.
  const sweep = setInterval(emit, 60 * 1000);

  return () => {
    active = false;
    clearInterval(poll);
    clearInterval(sweep);
    refetchers.delete(refetchAll);
    if (refetchers.size === 0) seatRefetchers.delete(showId);
    if (channel) sb.removeChannel(channel);
  };
}

export async function createSeatRow(params: {
  showId?: string;
  eventId?: string;
  blockId: string;
  rowId: string;
  /** Target seat numbers 1…totalSeats. Seats that already exist are SKIPPED. */
  totalSeats: number;
  price?: number;
  committeeId?: string;
  committeeName?: string;
}): Promise<number> {
  const showId = params.showId || params.eventId || '';
  if (!showId) throw new Error('showId or eventId is required to create seats.');
  const { blockId, rowId, totalSeats, price = 100, committeeId = '', committeeName = '' } = params;
  const target = Math.max(1, Math.floor(totalSeats));
  const block = blockId.trim().toUpperCase();
  const row = rowId.trim().toUpperCase();

  // Seats live in Supabase only — never reset an existing seat, a re-write
  // would wipe its live booking state. Create just the missing numbers.
  const { data: existing, error: readErr } = await sb
    .from('seats')
    .select('seat_number, status')
    .eq('event_id', showId)
    .eq('block_id', block)
    .eq('row_id', row);
  if (readErr) {
    throw new Error(`Could not read existing seats from Supabase: ${readErr.message}`);
  }

  const have = new Set<number>((existing || []).map((r: any) => Number(r.seat_number)));
  const missing: number[] = [];
  for (let n = 1; n <= target; n++) {
    if (!have.has(n)) missing.push(n);
  }

  const nowIso = new Date().toISOString();
  for (let i = 0; i < missing.length; i += 500) {
    const rows = missing.slice(i, i + 500).map((n) => ({
      id: `${showId}_${block}-${row}-${n}`,
      seat_id: `${block}-${row}-${n}`,
      block: block,
      block_id: block,
      row: row,
      row_id: row,
      seat_number: n,
      seat_label: `${row}${n}`,
      price: Number(price) || 100,
      status: 'available',
      event_id: showId,
      show_id: showId,
      created_at: nowIso,
      updated_at: nowIso,
    }));
    const result = await sbUpsertMany('seats', rows);
    if (!result.ok) {
      throw new Error(`Failed to save seats to Supabase: ${result.error || 'unknown error'}.`);
    }
  }

  // Block roster for the seat-management UI stays in Firestore (event data).
  try {
    await setDoc(doc(db, C.SEAT_META, showId), { blocks: arrayUnion(block) }, { merge: true });
  } catch (err) {
    console.warn('createSeatRow seatMeta update failed:', err);
  }

  refreshSeatMaps(showId);
  return missing.length;
}

/**
 * Reduce a row's seat count to `totalSeats`: deletes Supabase seats numbered
 * above the target. Booked/reserved seats are NEVER deleted — they are kept
 * so live sales are not destroyed.
 * Returns { deleted, keptBooked }.
 */
export async function trimSeatRow(params: {
  showId?: string;
  eventId?: string;
  blockId: string;
  rowId: string;
  totalSeats: number;
}): Promise<{ deleted: number; keptBooked: number }> {
  const showId = params.showId || params.eventId || '';
  if (!showId) throw new Error('showId or eventId is required to trim seats.');
  const block = params.blockId.trim().toUpperCase();
  const row = params.rowId.trim().toUpperCase();
  const target = Math.max(1, Math.floor(params.totalSeats));

  const { data: rows, error } = await sb
    .from('seats')
    .select('id, seat_number, status')
    .eq('event_id', showId)
    .eq('block_id', block)
    .eq('row_id', row)
    .gt('seat_number', target);
  if (error) {
    throw new Error(`Could not read seats from Supabase: ${error.message}`);
  }

  const PROTECTED = new Set(['booked', 'reserved', 'sold']);
  let keptBooked = 0;
  const deleteIds: string[] = [];
  for (const r of rows || []) {
    if (PROTECTED.has(String(r.status || 'available').toLowerCase())) {
      keptBooked++;
      continue;
    }
    deleteIds.push(String(r.id));
  }

  let deleted = 0;
  for (let i = 0; i < deleteIds.length; i += 200) {
    const { data: gone, error: delErr } = await sb
      .from('seats')
      .delete()
      .in('id', deleteIds.slice(i, i + 200))
      .select('id');
    if (delErr) {
      console.warn('trimSeatRow delete failed:', delErr.message);
      throw new Error(`Failed to delete seats from Supabase: ${delErr.message}`);
    }
    deleted += (gone || []).length;
  }

  refreshSeatMaps(showId);
  return { deleted, keptBooked };
}

/**
 * Update an existing row without touching seat availability/booking state.
 * Currently updates the seat price on every seat of the row (Supabase only).
 * Returns the number of seats updated.
 */
export async function updateSeatRow(params: {
  showId?: string;
  eventId?: string;
  blockId: string;
  rowId: string;
  price?: number;
}): Promise<number> {
  const showId = params.showId || params.eventId || '';
  if (!showId) throw new Error('showId or eventId is required to update seats.');
  const block = params.blockId.trim().toUpperCase();
  const row = params.rowId.trim().toUpperCase();
  const price = Number(params.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error('A valid price is required.');
  if (!block || !row) throw new Error('blockId and rowId are required.');

  const { data: updatedRows, error } = await sb
    .from('seats')
    .update({ price, updated_at: new Date().toISOString() })
    .eq('event_id', showId)
    .eq('block_id', block)
    .eq('row_id', row)
    .select('id');
  if (error) {
    throw new Error(`Failed to update seat price in Supabase: ${error.message}`);
  }
  refreshSeatMaps(showId);
  return (updatedRows || []).length;
}

export async function deleteSeatRow(params: {
  showId?: string;
  eventId?: string;
  blockId: string;
  rowId: string;
}): Promise<void> {
  const showId = params.showId || params.eventId || '';
  if (!showId) return;
  const block = params.blockId.trim().toUpperCase();
  const row = params.rowId.trim().toUpperCase();

  // Seats belong to Supabase — delete the row there, but never drop a seat an
  // online/counter booking still holds; the customer app would lose it.
  const { error } = await sb
    .from('seats')
    .delete()
    .eq('event_id', showId)
    .eq('block_id', block)
    .eq('row_id', row)
    .not('status', 'in', '("booked","reserved","sold")');
  if (error) {
    console.error('deleteSeatRow Supabase delete failed:', error.message);
    throw new Error(`Failed to delete seats from Supabase: ${error.message}`);
  }
  refreshSeatMaps(showId);
}

export async function listSeatBlocks(eventId: string): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, C.SEAT_META, eventId));
    if (snap.exists()) {
      const blocks = (snap.data() as { blocks?: string[] }).blocks || [];
      if (blocks.length) return blocks;
    }
  } catch {
    /* fall through */
  }
  const snap = await getDocs(collection(db, C.SEATS, eventId));
  return snap.docs.map((d) => d.id);
}

// ─── Counters ─────────────────────────────────────────────────────

export function listenCounters(
  eventId: string,
  callback: (counters: CounterBooth[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(colRef(C.COUNTERS), where('eventId', '==', eventId));
  return onSnapshot(
    q,
    (snap) => {
      const counters = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CounterBooth));
      callback(counters);
    },
    (err) => {
      console.warn('listenCounters error:', err);
      onError?.(err);
    }
  );
}

export async function addCounter(counter: Omit<CounterBooth, 'id'> & { eventId: string }): Promise<string> {
  const ref = await addDoc(colRef(C.COUNTERS), counter);
  sbMirrorCounter({ ...counter, id: ref.id });
  return ref.id;
}

export async function updateCounter(id: string, data: Partial<CounterBooth>): Promise<void> {
  await updateDoc(docRef(C.COUNTERS, id), data);
  sbMirrorCounterUpdate(id, data as Record<string, unknown>);
}

// ─── Scanner Members ──────────────────────────────────────────────

export function listenScannerMembers(
  callback: (members: ScannerMember[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    colRef(C.SCANNER_MEMBERS),
    (snap) => {
      const members = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScannerMember));
      members.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(members);
    },
    (err) => {
      console.error('listenScannerMembers error:', err);
      onError?.(err);
    }
  );
}

export async function getScannerMemberOnce(id: string): Promise<ScannerMember | null> {
  const snap = await getDoc(docRef(C.SCANNER_MEMBERS, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as ScannerMember) : null;
}

export async function getScannerMemberByScannerId(scannerId: string): Promise<ScannerMember | null> {
  const q = query(colRef(C.SCANNER_MEMBERS), where('scannerId', '==', scannerId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as ScannerMember;
}

// Generate a unique Scanner ID (SCN-001, SCN-002, ...) — never reuses numbers
export async function generateScannerId(): Promise<string> {
  const snap = await getDocs(colRef(C.SCANNER_MEMBERS));
  let max = 0;
  snap.docs.forEach((d) => {
    const sid = (d.data() as ScannerMember).scannerId || '';
    const m = sid.match(/^SCN-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `SCN-${String(max + 1).padStart(3, '0')}`;
}

export type NewScannerMemberInput = Omit<
  ScannerMember,
  'id' | 'scannerId' | 'approvalStatus' | 'accountStatus' | 'createdAt' | 'totalScans'
>;

// New members always start as pending + active (pending ⇒ no scan access)
export async function addScannerMember(input: NewScannerMemberInput): Promise<ScannerMember> {
  // One scanner account per name + mobile number.
  const nameKey = input.name.trim().replace(/\s+/g, ' ').toLowerCase();
  const mobileKey = input.mobile.replace(/\D/g, '').slice(-10);
  if (nameKey && mobileKey.length >= 10) {
    const snap = await getDocs(colRef(C.SCANNER_MEMBERS));
    const duplicate = snap.docs
      .map((d) => d.data() as ScannerMember)
      .find(
        (m) =>
          (m.name || '').trim().replace(/\s+/g, ' ').toLowerCase() === nameKey &&
          (m.mobile || '').replace(/\D/g, '').slice(-10) === mobileKey
      );
    if (duplicate) {
      throw new Error(
        `A scanner with this name and mobile number already exists (${duplicate.scannerId}).`
      );
    }
  }

  const scannerId = await generateScannerId();
  // Firestore rejects undefined values — strip them before writing
  const clean = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined)
  ) as NewScannerMemberInput;
  const payload: Omit<ScannerMember, 'id'> = {
    ...clean,
    scannerId,
    approvalStatus: 'pending',
    accountStatus: 'active',
    createdAt: new Date().toISOString(),
    totalScans: 0,
  };
  const ref = await addDoc(colRef(C.SCANNER_MEMBERS), payload);
  sbMirrorScannerMember({ ...payload, id: ref.id });
  await writeAuditLog({
    action: 'scanner.added',
    performedBy: 'admin',
    targetId: ref.id,
    metadata: { scannerId, name: input.name },
  });
  return { id: ref.id, ...payload };
}

export async function updateScannerMember(id: string, patch: Partial<ScannerMember>): Promise<void> {
  await updateDoc(docRef(C.SCANNER_MEMBERS, id), patch);
  sbMirrorScannerMemberUpdate(id, patch as Record<string, unknown>);
}

/** Map a Supabase `scanner_members` row to the Firestore document shape. */
function mapSupabaseScannerMember(row: Record<string, unknown>): ScannerMember | null {
  const id = typeof row.id === 'string' ? row.id : '';
  const scannerId = typeof row.scanner_id === 'string' ? row.scanner_id.trim() : '';
  if (!id || !scannerId) return null;

  const gate = typeof row.assigned_gate_id === 'string' ? row.assigned_gate_id.trim() : '';
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  const member: ScannerMember = {
    id,
    scannerId,
    name: str(row.name).trim() || scannerId,
    email: str(row.email),
    mobile: str(row.mobile),
    profilePhoto: str(row.profile_photo),
    approvalStatus:
      row.approval_status === 'approved' || row.approval_status === 'rejected'
        ? row.approval_status
        : 'pending',
    accountStatus: row.account_status === 'deactivated' ? 'deactivated' : 'active',
    createdAt: str(row.created_at) || new Date().toISOString(),
    totalScans: Number(row.total_scans) || 0,
  };

  if (gate && gate.toLowerCase() !== 'not assigned') member.assignedGateId = gate;
  if (str(row.address)) member.address = str(row.address);
  if (str(row.id_proof)) member.idProof = str(row.id_proof);
  if (str(row.notes)) member.notes = str(row.notes);
  if (str(row.approved_at)) member.approvedAt = str(row.approved_at);
  if (str(row.approved_by)) member.approvedBy = str(row.approved_by);
  if (str(row.deactivated_at)) member.deactivatedAt = str(row.deactivated_at);
  if (str(row.deactivated_by)) member.deactivatedBy = str(row.deactivated_by);
  if (str(row.last_scan_at)) member.lastScanAt = str(row.last_scan_at);

  return member;
}

/**
 * Scanner accounts registered in the SCANNER app live only in Supabase, while
 * this admin reads `scannerMembers` from Firestore. Import any missing rows so
 * pending registrations show up in the member list and can be approved.
 * The Supabase row id is reused as the Firestore doc id so approval updates
 * mirror back to the same Supabase row.
 */
export async function syncScannerMembersFromSupabase(): Promise<number> {
  try {
    const [{ data, error }, snap] = await Promise.all([
      sb.from('scanner_members').select('*'),
      getDocs(colRef(C.SCANNER_MEMBERS)),
    ]);
    if (error || !data) return 0;

    const knownIds = new Set(snap.docs.map((d) => d.id));
    const knownScannerIds = new Set(
      snap.docs.map((d) => (d.data() as ScannerMember).scannerId).filter(Boolean)
    );

    let imported = 0;
    for (const row of data as Record<string, unknown>[]) {
      const member = mapSupabaseScannerMember(row);
      if (!member || knownIds.has(member.id) || knownScannerIds.has(member.scannerId)) continue;
      const { id, ...payload } = member;
      await setDoc(docRef(C.SCANNER_MEMBERS, id), payload);
      knownIds.add(id);
      knownScannerIds.add(member.scannerId);
      imported += 1;
    }

    // Admin (Firestore) is the source of truth for approval/account status.
    // Heal rows that drifted when a mirror request was rejected.
    const rowsById = new Map(
      (data as Record<string, unknown>[]).map((r) => [String(r.id), r])
    );
    let healed = 0;
    for (const d of snap.docs) {
      const member = { id: d.id, ...d.data() } as ScannerMember;
      const row = rowsById.get(member.id);
      if (!row) continue;
      if (
        row.approval_status === member.approvalStatus &&
        row.account_status === member.accountStatus
      ) {
        continue;
      }
      const patch: Record<string, unknown> = {
        approval_status: member.approvalStatus,
        account_status: member.accountStatus,
      };
      if (member.accountStatus === 'active') {
        patch.deactivated_at = null;
        patch.deactivated_by = null;
      }
      sbUpdate('scanner_members', member.id, patch);
      healed += 1;
    }
    if (healed) console.info(`Synced status for ${healed} scanner member(s) to Supabase.`);

    return imported;
  } catch (err) {
    console.warn('syncScannerMembersFromSupabase failed:', err);
    return 0;
  }
}

// ─── Audit Log ────────────────────────────────────────────────────

export async function writeAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'> & { timestamp?: string }): Promise<void> {
  try {
    const payload = { ...entry, timestamp: entry.timestamp || new Date().toISOString() };
    await addDoc(colRef(C.AUDIT_LOGS), payload);
    sbMirrorAuditLog(payload);
  } catch (err) {
    console.warn('writeAuditLog failed:', err);
  }
}

// ─── Ticket Entry validation (server/database is source of truth) ─

export interface EntryContext {
  memberId: string; // scannerMembers doc id
  gateId: string;
  eventId: string; // event being scanned for
}

export interface EntryResult {
  result: 'SUCCESS' | 'ALREADY_USED' | 'INVALID' | 'CANCELLED' | 'UNPAID' | 'WRONG_EVENT' | 'SCANNER_DENIED';
  ticketId?: string;
  bookingId?: string;
  audienceName?: string;
  seat?: string;
  block?: string;
  persons?: number;
  ticketType?: string;
  bookingSource?: string;
  eventName?: string;
  gateId?: string;
  entryTime?: string;
  scannedAt?: string;
  scannerId?: string;
  scannerName?: string;
  previousEntryTime?: string;
  previousScannerId?: string;
  previousScannerName?: string;
  previousGateId?: string;
  message?: string;
}

function entryDocId(eventId: string, ticketNumber: string): string {
  return `${eventId}__${ticketNumber}`;
}

export function localDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayStr(): string {
  return localDateStr(new Date());
}

/**
 * Records a scan event (especially rejections like ALREADY_USED, CANCELLED, WRONG_EVENT, etc.)
 * in the TICKET_ENTRIES collection with a unique auto-generated doc ID and writes an audit log.
 */
export async function recordScanLog(
  result: ScanResult,
  ticketId: string,
  ctx: EntryContext,
  member: ScannerMember | null,
  extra: Partial<TicketEntry> & { bookingId?: string; message?: string } = {}
): Promise<void> {
  const now = new Date();
  const scanDate = localDateStr(now);
  const scanTime = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const scannedAt = now.toISOString();

  try {
    const entryDocRef = doc(colRef(C.TICKET_ENTRIES));
    const entryPayload = {
      id: entryDocRef.id,
      eventId: ctx.eventId,
      scannerId: member?.scannerId || 'SCN-UNKNOWN',
      memberId: member?.id || ctx.memberId || 'unknown',
      scannerName: member?.name || 'Scanner',
      gateId: ctx.gateId || '',
      ticketId,
      bookingId: extra.bookingId || '',
      ticketNumber: ticketId,
      entryStatus: result === 'SUCCESS' ? 'entered' : 'rejected',
      scanResult: result,
      scannedAt,
      scanDate,
      scanTime,
      audienceName: extra.audienceName || '',
      persons: extra.persons || 1,
      ticketType: extra.ticketType || '',
      seat: extra.seat,
      previousEntryTime: extra.previousEntryTime,
      previousScannerId: extra.previousScannerId,
      previousScannerName: extra.previousScannerName,
      previousGateId: extra.previousGateId,
    } satisfies TicketEntry;
    await setDoc(entryDocRef, entryPayload);
    sbMirrorTicketEntry(entryPayload as Record<string, unknown>);
  } catch (err) {
    console.warn('Failed to record scan log in ticketEntries:', err);
  }

  try {
    await writeAuditLog({
      action: result === 'SUCCESS' ? 'entry.accepted' : 'entry.rejected',
      performedBy: member?.scannerId || ctx.memberId || 'scanner',
      targetId: ticketId,
      metadata: {
        result,
        eventId: ctx.eventId,
        gateId: ctx.gateId,
        bookingId: extra.bookingId || '',
        message: extra.message || '',
      },
    });
  } catch (err) {
    console.warn('Failed to write audit log for scan:', err);
  }
}

/** JSON keys that may carry the booking number or ticket ID inside a QR payload. */
const QR_ID_KEYS = ['id', 'ticketid', 'ticketnumber', 'ticketno', 'code', 'bookingid', 'serial'];

export function parseRawQrCode(rawCode: string): { code: string; seat?: string; seatIndex?: number } {
  let ticketNumber = (rawCode || '').trim();
  let qrSeat = '';
  let qrSeatIndex: number | undefined;

  let payloadStr = ticketNumber;
  if (payloadStr.includes('{') || payloadStr.toLowerCase().includes('%7b')) {
    if (!payloadStr.startsWith('{')) {
      try {
        payloadStr = decodeURIComponent(payloadStr);
      } catch {
        /* keep original */
      }
    }
    try {
      const parsed = JSON.parse(payloadStr);
      if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, unknown>;
        const key = Object.keys(record).find((name) =>
          QR_ID_KEYS.some((candidate) => candidate === name.toLowerCase())
        );
        ticketNumber = key ? String(record[key] ?? '') : '';
        qrSeat = String(record['seat'] || record['seatNumber'] || '').trim();
        const sIdx = Number(record['seatIndex']);
        if (Number.isFinite(sIdx)) qrSeatIndex = sIdx;
      }
    } catch {
      /* plain ticket code */
    }
  }
  return {
    code: ticketNumber.trim().toUpperCase(),
    seat: qrSeat || undefined,
    seatIndex: qrSeatIndex,
  };
}

/**
 * Resolves a scanned QR payload to a booking.
 *
 * The customer app encodes QRs in a few historical shapes:
 *   - {"id":"NJ26-00001", ...}      (current)
 *   - NJ26-00001-2                  (per-seat serial)
 *   - NJ26-00001-RAMESH-TUDU        (legacy ticket + holder name)
 * Only the first segment that actually exists in `bookings` is accepted,
 * so an unknown code can never be turned into a valid entry.
 */
async function findBookingByTicketNumber(raw: string): Promise<BookingItem | null> {
  const lookup = async (value: string): Promise<BookingItem | null> => {
    if (!value) return null;
    try {
      const q = query(colRef(C.BOOKINGS), where('ticketNumber', '==', value));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { id: d.id, ...d.data() } as BookingItem;
      }
    } catch {}

    try {
      const { data } = await sb
        .from('bookings')
        .select('*')
        .or(`ticket_number.eq.${value},id.eq.${value}`)
        .limit(1);
      if (Array.isArray(data) && data.length > 0) {
        const b = mapSupabaseBooking(data[0]);
        setDoc(doc(colRef(C.BOOKINGS), b.id), stripUndefined(b), { merge: true }).catch(() => {});
        return b;
      }
    } catch {}

    return null;
  };

  const direct = await lookup(raw);
  if (direct) return direct;

  let candidate = raw;
  for (let i = 0; i < 3; i++) {
    const cut = candidate.lastIndexOf('-');
    if (cut <= 0) break;
    candidate = candidate.slice(0, cut);
    const found = await lookup(candidate);
    if (found) return found;
  }
  return null;
}

/**
 * Resolves an event's title and committee name by eventId for cross-event rejection messaging.
 */
export async function getEventTitleAndCommittee(eventId?: string): Promise<{ title: string; committeeName: string }> {
  if (!eventId) return { title: 'Another Event', committeeName: 'Another Committee' };
  try {
    const evSnap = await getDoc(docRef(C.EVENTS, eventId));
    if (evSnap.exists()) {
      const data = evSnap.data() as Partial<EventItem>;
      const title = data.title || data.eventTitle || 'Another Event';
      const committeeName = data.committeeName || data.organizer || 'Another Committee';
      return { title, committeeName };
    }
    const showSnap = await getDoc(docRef('shows', eventId));
    if (showSnap.exists()) {
      const data = showSnap.data() as Partial<EventItem>;
      const title = data.title || data.eventTitle || 'Another Event';
      const committeeName = data.committeeName || data.organizer || 'Another Committee';
      return { title, committeeName };
    }
  } catch (err) {
    console.warn('getEventTitleAndCommittee lookup failed:', err);
  }
  return { title: 'Another Event', committeeName: 'Another Committee' };
}

export async function buildWrongEventMessage(
  foreignEventId?: string,
  fallback?: { eventTitle?: string; committeeName?: string }
): Promise<string> {
  const { title, committeeName } = await getEventTitleAndCommittee(foreignEventId);
  const resolvedTitle = fallback?.eventTitle || title;
  const resolvedCommittee = fallback?.committeeName || committeeName;
  return `Invalid Event Ticket — This ticket belongs to "${resolvedTitle}" (${resolvedCommittee}). Please visit the correct event location.`;
}

/**
 * Identifies the booking and all its individual tickets from any scanned QR or manual ID.
 * Returns the parent booking, all tickets in that booking, and which ticket was directly scanned (if any).
 */
export async function identifyBookingForEntry(
  rawCode: string,
  ctx: EntryContext
): Promise<IdentifiedBooking> {
  const { code } = parseRawQrCode(rawCode);
  if (!code) {
    return { status: 'INVALID', message: 'This ticket could not be verified.' };
  }

  // 1. Verify scanner authorization
  let member: ScannerMember | null = null;
  if (ctx.memberId === 'ADMIN' || ctx.memberId === 'admin') {
    member = {
      id: 'admin',
      scannerId: 'SCN-ADMIN',
      name: 'Administrator',
      email: 'admin@jatrabazaar.com',
      mobile: '9999999999',
      profilePhoto: '',
      approvalStatus: 'approved',
      accountStatus: 'active',
      createdAt: new Date().toISOString(),
      totalScans: 0,
    };
  } else {
    member = await getScannerMemberOnce(ctx.memberId);
  }

  if (!member || member.approvalStatus !== 'approved' || member.accountStatus !== 'active') {
    return {
      status: 'INVALID',
      message:
        member?.approvalStatus === 'pending'
          ? 'Your scanner account is waiting for admin approval.'
          : member?.approvalStatus === 'rejected'
            ? 'Your scanner access has been rejected.'
            : 'Your scanner account has been deactivated.',
    };
  }

  // 2. Direct individual ticket lookup in `tickets` collection
  let ticketRecord: TicketItem | null = null;
  try {
    const directSnap = await getDoc(docRef(C.TICKETS, code));
    if (directSnap.exists()) {
      ticketRecord = { id: directSnap.id, ...directSnap.data() } as TicketItem;
    }
  } catch {}

  if (!ticketRecord) {
    try {
      const qById = query(colRef(C.TICKETS), where('ticketId', '==', code));
      const sById = await getDocs(qById);
      if (!sById.empty) {
        ticketRecord = { id: sById.docs[0].id, ...sById.docs[0].data() } as TicketItem;
      }
    } catch {}
  }

  if (!ticketRecord) {
    try {
      const qByToken = query(colRef(C.TICKETS), where('qrToken', '==', code));
      const sByToken = await getDocs(qByToken);
      if (!sByToken.empty) {
        ticketRecord = { id: sByToken.docs[0].id, ...sByToken.docs[0].data() } as TicketItem;
      }
    } catch {}
  }

  if (!ticketRecord) {
    try {
      const qBySerial = query(colRef(C.TICKETS), where('serialNumber', '==', code));
      const sBySerial = await getDocs(qBySerial);
      if (!sBySerial.empty) {
        ticketRecord = { id: sBySerial.docs[0].id, ...sBySerial.docs[0].data() } as TicketItem;
      }
    } catch {}
  }

  // ── A. Individual ticket was directly found ──
  if (ticketRecord) {
    const targetTicket = ticketRecord;

    if (targetTicket.eventId !== ctx.eventId) {
      const wrongMsg = await buildWrongEventMessage(targetTicket.eventId, {
        eventTitle: (targetTicket as any).eventTitle || (targetTicket as any).eventName,
        committeeName: targetTicket.committeeName,
      });
      await recordScanLog('WRONG_EVENT', targetTicket.ticketId, ctx, member, {
        bookingId: targetTicket.bookingId,
        audienceName: targetTicket.customerName,
        ticketType: targetTicket.ticketTypeName,
        seat: targetTicket.seat || undefined,
        message: wrongMsg,
      });
      return {
        status: 'WRONG_EVENT',
        message: wrongMsg,
      };
    }

    if (targetTicket.status === 'CANCELLED') {
      await recordScanLog('CANCELLED', targetTicket.ticketId, ctx, member, {
        bookingId: targetTicket.bookingId,
        audienceName: targetTicket.customerName,
        ticketType: targetTicket.ticketTypeName,
        seat: targetTicket.seat || undefined,
        message: 'This ticket is not valid for entry (Cancelled).',
      });
      return {
        status: 'CANCELLED',
        message: 'This ticket is not valid for entry (Cancelled).',
      };
    }

    const booking = await findBookingByTicketNumber(targetTicket.bookingId);
    let allTickets = await getTicketsByBookingId(targetTicket.bookingId);
    if (allTickets.length === 0) {
      allTickets = [targetTicket];
    }

    if (targetTicket.status === 'ENTERED') {
      const prevTime =
        targetTicket.scanTime ||
        (targetTicket.scannedAt
          ? new Date(targetTicket.scannedAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })
          : undefined);

      await recordScanLog('ALREADY_USED', targetTicket.ticketId, ctx, member, {
        bookingId: targetTicket.bookingId,
        audienceName: targetTicket.customerName || booking?.customerName || '',
        ticketType: targetTicket.ticketTypeName || booking?.ticketTypeName || '',
        seat: targetTicket.seat || undefined,
        previousEntryTime: prevTime,
        previousScannerId: targetTicket.scannedBy || targetTicket.scannerMemberId || undefined,
        previousScannerName: targetTicket.scannerMemberName || undefined,
        message: 'This ticket has already been scanned.',
      });

      return {
        status: 'ALREADY_USED',
        message: 'This ticket has already been scanned.',
        booking: booking || undefined,
        tickets: allTickets,
        rejectedTicket: {
          ticketId: targetTicket.ticketId,
          seat: targetTicket.seat || undefined,
          entryTime: prevTime,
          scannerId: targetTicket.scannedBy || targetTicket.scannerMemberId || undefined,
          scannerName: targetTicket.scannerMemberName || undefined,
        },
      };
    }

    return {
      status: 'FOUND',
      booking: booking || undefined,
      tickets: allTickets,
      preselectedTicketId: targetTicket.ticketId,
    };
  }

  // ── B. Code might be a Booking ID or legacy format ──
  const booking = await findBookingByTicketNumber(code);
  if (!booking) {
    await recordScanLog('INVALID', code, ctx, member, {
      message: 'This QR code is not recognized.',
    });
    return {
      status: 'INVALID',
      message: 'This QR code is not recognized.',
    };
  }

  if (booking.eventId !== ctx.eventId) {
    const wrongMsg = await buildWrongEventMessage(booking.eventId, {
      eventTitle: (booking as any).eventTitle || (booking as any).eventName,
      committeeName: booking.committeeName,
    });
    await recordScanLog('WRONG_EVENT', code, ctx, member, {
      bookingId: booking.ticketNumber,
      audienceName: booking.customerName,
      ticketType: booking.ticketTypeName,
      message: wrongMsg,
    });
    return {
      status: 'WRONG_EVENT',
      message: wrongMsg,
    };
  }

  if (booking.status === 'Cancelled' || booking.status === 'Refunded') {
    await recordScanLog('CANCELLED', code, ctx, member, {
      bookingId: booking.ticketNumber,
      audienceName: booking.customerName,
      ticketType: booking.ticketTypeName,
      message: 'This booking has been cancelled.',
    });
    return {
      status: 'CANCELLED',
      message: 'This booking has been cancelled.',
    };
  }

  if (booking.status !== 'Confirmed' && booking.status !== 'Checked-in') {
    await recordScanLog('UNPAID', code, ctx, member, {
      bookingId: booking.ticketNumber,
      audienceName: booking.customerName,
      ticketType: booking.ticketTypeName,
      message: 'This ticket is not eligible for entry.',
    });
    return {
      status: 'UNPAID',
      message: 'This ticket is not eligible for entry.',
    };
  }

  let allTickets = await getTicketsByBookingId(booking.ticketNumber);
  if (allTickets.length === 0) {
    const seatsArray = Array.isArray(booking.seats) ? (booking.seats as string[]) : [];
    const totalSeats = seatsArray.length || booking.quantity || 1;
    const usedTickets = (Array.isArray(booking.usedTickets) ? booking.usedTickets : []).map((s: string) =>
      String(s).trim().toUpperCase()
    );
    const usedSeats = (Array.isArray(booking.usedSeats) ? booking.usedSeats : []).map((s: string) =>
      String(s).trim().toUpperCase()
    );

    allTickets = [];
    for (let i = 1; i <= totalSeats; i++) {
      const tid = `${booking.ticketNumber}-${i}`;
      const seatLabel = seatsArray[i - 1] || (totalSeats === 1 ? booking.seatNumber : null) || null;
      const isUsed =
        usedTickets.includes(tid) || (seatLabel && usedSeats.includes(String(seatLabel).toUpperCase()));
      allTickets.push({
        id: tid,
        ticketId: tid,
        bookingId: booking.ticketNumber,
        ticketIndex: i,
        totalTickets: totalSeats,
        eventId: booking.eventId,
        eventName: booking.eventName || '',
        ticketTypeId: booking.ticketTypeId,
        ticketTypeName: booking.ticketTypeName,
        seat: seatLabel || null,
        block: booking.block || null,
        assignedGate: booking.assignedGate,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        serialNumber: tid,
        qrToken: tid,
        status: isUsed ? 'ENTERED' : 'ACTIVE',
        date: booking.date,
        time: booking.time,
        createdAt: booking.time || new Date().toISOString(),
      });
    }
  }

  // Did the code have a specific ticket suffix like NJ26-00001-2?
  const seatMatch = code.match(/-([0-9]+)$/);
  if (seatMatch && Number(seatMatch[1]) > 0) {
    const reqIndex = Number(seatMatch[1]);
    const matched = allTickets.find((t) => t.ticketIndex === reqIndex || t.ticketId === code);
    if (matched) {
      if (matched.status === 'ENTERED') {
        await recordScanLog('ALREADY_USED', matched.ticketId, ctx, member, {
          bookingId: booking.ticketNumber,
          audienceName: booking.customerName,
          ticketType: booking.ticketTypeName,
          seat: matched.seat || undefined,
          previousEntryTime: matched.scanTime || undefined,
          previousScannerId: matched.scannedBy || undefined,
          previousScannerName: matched.scannerMemberName || undefined,
          message: 'This ticket has already been scanned.',
        });
        return {
          status: 'ALREADY_USED',
          message: 'This ticket has already been scanned.',
          booking,
          tickets: allTickets,
          rejectedTicket: {
            ticketId: matched.ticketId,
            seat: matched.seat || undefined,
            entryTime: matched.scanTime || undefined,
            scannerId: matched.scannedBy || undefined,
            scannerName: matched.scannerMemberName || undefined,
          },
        };
      }
      return {
        status: 'FOUND',
        booking,
        tickets: allTickets,
        preselectedTicketId: matched.ticketId,
      };
    }
  }

  // Check if all tickets are already entered
  const activeCount = allTickets.filter((t) => t.status === 'ACTIVE').length;
  if (activeCount === 0 && allTickets.length > 0) {
    await recordScanLog('ALREADY_USED', booking.ticketNumber, ctx, member, {
      bookingId: booking.ticketNumber,
      audienceName: booking.customerName,
      ticketType: booking.ticketTypeName,
      message: 'All tickets for this booking have already been scanned.',
    });
    return {
      status: 'ALREADY_USED',
      message: 'All tickets for this booking have already been scanned.',
      booking,
      tickets: allTickets,
    };
  }

  return {
    status: 'FOUND',
    booking,
    tickets: allTickets,
  };
}

/**
 * Admits multiple selected tickets for a booking in an atomic transaction.
 * Concurrency-safe: each ticket status must be 'ACTIVE' to be consumed.
 */
export async function validateAndRecordBatchEntry(
  ticketIds: string[],
  bookingId: string,
  ctx: EntryContext
): Promise<BatchEntryResult> {
  let member: ScannerMember | null = null;
  if (ctx.memberId === 'ADMIN' || ctx.memberId === 'admin') {
    member = {
      id: 'admin',
      scannerId: 'SCN-ADMIN',
      name: 'Administrator',
      email: 'admin@jatrabazaar.com',
      mobile: '9999999999',
      profilePhoto: '',
      approvalStatus: 'approved',
      accountStatus: 'active',
      createdAt: new Date().toISOString(),
      totalScans: 0,
    };
  } else {
    member = await getScannerMemberOnce(ctx.memberId);
  }

  if (!member || member.approvalStatus !== 'approved' || member.accountStatus !== 'active') {
    return {
      result: 'SCANNER_DENIED',
      message: 'Your scanner terminal access is not active or unauthorized.',
      admittedTickets: [],
      admittedCount: 0,
      remainingCount: 0,
      totalTickets: 0,
      bookingId,
      audienceName: '',
      gateId: ctx.gateId,
      scannerId: '',
      scannerName: '',
      scanTime: '',
      scannedAt: '',
    };
  }

  if (!ticketIds || ticketIds.length === 0) {
    return {
      result: 'INVALID',
      message: 'No tickets selected for admission.',
      admittedTickets: [],
      admittedCount: 0,
      remainingCount: 0,
      totalTickets: 0,
      bookingId,
      audienceName: '',
      gateId: ctx.gateId,
      scannerId: member.scannerId,
      scannerName: member.name,
      scanTime: '',
      scannedAt: '',
    };
  }

  const now = new Date();
  const scanDate = todayStr();
  const scanTime = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const scannedAt = now.toISOString();

  const booking = await findBookingByTicketNumber(bookingId);
  const admittedTickets: TicketItem[] = [];

  try {
    await runTransaction(db, async (tx) => {
      // Phase 1: Reads only — read and validate all selected tickets
      const snapMap = new Map<string, DocumentSnapshot>();
      for (const tid of ticketIds) {
        const tRef = docRef(C.TICKETS, tid);
        const snap = await tx.get(tRef);
        if (snap.exists()) {
          const t = snap.data() as TicketItem;
          if (t.status === 'ENTERED') {
            throw new Error(`ALREADY_USED:${tid}`);
          }
          if (t.status === 'CANCELLED') {
            throw new Error(`CANCELLED:${tid}`);
          }
          if (t.eventId !== ctx.eventId) {
            throw new Error(`WRONG_EVENT:${tid}`);
          }
        }
        snapMap.set(tid, snap);
      }

      // Phase 2: Writes only — perform atomic updates & create ticket entries
      for (const tid of ticketIds) {
        const tRef = docRef(C.TICKETS, tid);
        const snap = snapMap.get(tid);
        let finalItem: TicketItem;

        if (snap && snap.exists()) {
          finalItem = { ...(snap.data() as TicketItem) };
          tx.update(tRef, {
            status: 'ENTERED',
            scannedAt,
            scanDate,
            scanTime,
            scannedBy: member.scannerId,
            scannerMemberId: member.id,
            scannerMemberName: member.name,
            scanGateId: ctx.gateId,
          });
        } else {
          // If tickets collection wasn't seeded for this legacy booking
          const sMatch = tid.match(/-([0-9]+)$/);
          const sIdx = sMatch ? Number(sMatch[1]) : 1;
          const sLabel = booking?.seats?.[sIdx - 1] || booking?.seatNumber || null;
          finalItem = {
            id: tid,
            ticketId: tid,
            bookingId,
            ticketIndex: sIdx,
            totalTickets: booking?.quantity || 1,
            eventId: ctx.eventId,
            eventName: booking?.eventName || '',
            ticketTypeId: booking?.ticketTypeId || '',
            ticketTypeName: booking?.ticketTypeName || '',
            seat: sLabel,
            block: booking?.block || null,
            assignedGate: ctx.gateId,
            customerName: booking?.customerName || '',
            customerPhone: booking?.customerPhone || '',
            serialNumber: tid,
            qrToken: tid,
            status: 'ENTERED',
            date: booking?.date || scanDate,
            time: booking?.time || scanTime,
            scannedAt,
            scanDate,
            scanTime,
            scannedBy: member.scannerId,
            scannerMemberId: member.id,
            scannerMemberName: member.name,
            scanGateId: ctx.gateId,
            createdAt: scannedAt,
          };
          tx.set(tRef, finalItem);
        }

        // Section 17 & 18: Record entry log with unique auto-generated ID
        const entryRef = doc(colRef(C.TICKET_ENTRIES));
        tx.set(entryRef, {
          id: entryRef.id,
          eventId: ctx.eventId,
          scannerId: member.scannerId,
          memberId: member.id,
          scannerName: member.name,
          gateId: ctx.gateId,
          ticketId: tid,
          bookingId,
          ticketNumber: tid,
          seat: finalItem.seat || undefined,
          audienceName: finalItem.customerName || booking?.customerName || '',
          persons: 1,
          ticketType: finalItem.ticketTypeName || booking?.ticketTypeName || '',
          entryStatus: 'entered',
          scanResult: 'SUCCESS',
          scannedAt,
          scanDate,
          scanTime,
        } satisfies TicketEntry);

        admittedTickets.push({
          ...finalItem,
          status: 'ENTERED',
          scannedAt,
          scanDate,
          scanTime,
          scannedBy: member.scannerId,
          scannerMemberId: member.id,
          scannerMemberName: member.name,
          scanGateId: ctx.gateId,
        });
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.startsWith('ALREADY_USED:')) {
      const badId = msg.split(':')[1];
      await recordScanLog('ALREADY_USED', badId, ctx, member, {
        bookingId,
        audienceName: booking?.customerName || '',
        ticketType: booking?.ticketTypeName || '',
        message: `Ticket ${badId} has already been scanned.`,
      });
      return {
        result: 'ALREADY_USED',
        message: `Ticket ${badId} has already been scanned.`,
        admittedTickets: [],
        admittedCount: 0,
        remainingCount: 0,
        totalTickets: 0,
        bookingId,
        audienceName: booking?.customerName || '',
        gateId: ctx.gateId,
        scannerId: member.scannerId,
        scannerName: member.name,
        scanTime,
        scannedAt,
      };
    }
    if (msg.startsWith('CANCELLED:')) {
      const badId = msg.split(':')[1];
      await recordScanLog('CANCELLED', badId, ctx, member, {
        bookingId,
        audienceName: booking?.customerName || '',
        ticketType: booking?.ticketTypeName || '',
        message: `Ticket ${badId} is cancelled.`,
      });
      return {
        result: 'CANCELLED',
        message: `Ticket ${badId} is cancelled.`,
        admittedTickets: [],
        admittedCount: 0,
        remainingCount: 0,
        totalTickets: 0,
        bookingId,
        audienceName: booking?.customerName || '',
        gateId: ctx.gateId,
        scannerId: member.scannerId,
        scannerName: member.name,
        scanTime,
        scannedAt,
      };
    }
    if (msg.startsWith('WRONG_EVENT:')) {
      const badId = msg.split(':')[1];
      const wrongMsg = await buildWrongEventMessage(booking?.eventId, {
        eventTitle: (booking as any)?.eventTitle || (booking as any)?.eventName,
        committeeName: booking?.committeeName,
      });
      await recordScanLog('WRONG_EVENT', badId, ctx, member, {
        bookingId,
        audienceName: booking?.customerName || '',
        ticketType: booking?.ticketTypeName || '',
        message: wrongMsg,
      });
      return {
        result: 'WRONG_EVENT',
        message: wrongMsg,
        admittedTickets: [],
        admittedCount: 0,
        remainingCount: 0,
        totalTickets: 0,
        bookingId,
        audienceName: booking?.customerName || '',
        gateId: ctx.gateId,
        scannerId: member.scannerId,
        scannerName: member.name,
        scanTime,
        scannedAt,
      };
    }
    throw err;
  }

  // 3. Update parent booking record & mirror to Supabase
  let audienceName = booking?.customerName || admittedTickets[0]?.customerName || '';
  let ticketType = booking?.ticketTypeName || admittedTickets[0]?.ticketTypeName || '';
  let totalTickets = booking?.quantity || (Array.isArray(booking?.seats) ? booking.seats.length : 1);
  let remainingCount = 0;

  try {
    const bQuery = query(colRef(C.BOOKINGS), where('ticketNumber', '==', bookingId));
    let bSnap = await getDocs(bQuery);
    let bDoc: any = !bSnap.empty ? bSnap.docs[0] : null;
    if (!bDoc) {
      const directDoc = await getDoc(docRef(C.BOOKINGS, bookingId));
      if (directDoc.exists()) bDoc = directDoc;
    }

    if (bDoc) {
      const bData = bDoc.data() as BookingItem;
      audienceName = bData.customerName || audienceName;
      ticketType = bData.ticketTypeName || ticketType;
      totalTickets = bData.quantity || (Array.isArray(bData.seats) ? bData.seats.length : totalTickets);

      const existingUsed = (Array.isArray(bData.usedTickets) ? bData.usedTickets : []).map(String);
      const nextUsed = Array.from(new Set([...existingUsed, ...ticketIds]));

      const admittedSeats = admittedTickets.map((t) => t.seat).filter(Boolean) as string[];
      const existingSeats = (Array.isArray(bData.usedSeats) ? bData.usedSeats : []).map(String);
      const nextSeats = Array.from(new Set([...existingSeats, ...admittedSeats]));

      const enteredCount = nextUsed.length;
      remainingCount = Math.max(0, totalTickets - enteredCount);

      const bookingPatch = {
        usedTickets: nextUsed,
        usedSeats: nextSeats,
        usedCount: enteredCount,
        enteredCount,
        remainingCount,
        lastScannedAt: scannedAt,
        ...(enteredCount >= totalTickets ? { status: 'Checked-in', bookingStatus: 'Checked-in', usedAt: scannedAt } : {}),
      };

      await updateDoc(bDoc.ref, bookingPatch);
      sbMirrorBookingUpdate(bDoc.id, bookingPatch);
      if (bData.ticketNumber) {
        sbMirrorBookingUpdate(bData.ticketNumber, bookingPatch);
      }
      if (bookingId && bookingId !== bDoc.id && bookingId !== bData.ticketNumber) {
        sbMirrorBookingUpdate(bookingId, bookingPatch);
      }
    }
  } catch (err) {
    console.warn('Failed to update parent booking after batch entry:', err);
  }

  // Mirror admitted tickets and ticket entries to Supabase
  for (const t of admittedTickets) {
    sbMirrorTicketUpdate(t.ticketId, {
      status: 'ENTERED',
      scannedAt: t.scannedAt,
      scanDate: t.scanDate,
      scanTime: t.scanTime,
      scannedBy: member.scannerId,
      scannerMemberId: member.id,
      scannerMemberName: member.name,
      scanGateId: ctx.gateId,
    });
    sbMirrorTicketEntry({
      id: `${ctx.eventId}__${t.ticketId}__${Date.now()}`,
      eventId: ctx.eventId,
      scannerId: member.scannerId,
      memberId: member.id,
      scannerName: member.name,
      gateId: ctx.gateId,
      ticketId: t.ticketId,
      bookingId,
      ticketNumber: t.ticketId,
      seat: t.seat || undefined,
      audienceName: t.customerName || booking?.customerName || '',
      persons: 1,
      ticketType: t.ticketTypeName || booking?.ticketTypeName || '',
      entryStatus: 'entered',
      scanResult: 'SUCCESS',
      scannedAt: t.scannedAt,
      scanDate: t.scanDate,
      scanTime: t.scanTime,
    });
  }

  // 4. Update gate counters
  try {
    const gateSnap = await getDoc(docRef(C.GATES, ctx.gateId));
    if (gateSnap.exists()) {
      const gate = gateSnap.data() as GateInfo;
      const newEntered = gate.entered + ticketIds.length;
      await updateDoc(docRef(C.GATES, ctx.gateId), {
        entered: newEntered,
        percentage: Math.min(100, Math.round((newEntered / gate.capacity) * 100)),
        status: newEntered >= gate.capacity ? 'full' : newEntered >= gate.capacity * 0.8 ? 'congested' : 'normal',
      });
    }
  } catch (err) {
    console.warn('Failed to update gate counter:', err);
  }

  // 5. Update scanner member stats
  try {
    if (member.id !== 'admin') {
      const memberSnap = await getDoc(docRef(C.SCANNER_MEMBERS, member.id));
      if (memberSnap.exists()) {
        const m = memberSnap.data() as ScannerMember;
        await updateDoc(docRef(C.SCANNER_MEMBERS, member.id), {
          totalScans: (m.totalScans || 0) + ticketIds.length,
          lastScanAt: scannedAt,
        });
      }
    }
  } catch (err) {
    console.warn('Failed to update scanner stats:', err);
  }

  // 6. Write Audit Log
  await writeAuditLog({
    action: 'entry.batch_accepted',
    performedBy: member.scannerId,
    targetId: bookingId,
    metadata: {
      eventId: ctx.eventId,
      gateId: ctx.gateId,
      bookingId,
      ticketIds: ticketIds.join(','),
      count: ticketIds.length,
    },
  });

  return {
    result: 'SUCCESS',
    message: `${ticketIds.length} ticket${ticketIds.length > 1 ? 's' : ''} admitted for entry.`,
    admittedTickets,
    admittedCount: ticketIds.length,
    remainingCount,
    totalTickets,
    bookingId,
    audienceName,
    ticketType,
    gateId: ctx.gateId,
    scannerId: member.scannerId,
    scannerName: member.name,
    scanTime,
    scannedAt,
  };
}

/**
 * Full server-side (Firestore) ticket validation + atomic entry recording.
 * - Re-reads the scanner member from the database (never trusts the client session)
 * - Uses an atomic transaction so two scanners can never both accept the same ticket
 */
export async function validateAndRecordEntry(
  rawCode: string,
  ctx: EntryContext
): Promise<EntryResult> {
  const code = (rawCode || '').trim();

  // 1. Scanner authorization — enforced against the database on every scan
  let member: ScannerMember | null = null;
  if (ctx.memberId === 'ADMIN' || ctx.memberId === 'admin') {
    member = {
      id: 'admin',
      scannerId: 'SCN-ADMIN',
      name: 'Administrator',
      email: 'admin@jatrabazaar.com',
      mobile: '9999999999',
      profilePhoto: '',
      approvalStatus: 'approved',
      accountStatus: 'active',
      createdAt: new Date().toISOString(),
      totalScans: 0,
    };
  } else {
    member = await getScannerMemberOnce(ctx.memberId);
  }

  if (!member || member.approvalStatus !== 'approved' || member.accountStatus !== 'active') {
    return {
      result: 'SCANNER_DENIED',
      message:
        member?.approvalStatus === 'pending'
          ? 'Your scanner account is waiting for admin approval.'
          : member?.approvalStatus === 'rejected'
            ? 'Your scanner access has been rejected.'
            : 'Your scanner account has been deactivated.',
    };
  }

  // 2. Extract ticket id from QR (JSON payload or plain code)
  let ticketNumber = code;
  let qrSeat = '';
  let qrSeatIndex: number | undefined;

  let payloadStr = code.trim();
  if (payloadStr.includes('{') || payloadStr.toLowerCase().includes('%7b')) {
    if (!payloadStr.startsWith('{')) {
      try {
        payloadStr = decodeURIComponent(payloadStr);
      } catch {
        /* keep original */
      }
    }
    try {
      const parsed = JSON.parse(payloadStr);
      if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, unknown>;
        const key = Object.keys(record).find((name) =>
          QR_ID_KEYS.some((candidate) => candidate === name.toLowerCase())
        );
        ticketNumber = key ? String(record[key] ?? '') : '';
        qrSeat = String(record['seat'] || record['seatNumber'] || '').trim();
        const sIdx = Number(record['seatIndex']);
        if (Number.isFinite(sIdx)) qrSeatIndex = sIdx;
      }
    } catch {
      /* plain ticket code */
    }
  }
  ticketNumber = ticketNumber.trim().toUpperCase();
  if (!ticketNumber) {
    return { result: 'INVALID', message: 'This ticket could not be verified.' };
  }

  const rawTicketId = ticketNumber;

  // Helper to log rejections
  const logRejection = async (
    result: EntryResult['result'],
    ticketId: string,
    extra: Partial<TicketEntry> & { bookingId?: string; message?: string } = {}
  ): Promise<EntryResult> => {
    try {
      await addDoc(colRef(C.TICKET_ENTRIES), {
        eventId: ctx.eventId,
        scannerId: member.scannerId,
        memberId: member.id,
        scannerName: member.name,
        gateId: ctx.gateId,
        ticketId,
        ticketNumber: ticketId,
        entryStatus: 'rejected',
        scanResult: result,
        scannedAt: new Date().toISOString(),
        audienceName: extra.audienceName,
        persons: extra.persons || 1,
        ticketType: extra.ticketType,
        seat: extra.seat,
        previousEntryTime: extra.previousEntryTime,
        previousScannerId: extra.previousScannerId,
        previousGateId: extra.previousGateId,
      } satisfies Omit<TicketEntry, 'id'>);
    } catch (err) {
      console.warn('Failed to log rejected scan:', err);
    }
    await writeAuditLog({
      action: 'entry.rejected',
      performedBy: member.scannerId,
      targetId: ticketId,
      metadata: { result, eventId: ctx.eventId, bookingId: extra.bookingId || '' },
    });
    return { result, ticketId, ...extra } as EntryResult;
  };

  // 3. Look up individual ticket in the "tickets" collection first
  let ticketRecord: TicketItem | null = null;
  let ticketDocRef = docRef(C.TICKETS, rawTicketId);
  try {
    const directSnap = await getDoc(ticketDocRef);
    if (directSnap.exists()) {
      ticketRecord = { id: directSnap.id, ...directSnap.data() } as TicketItem;
    }
  } catch (err) {
    console.warn('Error reading ticket doc:', err);
  }

  if (!ticketRecord) {
    try {
      const qById = query(colRef(C.TICKETS), where('ticketId', '==', rawTicketId));
      const sById = await getDocs(qById);
      if (!sById.empty) {
        ticketRecord = { id: sById.docs[0].id, ...sById.docs[0].data() } as TicketItem;
        ticketDocRef = sById.docs[0].ref;
      }
    } catch {}
  }

  if (!ticketRecord) {
    try {
      const qByToken = query(colRef(C.TICKETS), where('qrToken', '==', rawTicketId));
      const sByToken = await getDocs(qByToken);
      if (!sByToken.empty) {
        ticketRecord = { id: sByToken.docs[0].id, ...sByToken.docs[0].data() } as TicketItem;
        ticketDocRef = sByToken.docs[0].ref;
      }
    } catch {}
  }

  // ─── Individual Ticket Lifecycle Path ──────────────────────────────
  if (ticketRecord) {
    const tItem = ticketRecord;

    // A. Check event match
    if (tItem.eventId !== ctx.eventId) {
      const wrongMsg = await buildWrongEventMessage(tItem.eventId, {
        eventTitle: (tItem as any).eventTitle || (tItem as any).eventName,
        committeeName: tItem.committeeName,
      });
      return await logRejection('WRONG_EVENT', tItem.ticketId, {
        bookingId: tItem.bookingId,
        audienceName: tItem.customerName,
        ticketType: tItem.ticketTypeName,
        seat: tItem.seat || undefined,
        message: wrongMsg,
      });
    }

    // B. Check cancellation
    if (tItem.status === 'CANCELLED') {
      return await logRejection('CANCELLED', tItem.ticketId, {
        bookingId: tItem.bookingId,
        audienceName: tItem.customerName,
        ticketType: tItem.ticketTypeName,
        seat: tItem.seat || undefined,
        message: 'This ticket is not valid for entry (Cancelled).',
      });
    }

    // C. Check already entered
    if (tItem.status === 'ENTERED') {
      const prevTime =
        tItem.scanTime ||
        (tItem.scannedAt
          ? new Date(tItem.scannedAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })
          : undefined);
      return await logRejection('ALREADY_USED', tItem.ticketId, {
        bookingId: tItem.bookingId,
        audienceName: tItem.customerName,
        ticketType: tItem.ticketTypeName,
        seat: tItem.seat || undefined,
        previousEntryTime: prevTime,
        previousScannerId: tItem.scannedBy || tItem.scannerMemberId || undefined,
        previousScannerName: tItem.scannerMemberName || undefined,
        message: 'This ticket has already been scanned.',
      });
    }

    // D. Atomic entry transaction (concurrency-safe single consumption)
    const now = new Date();
    const scanDate = todayStr();
    const scanTime = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    const scannedAt = now.toISOString();

    let won = false;
    let prevScanData: { time?: string; scannerId?: string; scannerName?: string } | null = null;

    try {
      await runTransaction(db, async (tx) => {
        const freshSnap = await tx.get(ticketDocRef);
        if (!freshSnap.exists()) {
          throw new Error('NOT_FOUND');
        }
        const current = freshSnap.data() as TicketItem;
        if (current.status === 'ENTERED') {
          prevScanData = {
            time:
              current.scanTime ||
              (current.scannedAt
                ? new Date(current.scannedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })
                : undefined),
            scannerId: current.scannedBy || current.scannerMemberId || undefined,
            scannerName: current.scannerMemberName || undefined,
          };
          return;
        }
        if (current.status === 'CANCELLED') {
          throw new Error('CANCELLED');
        }
        if (current.eventId !== ctx.eventId) {
          throw new Error('WRONG_EVENT');
        }

        // Section 18: Atomic state transition to ENTERED
        tx.update(ticketDocRef, {
          status: 'ENTERED',
          scannedAt,
          scanDate,
          scanTime,
          scannedBy: member.scannerId,
          scannerMemberId: member.id,
          scannerMemberName: member.name,
          scanGateId: ctx.gateId,
        });

        // Section 17: Record entry log with unique auto-generated ID
        const entryRef = doc(colRef(C.TICKET_ENTRIES));
        tx.set(entryRef, {
          id: entryRef.id,
          eventId: ctx.eventId,
          scannerId: member.scannerId,
          memberId: member.id,
          scannerName: member.name,
          gateId: ctx.gateId,
          ticketId: current.ticketId,
          bookingId: current.bookingId,
          ticketNumber: current.ticketId,
          seat: current.seat || undefined,
          audienceName: current.customerName,
          persons: 1,
          ticketType: current.ticketTypeName,
          entryStatus: 'entered',
          scanResult: 'SUCCESS',
          scannedAt,
          scanDate,
          scanTime,
        } satisfies TicketEntry);

        won = true;
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg === 'CANCELLED') {
        return await logRejection('CANCELLED', tItem.ticketId, {
          bookingId: tItem.bookingId,
          audienceName: tItem.customerName,
          message: 'This ticket is not valid for entry (Cancelled).',
        });
      }
      if (errMsg === 'WRONG_EVENT') {
        const wrongMsg = await buildWrongEventMessage(tItem.eventId, {
          eventTitle: (tItem as any).eventTitle || (tItem as any).eventName,
          committeeName: tItem.committeeName,
        });
        return await logRejection('WRONG_EVENT', tItem.ticketId, {
          bookingId: tItem.bookingId,
          audienceName: tItem.customerName,
          message: wrongMsg,
        });
      }
    }

    if (!won) {
      const prevInfo = prevScanData as { time?: string; scannerId?: string; scannerName?: string } | null;
      return await logRejection('ALREADY_USED', tItem.ticketId, {
        bookingId: tItem.bookingId,
        audienceName: tItem.customerName,
        seat: tItem.seat || undefined,
        previousEntryTime: prevInfo?.time,
        previousScannerId: prevInfo?.scannerId,
        previousScannerName: prevInfo?.scannerName,
        message: 'This ticket has already been scanned.',
      });
    }

    // Mirror admitted ticket and entry log to Supabase
    sbMirrorTicketUpdate(tItem.ticketId, {
      status: 'ENTERED',
      scannedAt,
      scanDate,
      scanTime,
      scannedBy: member.scannerId,
      scannerMemberId: member.id,
      scannerMemberName: member.name,
      scanGateId: ctx.gateId,
    });
    sbMirrorTicketEntry({
      id: `${ctx.eventId}__${tItem.ticketId}__${Date.now()}`,
      eventId: ctx.eventId,
      scannerId: member.scannerId,
      memberId: member.id,
      scannerName: member.name,
      gateId: ctx.gateId,
      ticketId: tItem.ticketId,
      bookingId: tItem.bookingId,
      ticketNumber: tItem.ticketId,
      seat: tItem.seat || undefined,
      audienceName: tItem.customerName,
      persons: 1,
      ticketType: tItem.ticketTypeName,
      entryStatus: 'entered',
      scanResult: 'SUCCESS',
      scannedAt,
      scanDate,
      scanTime,
    });

    // E. Best-effort update of parent booking counters & progress
    try {
      const bQuery = query(colRef(C.BOOKINGS), where('ticketNumber', '==', tItem.bookingId));
      let bSnap = await getDocs(bQuery);
      let bDoc: any = !bSnap.empty ? bSnap.docs[0] : null;
      if (!bDoc) {
        const directDoc = await getDoc(docRef(C.BOOKINGS, tItem.bookingId));
        if (directDoc.exists()) bDoc = directDoc;
      }

      if (bDoc) {
        const bData = bDoc.data() as BookingItem;
        const existingUsed = (Array.isArray(bData.usedTickets) ? bData.usedTickets : []).map(String);
        const nextUsed = Array.from(new Set([...existingUsed, tItem.ticketId]));
        const existingUsedSeats = (Array.isArray(bData.usedSeats) ? bData.usedSeats : []).map(String);
        const nextUsedSeats = tItem.seat
          ? Array.from(new Set([...existingUsedSeats, tItem.seat]))
          : existingUsedSeats;
        const totalTickets = bData.quantity || (Array.isArray(bData.seats) ? bData.seats.length : 1);
        const enteredCount = nextUsed.length;
        const remainingCount = Math.max(0, totalTickets - enteredCount);

        const bookingPatch = {
          usedTickets: nextUsed,
          usedSeats: nextUsedSeats,
          usedCount: enteredCount,
          enteredCount,
          remainingCount,
          lastScannedAt: scannedAt,
          ...(enteredCount >= totalTickets ? { status: 'Checked-in', bookingStatus: 'Checked-in', usedAt: scannedAt } : {}),
        };

        await updateDoc(bDoc.ref, bookingPatch);
        sbMirrorBookingUpdate(bDoc.id, bookingPatch);
        if (bData.ticketNumber) {
          sbMirrorBookingUpdate(bData.ticketNumber, bookingPatch);
        }
        if (tItem.bookingId && tItem.bookingId !== bDoc.id && tItem.bookingId !== bData.ticketNumber) {
          sbMirrorBookingUpdate(tItem.bookingId, bookingPatch);
        }
      }
    } catch (err) {
      console.warn('Failed to update parent booking:', err);
    }

    // F. Update gate counters
    try {
      const gateSnap = await getDoc(docRef(C.GATES, ctx.gateId));
      if (gateSnap.exists()) {
        const gate = gateSnap.data() as GateInfo;
        const newEntered = gate.entered + 1;
        await updateDoc(docRef(C.GATES, ctx.gateId), {
          entered: newEntered,
          percentage: Math.round((newEntered / gate.capacity) * 100),
          status:
            newEntered >= gate.capacity
              ? 'full'
              : newEntered >= gate.capacity * 0.8
                ? 'congested'
                : 'normal',
        });
      }
    } catch (err) {
      console.warn('Failed to update gate counter:', err);
    }

    // G. Update scanner member stats
    try {
      const memberSnap = await getDoc(docRef(C.SCANNER_MEMBERS, member.id));
      if (memberSnap.exists()) {
        const m = memberSnap.data() as ScannerMember;
        await updateDoc(docRef(C.SCANNER_MEMBERS, member.id), {
          totalScans: (m.totalScans || 0) + 1,
          lastScanAt: scannedAt,
        });
      }
    } catch (err) {
      console.warn('Failed to update scanner stats:', err);
    }

    await writeAuditLog({
      action: 'entry.accepted',
      performedBy: member.scannerId,
      targetId: tItem.ticketId,
      metadata: {
        eventId: ctx.eventId,
        gateId: ctx.gateId,
        bookingId: tItem.bookingId,
        seat: tItem.seat || '',
        persons: 1,
      },
    });

    return {
      result: 'SUCCESS',
      ticketId: tItem.ticketId,
      bookingId: tItem.bookingId,
      audienceName: tItem.customerName,
      seat: tItem.seat || undefined,
      block: tItem.block || undefined,
      ticketType: tItem.ticketTypeName,
      entryTime: scanTime,
      scannedAt,
      scannerId: member.scannerId,
      scannerName: member.name,
      persons: 1,
      message: 'Attendee entry allowed.',
    };
  }

  // ─── Legacy Booking Fallback Path ──────────────────────────────────
  const booking = await findBookingByTicketNumber(rawTicketId);
  if (!booking) {
    return await logRejection('INVALID', rawTicketId, {
      message: 'This QR code is not recognized.',
    });
  }

  const canonicalBookingNumber = booking.ticketNumber;
  const seatsArray = Array.isArray(booking.seats) ? (booking.seats as string[]) : [];
  const totalSeats = seatsArray.length || booking.quantity || 1;

  let seatIndex = qrSeatIndex;
  let specificTicketId = rawTicketId;

  const seatMatch = rawTicketId.match(/-([0-9]+)$/);
  if (seatMatch && Number(seatMatch[1]) > 0 && Number(seatMatch[1]) <= totalSeats) {
    if (!seatIndex) seatIndex = Number(seatMatch[1]);
  } else if (totalSeats > 1 && !rawTicketId.includes('-', canonicalBookingNumber.length)) {
    const usedTickets = (Array.isArray(booking.usedTickets) ? booking.usedTickets : []).map((s: string) =>
      String(s).trim().toUpperCase()
    );
    const usedSeats = (Array.isArray(booking.usedSeats) ? booking.usedSeats : []).map((s: string) =>
      String(s).trim().toUpperCase()
    );
    let foundUnusedIndex = -1;
    for (let i = 0; i < totalSeats; i++) {
      const candTicket = `${canonicalBookingNumber}-${i + 1}`.toUpperCase();
      const candSeat = (seatsArray[i] || '').toUpperCase();
      if (!usedTickets.includes(candTicket) && (!candSeat || !usedSeats.includes(candSeat))) {
        foundUnusedIndex = i + 1;
        break;
      }
    }
    if (foundUnusedIndex > 0) {
      seatIndex = foundUnusedIndex;
      specificTicketId = `${canonicalBookingNumber}-${seatIndex}`;
    }
  }

  let seatLabel = qrSeat || '';
  if (!seatLabel && seatIndex && seatsArray[seatIndex - 1]) {
    seatLabel = String(seatsArray[seatIndex - 1]);
  } else if (!seatLabel && booking.seatNumber) {
    seatLabel = String(booking.seatNumber);
  }

  if (booking.eventId !== ctx.eventId) {
    const wrongMsg = await buildWrongEventMessage(booking.eventId, {
      eventTitle: (booking as any).eventTitle || (booking as any).eventName,
      committeeName: booking.committeeName,
    });
    return await logRejection('WRONG_EVENT', specificTicketId, {
      bookingId: canonicalBookingNumber,
      audienceName: booking.customerName,
      ticketType: booking.ticketTypeName,
      message: wrongMsg,
    });
  }

  if (booking.status === 'Cancelled' || booking.status === 'Refunded') {
    return await logRejection('CANCELLED', specificTicketId, {
      bookingId: canonicalBookingNumber,
      audienceName: booking.customerName,
      ticketType: booking.ticketTypeName,
      message: 'This ticket has been cancelled.',
    });
  }

  if (booking.status !== 'Confirmed' && booking.status !== 'Checked-in') {
    return await logRejection('UNPAID', specificTicketId, {
      bookingId: canonicalBookingNumber,
      audienceName: booking.customerName,
      ticketType: booking.ticketTypeName,
      message: 'This ticket is not eligible for entry.',
    });
  }

  const legacyUsedTickets = (Array.isArray(booking.usedTickets) ? booking.usedTickets : []).map((s: string) =>
    String(s).trim().toUpperCase()
  );
  if (legacyUsedTickets.includes(specificTicketId.toUpperCase())) {
    return await logRejection('ALREADY_USED', specificTicketId, {
      bookingId: canonicalBookingNumber,
      audienceName: booking.customerName,
      ticketType: booking.ticketTypeName,
      message: 'This ticket has already been used for entry.',
    });
  }

  // Atomic duplicate check on TICKET_ENTRIES for legacy
  const legacyEntryRef = docRef(C.TICKET_ENTRIES, entryDocId(ctx.eventId, specificTicketId));
  let legacyAlreadyUsed: { entryTime?: string; scannerId?: string; scannerName?: string } | null = null;
  const legacyNow = new Date();
  const legacyScanDate = todayStr();
  const legacyScanTime = legacyNow.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const legacyScannedAt = legacyNow.toISOString();

  const legacyWon = await runTransaction(db, async (tx) => {
    const existing = await tx.get(legacyEntryRef);
    if (existing.exists()) {
      const e = existing.data() as TicketEntry;
      if (e.entryStatus === 'entered') {
        legacyAlreadyUsed = {
          entryTime: e.scannedAt,
          scannerId: e.scannerId,
          scannerName: e.scannerName,
        };
        return false;
      }
    }
    tx.set(legacyEntryRef, {
      eventId: ctx.eventId,
      scannerId: member.scannerId,
      memberId: member.id,
      scannerName: member.name,
      gateId: ctx.gateId,
      ticketId: specificTicketId,
      bookingId: canonicalBookingNumber,
      ticketNumber: specificTicketId,
      audienceName: booking.customerName,
      persons: 1,
      ticketType: booking.ticketTypeName,
      bookingSource: booking.source,
      entryStatus: 'entered',
      scanResult: 'SUCCESS',
      scannedAt: legacyScannedAt,
      scanDate: legacyScanDate,
      scanTime: legacyScanTime,
      seat: seatLabel || undefined,
    });
    return true;
  });

  if (!legacyWon) {
    const prevLegacy = legacyAlreadyUsed as { entryTime?: string; scannerId?: string; scannerName?: string } | null;
    return await logRejection('ALREADY_USED', specificTicketId, {
      bookingId: canonicalBookingNumber,
      audienceName: booking.customerName,
      ticketType: booking.ticketTypeName,
      previousEntryTime: prevLegacy?.entryTime,
      previousScannerId: prevLegacy?.scannerId,
      previousScannerName: prevLegacy?.scannerName,
      message: 'This ticket has already been used for entry.',
    });
  }

  // Update parent booking & create tickets record & mirror to Supabase
  try {
    const nextUsed = Array.from(new Set([...(booking.usedTickets || []), specificTicketId]));
    const nextUsedSeats = seatLabel
      ? Array.from(new Set([...(booking.usedSeats || []), seatLabel]))
      : booking.usedSeats || [];
    const enteredCount = nextUsed.length;
    const remainingCount = Math.max(0, totalSeats - enteredCount);

    const bookingPatch = {
      usedTickets: nextUsed,
      usedSeats: nextUsedSeats,
      usedCount: enteredCount,
      enteredCount,
      remainingCount,
      lastScannedAt: legacyScannedAt,
      ...(enteredCount >= totalSeats ? { status: 'Checked-in', bookingStatus: 'Checked-in', usedAt: legacyScannedAt } : {}),
    };

    await updateDoc(docRef(C.BOOKINGS, booking.id), bookingPatch);
    sbMirrorBookingUpdate(booking.id, bookingPatch);
    if (canonicalBookingNumber && canonicalBookingNumber !== booking.id) {
      sbMirrorBookingUpdate(canonicalBookingNumber, bookingPatch);
    }

    const legacyTicketItem: TicketItem = {
      id: specificTicketId,
      ticketId: specificTicketId,
      bookingId: canonicalBookingNumber,
      ticketIndex: seatIndex || 1,
      totalTickets: totalSeats,
      eventId: booking.eventId,
      eventName: booking.eventName || '',
      ticketTypeId: booking.ticketTypeId,
      ticketTypeName: booking.ticketTypeName,
      seat: seatLabel || null,
      block: booking.block || null,
      assignedGate: booking.assignedGate,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      serialNumber: specificTicketId,
      qrToken: specificTicketId,
      status: 'ENTERED',
      date: booking.date,
      time: booking.time,
      scannedAt: legacyScannedAt,
      scanDate: legacyScanDate,
      scanTime: legacyScanTime,
      scannedBy: member.scannerId,
      scannerMemberId: member.id,
      scannerMemberName: member.name,
      scanGateId: ctx.gateId,
      createdAt: booking.time || legacyScannedAt,
    };

    // Create tickets doc for future scans
    await setDoc(docRef(C.TICKETS, specificTicketId), legacyTicketItem);
    sbMirrorTicket(legacyTicketItem as unknown as Record<string, unknown>);
    sbMirrorTicketUpdate(specificTicketId, {
      status: 'ENTERED',
      scannedAt: legacyScannedAt,
      scanDate: legacyScanDate,
      scanTime: legacyScanTime,
      scannedBy: member.scannerId,
      scannerMemberId: member.id,
      scannerMemberName: member.name,
      scanGateId: ctx.gateId,
    });

    sbMirrorTicketEntry({
      id: legacyEntryRef.id,
      eventId: ctx.eventId,
      scannerId: member.scannerId,
      memberId: member.id,
      scannerName: member.name,
      gateId: ctx.gateId,
      ticketId: specificTicketId,
      bookingId: canonicalBookingNumber,
      ticketNumber: specificTicketId,
      audienceName: booking.customerName,
      persons: 1,
      ticketType: booking.ticketTypeName,
      bookingSource: booking.source,
      entryStatus: 'entered',
      scanResult: 'SUCCESS',
      scannedAt: legacyScannedAt,
      scanDate: legacyScanDate,
      scanTime: legacyScanTime,
      seat: seatLabel || undefined,
    });
  } catch (err) {
    console.warn('Failed to update legacy booking counters:', err);
  }

  try {
    const gateSnap = await getDoc(docRef(C.GATES, ctx.gateId));
    if (gateSnap.exists()) {
      const gate = gateSnap.data() as GateInfo;
      const newEntered = gate.entered + 1;
      await updateDoc(docRef(C.GATES, ctx.gateId), {
        entered: newEntered,
        percentage: Math.round((newEntered / gate.capacity) * 100),
      });
    }
  } catch {}

  try {
    const memberSnap = await getDoc(docRef(C.SCANNER_MEMBERS, member.id));
    if (memberSnap.exists()) {
      const m = memberSnap.data() as ScannerMember;
      await updateDoc(docRef(C.SCANNER_MEMBERS, member.id), {
        totalScans: (m.totalScans || 0) + 1,
        lastScanAt: legacyScannedAt,
      });
    }
  } catch {}

  await writeAuditLog({
    action: 'entry.accepted',
    performedBy: member.scannerId,
    targetId: specificTicketId,
    metadata: { eventId: ctx.eventId, gateId: ctx.gateId, persons: 1, seat: seatLabel },
  });

  return {
    result: 'SUCCESS',
    ticketId: specificTicketId,
    bookingId: canonicalBookingNumber,
    audienceName: booking.customerName,
    seat: seatLabel || undefined,
    block: booking.block || undefined,
    ticketType: booking.ticketTypeName,
    bookingSource: booking.source,
    gateId: ctx.gateId,
    entryTime: legacyScanTime,
    scannedAt: legacyScannedAt,
    scannerId: member.scannerId,
    scannerName: member.name,
    persons: 1,
    message: 'Attendee entry allowed.',
  };
}

// ─── Individual Tickets helpers ───────────────────────────────────

export function listenTicketsByBookingId(
  bookingId: string,
  callback: (tickets: TicketItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  let active = true;
  const fsMap = new Map<string, TicketItem>();
  const sbMap = new Map<string, TicketItem>();

  const emit = () => {
    if (!active) return;
    const merged = new Map<string, TicketItem>();
    fsMap.forEach((t, id) => merged.set(id, t));
    sbMap.forEach((t, id) => merged.set(id, t));
    const tickets = Array.from(merged.values());
    tickets.sort((a, b) => (a.ticketIndex || 0) - (b.ticketIndex || 0));
    callback(tickets);
  };

  // 1. Supabase initial fetch
  if (bookingId) {
    Promise.resolve(
      sb.from('tickets')
        .select('*')
        .or(`booking_id.eq.${bookingId},booking_doc_id.eq.${bookingId},id.eq.${bookingId}`)
    )
      .then(({ data, error }: any) => {
        if (!active) return;
        if (!error && Array.isArray(data)) {
          data.forEach((row) => {
            const t = mapSupabaseTicket(row);
            sbMap.set(t.id, t);
            safeSetDoc(doc(colRef(C.TICKETS), t.id), t, { merge: true });
          });
          emit();
        }
      })
      .catch((err: any) => console.warn('listenTicketsByBookingId Supabase fetch error:', err));
  }

  // 2. Supabase Realtime channel
  const channelName = `tickets-rt-${bookingId}-${Math.random().toString(36).slice(2, 9)}`;
  const channel = sb
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tickets' },
      (payload) => {
        if (!active) return;
        if (payload.new) {
          const row = payload.new as Record<string, unknown>;
          if (row.booking_id === bookingId || row.booking_doc_id === bookingId || row.id === bookingId) {
            const t = mapSupabaseTicket(row);
            sbMap.set(t.id, t);
            safeSetDoc(doc(colRef(C.TICKETS), t.id), t, { merge: true });
            emit();
          }
        }
      }
    )
    .subscribe();

  // 3. Firestore onSnapshot
  const q = query(colRef(C.TICKETS), where('bookingId', '==', bookingId));
  const unsubFs = onSnapshot(
    q,
    (snap) => {
      if (!active) return;
      fsMap.clear();
      snap.docs.forEach((d) => fsMap.set(d.id, { id: d.id, ...d.data() } as TicketItem));
      emit();
    },
    (err) => {
      console.warn('listenTicketsByBookingId error:', err);
      onError?.(err);
      emit();
    }
  );

  return () => {
    active = false;
    unsubFs();
    sb.removeChannel(channel);
  };
}

export async function getTicketsByBookingId(bookingId: string): Promise<TicketItem[]> {
  const merged = new Map<string, TicketItem>();
  try {
    const q = query(colRef(C.TICKETS), where('bookingId', '==', bookingId));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() } as TicketItem));
  } catch (err) {
    console.warn('getTicketsByBookingId Firestore error:', err);
  }

  try {
    const { data } = await sb
      .from('tickets')
      .select('*')
      .or(`booking_id.eq.${bookingId},booking_doc_id.eq.${bookingId},id.eq.${bookingId}`);
    if (Array.isArray(data)) {
      data.forEach((row) => {
        const t = mapSupabaseTicket(row);
        merged.set(t.id, t);
      });
    }
  } catch (err) {
    console.warn('getTicketsByBookingId Supabase error:', err);
  }

  const tickets = Array.from(merged.values());
  tickets.sort((a, b) => (a.ticketIndex || 0) - (b.ticketIndex || 0));
  return tickets;
}

// ─── Scan history & stats ────────────────────────────────────────

export async function getTicketEntriesOnce(): Promise<TicketEntry[]> {
  const snap = await getDocs(colRef(C.TICKET_ENTRIES));
  const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TicketEntry));
  entries.sort((a, b) => (b.scannedAt || '').localeCompare(a.scannedAt || ''));
  return entries;
}

export function listenTicketEntries(
  callback: (entries: TicketEntry[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    colRef(C.TICKET_ENTRIES),
    (snap) => {
      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TicketEntry));
      entries.sort((a, b) => (b.scannedAt || '').localeCompare(a.scannedAt || ''));
      callback(entries);
    },
    (err) => {
      console.error('listenTicketEntries error:', err);
      onError?.(err);
    }
  );
}

export interface ScannerStats {
  todayEntries: number;
  successful: number;
  alreadyUsed: number;
  invalid: number;
  recent: TicketEntry[];
}

export function computeScannerStats(entries: TicketEntry[], memberId: string): ScannerStats {
  const mine = entries.filter((e) => e.memberId === memberId || e.scannerId === memberId);
  const today = todayStr();
  return {
    todayEntries: mine.filter(
      (e) => e.entryStatus === 'entered' && (e.scanDate === today || (e.scannedAt || '').slice(0, 10) === today)
    ).length,
    successful: mine.filter((e) => e.scanResult === 'SUCCESS').length,
    alreadyUsed: mine.filter((e) => e.scanResult === 'ALREADY_USED').length,
    invalid: mine.filter((e) => e.scanResult === 'INVALID' || e.scanResult === 'WRONG_EVENT').length,
    recent: mine.slice(0, 8),
  };
}

/**
 * Update an existing scan history record (ticket entry)
 */
export async function updateTicketEntry(id: string, patch: Partial<TicketEntry>): Promise<void> {
  if (!id) return;
  const ref = docRef(C.TICKET_ENTRIES, id);
  await updateDoc(ref, patch as Record<string, unknown>);
  try {
    sbMirrorTicketEntryUpdate(id, patch as Record<string, unknown>);
  } catch (err) {
    console.warn('Failed to mirror ticket_entries update to Supabase:', err);
  }
}

/**
 * Delete a scan history record (ticket entry) and restore ticket validity if needed
 */
export async function deleteTicketEntry(
  entry: TicketEntry | { id: string; ticketId?: string; scannerId?: string; scannedAt?: string }
): Promise<void> {
  const entryId = entry.id;
  if (!entryId) return;

  // 1. Delete from Firestore ticketEntries
  await deleteDoc(docRef(C.TICKET_ENTRIES, entryId));

  // 2. Delete from Supabase mirror
  try {
    sbMirrorDelete('ticket_entries', entryId);
  } catch (err) {
    console.warn('Failed to delete ticket_entries in Supabase:', err);
  }

  // 3. If ticketId is present, check if ticket doc status is ENTERED and restore it to CONFIRMED
  if (entry.ticketId) {
    try {
      const tRef = docRef(C.TICKETS, entry.ticketId);
      const snap = await getDoc(tRef);
      if (snap.exists()) {
        const tData = snap.data();
        if (tData.status === 'ENTERED') {
          await updateDoc(tRef, {
            status: 'CONFIRMED',
            scannedAt: deleteField(),
            scanDate: deleteField(),
            scanTime: deleteField(),
            scannedBy: deleteField(),
            scannerMemberId: deleteField(),
            scannerMemberName: deleteField(),
            scanGateId: deleteField(),
          });
        }
      }
    } catch (err) {
      console.warn('Notice: Could not reset ticket doc status after scan entry deletion:', err);
    }
  }

  // 4. Audit log entry
  try {
    await writeAuditLog({
      action: 'entry.deleted',
      performedBy: 'admin',
      targetId: entryId,
      metadata: {
        ticketId: entry.ticketId || '',
        scannerId: entry.scannerId || '',
        scannedAt: entry.scannedAt || '',
      },
    });
  } catch {}
}

