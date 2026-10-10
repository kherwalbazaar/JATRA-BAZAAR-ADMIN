import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
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
  return ref.id;
}

export async function updateTicketType(id: string, data: Partial<TicketType>): Promise<void> {
  // Upsert: legacy/local ticket types (e.g. TT-447) may not exist in Firestore yet.
  await setDoc(docRef(C.TICKET_TYPES, id), data as Partial<TicketType>, { merge: true });
}

export async function deleteTicketType(id: string): Promise<void> {
  await deleteDoc(docRef(C.TICKET_TYPES, id));
}

// ─── Bookings ─────────────────────────────────────────────────────

export function listenBookings(
  showIdOrEventId: string,
  callback: (bookings: BookingItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const targetId = String(showIdOrEventId || '').trim();
  const bookingsCol = colRef(C.BOOKINGS);

  // Listen on BOTH keys and merge by doc id — customer-app bookings written
  // by older versions carry only `eventId`, admin/counter ones carry
  // `showId`. An empty result is not an error, so a query-only fallback
  // would never fire; two parallel listeners cover both shapes.
  const byShow = new Map<string, BookingItem>();
  const byEvent = new Map<string, BookingItem>();
  let showDone = false;
  let eventDone = false;
  let showError: Error | null = null;
  let eventError: Error | null = null;
  let disposed = false;

  const emit = () => {
    if (disposed || (!showDone && !eventDone)) return;
    const merged = new Map<string, BookingItem>();
    byEvent.forEach((b, id) => merged.set(id, b));
    byShow.forEach((b, id) => merged.set(id, b));
    const bookings = Array.from(merged.values());
    bookings.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
    callback(bookings);
  };

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
    if (byShow.size === 0 && byEvent.size === 0 && showError && eventError) {
      console.error('listenBookings error:', showError);
      onError?.(showError);
    }
    emit();
  };

  const unsubShow = onSnapshot(
    query(bookingsCol, where('showId', '==', targetId), orderBy('createdAt', 'desc')),
    (snap) => handle('show', snap),
    (err) => fail('show', err)
  );
  const unsubEvent = onSnapshot(
    query(bookingsCol, where('eventId', '==', targetId)),
    (snap) => handle('event', snap),
    (err) => fail('event', err)
  );

  return () => {
    disposed = true;
    unsubShow();
    unsubEvent();
  };
}

// Streams bookings across every event — used by the Online History section.
export function listenAllBookings(
  callback: (bookings: BookingItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    colRef(C.BOOKINGS),
    (snap) => {
      const bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BookingItem));
      bookings.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
      callback(bookings);
    },
    (err) => {
      console.warn('listenAllBookings error:', err);
      onError?.(err);
    }
  );
}

export async function getAllBookingsOnce(): Promise<BookingItem[]> {
  const snap = await getDocs(colRef(C.BOOKINGS));
  const bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BookingItem));
  bookings.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  return bookings;
}

export type SeatGroup = { block: string; seats: string[] };

// Legacy seat doc ids live at seats/{showId}/{block}/{ROW}-{n} ("A-1").
function legacySeatDocId(seatKey: string): string {
  const raw = String(seatKey || '').trim().toUpperCase();
  if (raw.includes('-')) {
    const parts = raw.split('-');
    // Full doc ids ("A1-E-1") carry the block prefix — drop it.
    const [row, num] = parts.length >= 3 ? parts.slice(-2) : parts;
    return `${row}-${num}`;
  }
  const m = raw.match(/^([A-Z]+)(\d+)$/);
  return m ? `${m[1]}-${m[2]}` : raw;
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

  const targets: { key: string; liveRef: ReturnType<typeof doc>; legacyRef: ReturnType<typeof doc> }[] = [];
  for (const group of groups) {
    if (!group.block) continue;
    for (const seatKey of group.seats) {
      const cleanKey = String(seatKey || '').trim().toUpperCase();
      if (!cleanKey) continue;
      // Full doc ids ("B1-A-1") keep their id; short keys ("A-1") get the block prefix.
      const liveId = cleanKey.split('-').length >= 3 ? cleanKey : `${group.block}-${cleanKey}`;
      targets.push({
        key: cleanKey,
        liveRef: doc(collection(db, 'shows', showId, 'seats'), liveId),
        legacyRef: doc(collection(db, C.SEATS, showId, group.block), legacySeatDocId(cleanKey)),
      });
    }
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

  // Atomic booking: verify seat availability AND write booking + tickets +
  // seat status in one transaction, so two counters can never sell the same
  // seat (Firestore retries the transaction automatically on contention).
  try {
    await runTransaction(db, async (tx) => {
      const seatWrites: { ref: ReturnType<typeof doc> }[] = [];
      const taken: string[] = [];

      for (const target of targets) {
        // Check BOTH paths: online bookings written by the customer app can
        // land only in the legacy path (or only in the live path), so a
        // "booked" on either side means the seat is gone.
        const liveSnap = await tx.get(target.liveRef);
        const legacySnap = await tx.get(target.legacyRef);
        const liveStatus = String((liveSnap.data() as { status?: string } | undefined)?.status || '').toLowerCase();
        const legacyStatus = String((legacySnap.data() as { status?: string } | undefined)?.status || '').toLowerCase();
        const blocked = liveStatus === 'booked' || legacyStatus === 'booked';

        if (blocked) {
          taken.push(target.key);
          continue;
        }

        if (liveSnap.exists()) seatWrites.push({ ref: target.liveRef });
        if (legacySnap.exists()) seatWrites.push({ ref: target.legacyRef });
        if (!liveSnap.exists() && !legacySnap.exists()) {
          seatWrites.push({ ref: target.liveRef });
        }
      }

      if (taken.length > 0) {
        throw new Error(
          `Seat ${taken.join(', ')} ${taken.length > 1 ? 'were' : 'was'} just booked by someone else.`
        );
      }

      tx.set(bookingRef, fullBooking);
      for (const t of ticketItems) tx.set(t.ref, t.item);
      for (const w of seatWrites) {
        tx.set(w.ref, { status: 'booked', bookedAt: nowIso, bookingId: baseTicketNumber }, { merge: true });
      }
    });
  } catch (err) {
    if (err instanceof Error && /just booked by someone else/.test(err.message)) throw err;
    console.error('addBooking failed:', err);
    throw new Error('Failed to save booking');
  }

  return bookingId;
}

export async function updateBooking(id: string, data: Partial<BookingItem>): Promise<void> {
  await updateDoc(docRef(C.BOOKINGS, id), data);
}

export async function checkInBooking(bookingId: string): Promise<void> {
  await updateDoc(docRef(C.BOOKINGS, bookingId), { status: 'Checked-in' });
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
      }
    }
  } catch (err) {
    console.warn('cancelBookingWithRelease tickets:', err);
  }

  // 3. Release the claimed seats on both paths.
  const showId = String(booking.showId || booking.eventId || '').trim();
  const blockHint = String(booking.block || '').trim().toUpperCase();
  const seatKeys = (Array.isArray(booking.seats) ? booking.seats : [])
    .map((s) => String(s || '').trim().toUpperCase())
    .filter(Boolean);
  if (!showId || seatKeys.length === 0) return;

  for (const key of seatKeys) {
    const parts = key.split('-');
    let block = '';
    let row = '';
    let num = '';
    if (parts.length >= 3) {
      [block, row, num] = parts;
    } else if (parts.length === 2 && blockHint) {
      block = blockHint;
      [row, num] = parts;
    }
    if (!block || !row || !num) continue;

    const liveRef = doc(collection(db, 'shows', showId, 'seats'), `${block}-${row}-${num}`);
    const legacyRef = doc(collection(db, C.SEATS, showId, block), `${row}-${num}`);

    for (const ref of [liveRef, legacyRef]) {
      try {
        const snap = await getDoc(ref);
        if (!snap.exists()) continue;
        const data = snap.data() as { status?: string; bookingId?: string };
        const st = String(data.status || '').toLowerCase();
        if (st !== 'booked' && st !== 'reserved' && st !== 'sold') continue;
        // Never free a seat claimed by a different booking.
        if (data.bookingId && booking.ticketNumber && data.bookingId !== booking.ticketNumber) continue;
        await updateDoc(ref, { status: 'available', bookedAt: null, bookingId: null });
      } catch (err) {
        console.warn('cancelBookingWithRelease seat release failed:', err);
      }
    }
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
  return ref.id;
}

export async function updateGate(id: string, data: Partial<GateInfo>): Promise<void> {
  await updateDoc(docRef(C.GATES, id), data);
}

export async function incrementGateEntry(gateId: string, delta: number): Promise<void> {
  const snap = await getDoc(docRef(C.GATES, gateId));
  if (!snap.exists()) return;
  const gate = snap.data() as GateInfo;
  const newEntered = Math.max(0, gate.entered + delta);
  await updateDoc(docRef(C.GATES, gateId), {
    entered: newEntered,
    percentage: Math.round((newEntered / gate.capacity) * 100),
    status: newEntered >= gate.capacity ? 'full' : newEntered >= gate.capacity * 0.8 ? 'congested' : 'normal',
  });
}

export async function resetGate(gateId: string): Promise<void> {
  await updateDoc(docRef(C.GATES, gateId), { entered: 0, percentage: 0, status: 'normal' });
}

// ─── Seats (Uniform Data Model: shows/{showId}/seats/{seatId}) ──
// Direct subcollection listener on shows/{showId}/seats with fallback to legacy path.

function listenLegacySeats(
  eventId: string,
  callback: (seats: Seat[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const seatsMap = new Map<string, Seat>();
  const blockUnsubs = new Map<string, Unsubscribe>();
  let disposed = false;
  let pendingBlocks = 0;

  const emit = () => {
    if (disposed || pendingBlocks > 0) return;
    callback(Array.from(seatsMap.values()));
  };

  const subscribeBlock = (blockId: string) => {
    const block = blockId.trim().toUpperCase();
    if (!block || blockUnsubs.has(block) || disposed) return;
    pendingBlocks++;
    const unsub = onSnapshot(
      collection(db, C.SEATS, eventId, block),
      (snap) => {
        const prefix = `${block}/`;
        for (const key of Array.from(seatsMap.keys())) {
          if (key.startsWith(prefix)) seatsMap.delete(key);
        }
        snap.docs.forEach((d) => {
          seatsMap.set(prefix + d.id, { id: d.id, ...d.data() } as Seat);
        });
        pendingBlocks = Math.max(0, pendingBlocks - 1);
        emit();
      },
      (err) => {
        pendingBlocks = Math.max(0, pendingBlocks - 1);
        console.warn(`listenLegacySeats block ${block} error:`, err);
        onError?.(err);
        emit();
      }
    );
    blockUnsubs.set(block, unsub);
  };

  const metaUnsub = onSnapshot(
    doc(db, C.SEAT_META, eventId),
    (snap) => {
      if (disposed) return;
      const blocks: string[] = snap.exists()
        ? ((snap.data() as { blocks?: string[] }).blocks || [])
        : [];
      const seen = new Set(blocks.map((b) => b.trim().toUpperCase()).filter(Boolean));
      blockUnsubs.forEach((_, block) => {
        if (!seen.has(block)) {
          blockUnsubs.get(block)?.();
          blockUnsubs.delete(block);
          const prefix = `${block}/`;
          for (const key of Array.from(seatsMap.keys())) {
            if (key.startsWith(prefix)) seatsMap.delete(key);
          }
        }
      });
      if (seen.size === 0) {
        emit();
        return;
      }
      seen.forEach(subscribeBlock);
      if (pendingBlocks === 0) emit();
    },
    (err) => {
      console.warn('listenLegacySeats seatMeta error:', err);
      onError?.(err);
      emit();
    }
  );

  return () => {
    disposed = true;
    metaUnsub();
    blockUnsubs.forEach((u) => u());
    blockUnsubs.clear();
  };
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

  // Statuses that always win over "available" no matter which path (live
  // shows/{id}/seats or legacy seats/{id}/{block}) recorded them — online
  // bookings written by older app versions land only in the legacy path.
  const PROTECTED = new Set(['booked', 'reserved', 'sold']);

  let active = true;
  let liveSeats: Seat[] | null = null;
  let fallbackUnsub: Unsubscribe | null = null;

  const legacyMap = new Map<string, Record<string, unknown>>();
  const legacyUnsubs = new Map<string, Unsubscribe>();

  const legacyDocKey = (block: string, docId: string) => {
    const id = docId.trim().toUpperCase();
    const prefix = `${block}-`;
    return id.startsWith(prefix) ? id.slice(prefix.length) : id;
  };

  const ensureLegacyBlock = (blockRaw: string) => {
    const block = String(blockRaw || '').trim().toUpperCase();
    if (!block || legacyUnsubs.has(block) || !active) return;
    const unsub = onSnapshot(
      collection(db, C.SEATS, showId, block),
      (snap) => {
        if (!active) return;
        const prefix = `${block}/`;
        for (const key of Array.from(legacyMap.keys())) {
          if (key.startsWith(prefix)) legacyMap.delete(key);
        }
        snap.docs.forEach((d) => {
          legacyMap.set(prefix + legacyDocKey(block, d.id), d.data() as Record<string, unknown>);
        });
        emit();
      },
      (err) => {
        console.warn(`listenSeats legacy overlay block ${block} error:`, err);
      }
    );
    legacyUnsubs.set(block, unsub);
  };

  const emit = () => {
    if (!active || liveSeats === null) return;
    const seen = new Set<string>();
    const merged: Seat[] = liveSeats.map((seat) => {
      const block = String(seat.blockId || '').trim().toUpperCase();
      const key = `${block}/${legacyDocKey(block, seat.id)}`;
      seen.add(key);
      const lg = legacyMap.get(key);
      const liveStatus = String(seat.status || 'available').toLowerCase();
      const legacyStatus = String((lg && lg.status) || 'available').toLowerCase();
      if (PROTECTED.has(legacyStatus) && !PROTECTED.has(liveStatus)) {
        return {
          ...seat,
          status: 'booked',
          bookedAt: (lg && (lg.bookedAt as string)) || seat.bookedAt || null,
        } as Seat;
      }
      if (PROTECTED.has(liveStatus) && seat.status !== 'booked') {
        return { ...seat, status: 'booked' } as Seat;
      }
      return seat;
    });

    // Legacy-only booked seats (booking never reached the live path).
    legacyMap.forEach((data, key) => {
      if (seen.has(key)) return;
      const legacyStatus = String(data.status || 'available').toLowerCase();
      if (!PROTECTED.has(legacyStatus)) return;
      const [block, docId] = key.split('/');
      const parts = docId.split('-');
      const row = (String(data.rowId || data.row || parts[0] || '')).toUpperCase();
      const seatNumber = Number(data.seatNumber) || Number(parts[1]) || 0;
      merged.push({
        id: `${block}-${row}-${seatNumber}`,
        seatId: `${block}-${row}-${seatNumber}`,
        eventId: showId,
        showId,
        blockId: String(data.blockId || data.block || block),
        block: String(data.blockId || data.block || block),
        rowId: row,
        row,
        seatNumber,
        seatLabel: String(data.seatLabel || `${row}${seatNumber}`),
        status: 'booked',
        price: Number(data.price) || 0,
        bookedAt: (data.bookedAt as string) || null,
      } as Seat);
    });

    merged.sort((a, b) => {
      if (a.blockId !== b.blockId) return a.blockId.localeCompare(b.blockId);
      if (a.rowId !== b.rowId) return a.rowId.localeCompare(b.rowId);
      return a.seatNumber - b.seatNumber;
    });
    callback(merged);
  };

  // SeatMeta blocks are also watched so legacy bookings inside blocks that
  // have no live seats yet still surface.
  const metaUnsub = onSnapshot(
    doc(db, C.SEAT_META, showId),
    (snap) => {
      if (!active || !snap.exists()) return;
      const blocks: string[] = (snap.data() as { blocks?: string[] }).blocks || [];
      blocks.forEach(ensureLegacyBlock);
    },
    () => {}
  );

  // Primary: Live onSnapshot listener on shows/{showId}/seats
  const seatsRef = collection(db, 'shows', showId, 'seats');

  const unsub = onSnapshot(
    seatsRef,
    (snap) => {
      if (!active) return;
      if (!snap.empty) {
        if (fallbackUnsub) {
          fallbackUnsub();
          fallbackUnsub = null;
        }
        const seats = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            seatId: d.id,
            eventId: showId,
            showId: showId,
            blockId: data.block || data.blockId || '',
            block: data.block || data.blockId || '',
            rowId: data.row || data.rowId || '',
            row: data.row || data.rowId || '',
            seatNumber: Number(data.seatNumber) || 0,
            seatLabel: data.seatLabel || `${data.row || data.rowId}${data.seatNumber}`,
            status: data.status || 'available',
            price: Number(data.price) || 100,
            createdAt: data.createdAt ? (typeof data.createdAt === 'object' && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : String(data.createdAt)) : '',
            bookedAt: data.bookedAt || null,
          } as Seat;
        });

        liveSeats = seats;
        seats.forEach((s) => ensureLegacyBlock(s.blockId));
        emit();
      } else {
        // Fallback to legacy path if shows subcollection has no docs
        liveSeats = null;
        if (!fallbackUnsub) {
          fallbackUnsub = listenLegacySeats(
            showId,
            (legacySeats) => {
              if (active && snap.empty) {
                callback(legacySeats);
              }
            },
            onError
          );
        }
      }
    },
    (err) => {
      console.warn('listenSeats shows/{showId}/seats error, using fallback:', err);
      liveSeats = null;
      if (!fallbackUnsub) {
        fallbackUnsub = listenLegacySeats(showId, callback, onError);
      }
    }
  );

  return () => {
    active = false;
    unsub();
    metaUnsub();
    legacyUnsubs.forEach((u) => u());
    legacyUnsubs.clear();
    if (fallbackUnsub) fallbackUnsub();
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
}): Promise<number> {
  const showId = params.showId || params.eventId || '';
  if (!showId) throw new Error('showId or eventId is required to create seats.');
  const { blockId, rowId, totalSeats, price = 100 } = params;
  const target = Math.max(1, Math.floor(totalSeats));
  const block = blockId.trim().toUpperCase();
  const row = rowId.trim().toUpperCase();

  // ── Duplicate protection ──────────────────────────────────────────
  // Seats that already exist must never be written again: a re-write would
  // reset `status` to "available" and destroy live bookings. Collect the
  // seat numbers already present (live path + legacy path) and only create
  // the missing ones.
  const existing = new Set<number>();

  try {
    const liveSnap = await getDocs(
      query(
        collection(db, 'shows', showId, 'seats'),
        where('blockId', '==', block),
        where('rowId', '==', row)
      )
    );
    liveSnap.docs.forEach((d) => {
      const n = Number((d.data() as { seatNumber?: number }).seatNumber);
      if (Number.isFinite(n)) existing.add(n);
    });
  } catch (err) {
    console.warn('createSeatRow live lookup failed:', err);
  }

  try {
    const legacySnap = await getDocs(collection(db, C.SEATS, showId, block));
    legacySnap.docs.forEach((d) => {
      const data = d.data() as { seatNumber?: number; rowId?: string };
      const parts = d.id.split('-');
      const docRow = String(data.rowId || parts[0] || '').toUpperCase();
      if (docRow !== row) return;
      const n = Number(data.seatNumber) || Number(parts[1]);
      if (Number.isFinite(n)) existing.add(n);
    });
  } catch (err) {
    // Legacy path may not exist for new shows.
  }

  const missing: number[] = [];
  for (let n = 1; n <= target; n++) {
    if (!existing.has(n)) missing.push(n);
  }
  if (missing.length === 0) return 0;

  // Write only the missing seats — chunks of up to 450 to stay under
  // Firestore's 500 operation limit per batch.
  const CHUNK_SIZE = 450;
  for (let start = 0; start < missing.length; start += CHUNK_SIZE) {
    const chunk = missing.slice(start, start + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const n of chunk) {
      const seatDocId = `${block}-${row}-${n}`;
      const seatRef = doc(collection(db, 'shows', showId, 'seats'), seatDocId);

      const seatData = {
        seatId: seatDocId,
        seatNumber: n,
        block: block,
        blockId: block,
        row: row,
        rowId: row,
        seatLabel: `${row}${n}`,
        price: Number(price) || 100,
        status: 'available',
        createdAt: serverTimestamp(),
        showId: showId,
        eventId: showId,
      };

      batch.set(seatRef, seatData);

      // Also dual-write to legacy path for backward compatibility
      const legacyRef = doc(collection(db, C.SEATS, showId, block), `${row}-${n}`);
      batch.set(legacyRef, { ...seatData, createdAt: new Date().toISOString() });
    }

    const metaRef = doc(db, C.SEAT_META, showId);
    batch.set(metaRef, { blocks: arrayUnion(block) }, { merge: true });

    await batch.commit();
  }

  return missing.length;
}

/**
 * Reduce a row's seat count to `totalSeats`: deletes seats numbered above the
 * target (both paths). Booked/reserved seats are NEVER deleted — they are kept
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

  let deleted = 0;
  let keptBooked = 0;
  const CHUNK_SIZE = 450;
  const PROTECTED = new Set(['booked', 'reserved', 'sold']);

  // Live path: shows/{showId}/seats
  try {
    const liveSnap = await getDocs(
      query(
        collection(db, 'shows', showId, 'seats'),
        where('blockId', '==', block),
        where('rowId', '==', row)
      )
    );
    const toDelete: QueryDocumentSnapshot[] = [];
    liveSnap.docs.forEach((d) => {
      const data = d.data() as { seatNumber?: number; status?: string };
      const n = Number(data.seatNumber);
      if (!Number.isFinite(n) || n <= target) return;
      if (PROTECTED.has(String(data.status || '').toLowerCase())) {
        keptBooked++;
        return;
      }
      toDelete.push(d);
    });
    for (let i = 0; i < toDelete.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      toDelete.slice(i, i + CHUNK_SIZE).forEach((d) => {
        batch.delete(d.ref);
        deleted++;
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('trimSeatRow live path failed:', err);
  }

  // Legacy path: seats/{showId}/{block}/{row}-{n}
  try {
    const legacySnap = await getDocs(collection(db, C.SEATS, showId, block));
    const toDelete: QueryDocumentSnapshot[] = [];
    legacySnap.docs.forEach((d) => {
      const data = d.data() as { seatNumber?: number; rowId?: string; status?: string };
      const docRow = String(data.rowId || d.id.split('-')[0] || '').toUpperCase();
      if (docRow !== row) return;
      const n = Number(data.seatNumber) || Number(d.id.split('-')[1]);
      if (!Number.isFinite(n) || n <= target) return;
      if (PROTECTED.has(String(data.status || '').toLowerCase())) {
        keptBooked++;
        return;
      }
      toDelete.push(d);
    });
    for (let i = 0; i < toDelete.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      toDelete.slice(i, i + CHUNK_SIZE).forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('trimSeatRow legacy path failed:', err);
  }

  return { deleted, keptBooked };
}

/**
 * Update an existing row without touching seat availability/booking state.
 * Currently updates the seat price on every seat of the row (both paths).
 * Returns the number of seat documents updated.
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

  let updated = 0;
  const CHUNK = 450;

  // Live path: shows/{showId}/seats — price only, never status.
  try {
    const liveSnap = await getDocs(
      query(
        collection(db, 'shows', showId, 'seats'),
        where('blockId', '==', block),
        where('rowId', '==', row)
      )
    );
    const docs = liveSnap.docs;
    for (let i = 0; i < docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      docs.slice(i, i + CHUNK).forEach((d) => {
        batch.update(d.ref, { price });
        updated++;
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('updateSeatRow live path failed:', err);
  }

  // Legacy path: seats/{showId}/{block}/{row}-{n} — price only.
  try {
    const legacySnap = await getDocs(collection(db, C.SEATS, showId, block));
    const docs = legacySnap.docs.filter((d) => {
      const data = d.data() as { rowId?: string };
      const docRow = String(data.rowId || d.id.split('-')[0] || '').toUpperCase();
      return docRow === row;
    });
    for (let i = 0; i < docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      docs.slice(i, i + CHUNK).forEach((d) => {
        batch.update(d.ref, { price });
        updated++;
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('updateSeatRow legacy path failed:', err);
  }

  return updated;
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

  // 1. Delete from shows/{showId}/seats
  try {
    const snap = await getDocs(
      query(
        collection(db, 'shows', showId, 'seats'),
        where('block', '==', block),
        where('row', '==', row)
      )
    );
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn('deleteSeatRow shows/seats error:', err);
  }

  // 2. Also delete from legacy path
  try {
    const legacySnap = await getDocs(collection(db, C.SEATS, showId, block));
    if (!legacySnap.empty) {
      const batch = writeBatch(db);
      let n = 0;
      legacySnap.docs.forEach((d) => {
        const data = d.data() as Partial<Seat>;
        if ((data.rowId || '').toUpperCase() === row) {
          batch.delete(d.ref);
          n++;
        }
      });
      if (n > 0) await batch.commit();
    }
  } catch (err) {
    console.warn('deleteSeatRow legacy cleanup error:', err);
  }
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
  return ref.id;
}

export async function updateCounter(id: string, data: Partial<CounterBooth>): Promise<void> {
  await updateDoc(docRef(C.COUNTERS, id), data);
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
}

// ─── Audit Log ────────────────────────────────────────────────────

export async function writeAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'> & { timestamp?: string }): Promise<void> {
  try {
    await addDoc(colRef(C.AUDIT_LOGS), { ...entry, timestamp: entry.timestamp || new Date().toISOString() });
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
    await setDoc(entryDocRef, {
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
    } satisfies TicketEntry);
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
    const q = query(colRef(C.BOOKINGS), where('ticketNumber', '==', value));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as BookingItem;
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
      await recordScanLog('WRONG_EVENT', targetTicket.ticketId, ctx, member, {
        bookingId: targetTicket.bookingId,
        audienceName: targetTicket.customerName,
        ticketType: targetTicket.ticketTypeName,
        seat: targetTicket.seat || undefined,
        message: 'This ticket belongs to another event.',
      });
      return {
        status: 'WRONG_EVENT',
        message: 'This ticket belongs to another event.',
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
    await recordScanLog('WRONG_EVENT', code, ctx, member, {
      bookingId: booking.ticketNumber,
      audienceName: booking.customerName,
      ticketType: booking.ticketTypeName,
      message: 'This ticket belongs to another event.',
    });
    return {
      status: 'WRONG_EVENT',
      message: 'This ticket belongs to another event.',
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
      await recordScanLog('WRONG_EVENT', badId, ctx, member, {
        bookingId,
        audienceName: booking?.customerName || '',
        ticketType: booking?.ticketTypeName || '',
        message: 'This ticket belongs to another event.',
      });
      return {
        result: 'WRONG_EVENT',
        message: 'This ticket belongs to another event.',
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

  // 3. Update parent booking record
  let audienceName = booking?.customerName || admittedTickets[0]?.customerName || '';
  let ticketType = booking?.ticketTypeName || admittedTickets[0]?.ticketTypeName || '';
  let totalTickets = booking?.quantity || (Array.isArray(booking?.seats) ? booking.seats.length : 1);
  let remainingCount = 0;

  try {
    const bQuery = query(colRef(C.BOOKINGS), where('ticketNumber', '==', bookingId));
    const bSnap = await getDocs(bQuery);
    if (!bSnap.empty) {
      const bDoc = bSnap.docs[0];
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

      await updateDoc(bDoc.ref, {
        usedTickets: nextUsed,
        usedSeats: nextSeats,
        usedCount: enteredCount,
        enteredCount,
        remainingCount,
        lastScannedAt: scannedAt,
        ...(enteredCount >= totalTickets ? { status: 'Checked-in', usedAt: scannedAt } : {}),
      });
    }
  } catch (err) {
    console.warn('Failed to update parent booking after batch entry:', err);
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
      return await logRejection('WRONG_EVENT', tItem.ticketId, {
        bookingId: tItem.bookingId,
        audienceName: tItem.customerName,
        ticketType: tItem.ticketTypeName,
        seat: tItem.seat || undefined,
        message: 'This ticket belongs to another event.',
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
        return await logRejection('WRONG_EVENT', tItem.ticketId, {
          bookingId: tItem.bookingId,
          audienceName: tItem.customerName,
          message: 'This ticket belongs to another event.',
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

    // E. Best-effort update of parent booking counters & progress
    try {
      const bQuery = query(colRef(C.BOOKINGS), where('ticketNumber', '==', tItem.bookingId));
      const bSnap = await getDocs(bQuery);
      if (!bSnap.empty) {
        const bDoc = bSnap.docs[0];
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

        await updateDoc(bDoc.ref, {
          usedTickets: nextUsed,
          usedSeats: nextUsedSeats,
          usedCount: enteredCount,
          enteredCount,
          remainingCount,
          lastScannedAt: scannedAt,
          ...(enteredCount >= totalTickets ? { status: 'Checked-in', usedAt: scannedAt } : {}),
        });
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
    return await logRejection('WRONG_EVENT', specificTicketId, {
      bookingId: canonicalBookingNumber,
      audienceName: booking.customerName,
      ticketType: booking.ticketTypeName,
      message: 'This ticket belongs to another event.',
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

  // Update parent booking & create tickets record
  try {
    const nextUsed = Array.from(new Set([...(booking.usedTickets || []), specificTicketId]));
    const nextUsedSeats = seatLabel
      ? Array.from(new Set([...(booking.usedSeats || []), seatLabel]))
      : booking.usedSeats || [];
    const enteredCount = nextUsed.length;
    const remainingCount = Math.max(0, totalSeats - enteredCount);

    await updateDoc(docRef(C.BOOKINGS, booking.id), {
      usedTickets: nextUsed,
      usedSeats: nextUsedSeats,
      usedCount: enteredCount,
      enteredCount,
      remainingCount,
      lastScannedAt: legacyScannedAt,
      ...(enteredCount >= totalSeats ? { status: 'Checked-in', usedAt: legacyScannedAt } : {}),
    });

    // Create tickets doc for future scans
    await setDoc(docRef(C.TICKETS, specificTicketId), {
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
    } satisfies TicketItem);
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
  const q = query(colRef(C.TICKETS), where('bookingId', '==', bookingId));
  return onSnapshot(
    q,
    (snap) => {
      const tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TicketItem));
      tickets.sort((a, b) => (a.ticketIndex || 0) - (b.ticketIndex || 0));
      callback(tickets);
    },
    (err) => {
      console.warn('listenTicketsByBookingId error:', err);
      onError?.(err);
    }
  );
}

export async function getTicketsByBookingId(bookingId: string): Promise<TicketItem[]> {
  const q = query(colRef(C.TICKETS), where('bookingId', '==', bookingId));
  const snap = await getDocs(q);
  const tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TicketItem));
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

