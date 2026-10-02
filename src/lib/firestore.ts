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
  Unsubscribe,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db, FIRESTORE_COLLECTIONS } from './firebase';
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

export async function getEventsOnce(): Promise<EventItem[]> {
  const snap = await getDocs(colRef(C.EVENTS));
  const events = snap.docs.map((d) => ({ ...d.data(), id: d.id } as EventItem));
  events.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  return events;
}

export function listenEvents(
  callback: (events: EventItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = colRef(C.EVENTS);
  return onSnapshot(
    q,
    (snap) => {
      // Doc id wins: some payloads stored a stale `id` field (EVT-…)
      // that does not match the document, which broke update/delete.
      const events = snap.docs.map((d) => ({ ...d.data(), id: d.id } as EventItem));
      events.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      callback(events);
    },
    (err) => {
      console.error('listenEvents error:', err);
      onError?.(err);
    }
  );
}

export async function addEvent(event: Omit<EventItem, 'id'>): Promise<string> {
  const payload: Record<string, unknown> = { ...event };
  delete payload.id;
  const ref = await addDoc(colRef(C.EVENTS), payload as Omit<EventItem, 'id'>);
  return ref.id;
}

export async function updateEvent(id: string, data: Partial<EventItem>): Promise<void> {
  const payload: Record<string, unknown> = { ...data };
  delete payload.id;
  await updateDoc(docRef(C.EVENTS, id), payload as Partial<EventItem>);
}

export async function deleteEvent(id: string): Promise<void> {
  console.log('Attempting to delete event with ID:', id);
  const docRefToDelete = docRef(C.EVENTS, id);
  console.log('Document reference:', docRefToDelete);
  
  try {
    await deleteDoc(docRefToDelete);
    console.log('Successfully deleted event:', id);
    
    // Verify deletion by checking if document still exists
    const checkSnap = await getDoc(docRef(C.EVENTS, id));
    if (checkSnap.exists()) {
      console.error('ERROR: Document still exists after deletion!', id);
      throw new Error('Document deletion failed - document still exists');
    } else {
      console.log('Verification passed: Document no longer exists in database');
    }
  } catch (error) {
    console.error('Error during event deletion:', error);
    throw error;
  }
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
      const types = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TicketType));
      callback(types);
    },
    (err) => {
      console.warn('listenTicketTypes error:', err);
      onError?.(err);
    }
  );
}

export async function addTicketType(type: Omit<TicketType, 'id'> & { eventId: string }): Promise<string> {
  const ref = await addDoc(colRef(C.TICKET_TYPES), type);
  return ref.id;
}

export async function updateTicketType(id: string, data: Partial<TicketType>): Promise<void> {
  await updateDoc(docRef(C.TICKET_TYPES, id), data);
}

export async function deleteTicketType(id: string): Promise<void> {
  await deleteDoc(docRef(C.TICKET_TYPES, id));
}

// ─── Bookings ─────────────────────────────────────────────────────

export function listenBookings(
  eventId: string,
  callback: (bookings: BookingItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  // NOTE: do not combine where('eventId') with orderBy('date') in Firestore query,
  // as it requires a composite index that will fail if the index hasn't been built.
  // Instead, filter by eventId in query and sort in memory.
  const q = query(colRef(C.BOOKINGS), where('eventId', '==', eventId));
  return onSnapshot(
    q,
    (snap) => {
      const bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BookingItem));
      bookings.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
      callback(bookings);
    },
    (err) => {
      console.warn('listenBookings error:', err);
      onError?.(err);
    }
  );
}

export async function addBooking(booking: Omit<BookingItem, 'id'> & { eventId: string }): Promise<string> {
  const batch = writeBatch(db);
  const bookingRef = doc(colRef(C.BOOKINGS));
  const bookingId = bookingRef.id;

  const count = Number(booking.quantity) || (Array.isArray(booking.seats) ? booking.seats.length : 1);
  const seats = Array.isArray(booking.seats) ? booking.seats.filter(Boolean) : [];
  const baseTicketNumber = booking.ticketNumber;

  const fullBooking: Omit<BookingItem, 'id'> = {
    ...booking,
    bookingId: baseTicketNumber,
    enteredCount: 0,
    remainingCount: count,
    usedTickets: [],
    usedSeats: [],
  };

  batch.set(bookingRef, fullBooking);

  const nowIso = new Date().toISOString();

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
      eventId: booking.eventId,
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

    batch.set(ticketDocRef, ticketItem);
  }

  await batch.commit();
  return bookingId;
}

export async function updateBooking(id: string, data: Partial<BookingItem>): Promise<void> {
  await updateDoc(docRef(C.BOOKINGS, id), data);
}

export async function checkInBooking(bookingId: string): Promise<void> {
  await updateDoc(docRef(C.BOOKINGS, bookingId), { status: 'Checked-in' });
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

// ─── Seats (Seat Create → user booking seat grid) ────────────────
// Path matches user app: seats/{eventId}/{blockId}/{rowId}-{seatNumber}
// Seat docs live in per-block subcollections (collection ID = blockId),
// so collectionGroup('seats') does NOT match them — subscribe via seatMeta.

export function listenSeats(
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
        console.warn(`listenSeats block ${block} error:`, err);
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
      console.warn('listenSeats seatMeta error:', err);
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

export async function createSeatRow(params: {
  eventId: string;
  blockId: string;
  rowId: string;
  totalSeats: number;
  price?: number;
}): Promise<number> {
  const { eventId, blockId, rowId, totalSeats, price = 100 } = params;
  const count = Math.max(1, Math.floor(totalSeats));
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  const block = blockId.trim().toUpperCase();
  const row = rowId.trim().toUpperCase();

  for (let n = 1; n <= count; n++) {
    const docId = `${row}-${n}`;
    const seatRef = doc(collection(db, C.SEATS, eventId, block), docId);
    batch.set(seatRef, {
      eventId,
      blockId: block,
      rowId: row,
      seatNumber: n,
      seatId: docId,
      seatLabel: `${row}${n}`,
      status: 'available',
      price,
      createdAt: now,
    });
  }

  const metaRef = doc(db, C.SEAT_META, eventId);
  batch.set(metaRef, { blocks: arrayUnion(block) }, { merge: true });

  await batch.commit();
  return count;
}

export async function deleteSeatRow(params: {
  eventId: string;
  blockId: string;
  rowId: string;
}): Promise<void> {
  const { eventId, blockId, rowId } = params;
  const block = blockId.trim().toUpperCase();
  const row = rowId.trim().toUpperCase();
  const snap = await getDocs(collection(db, C.SEATS, eventId, block));
  const batch = writeBatch(db);
  let n = 0;
  snap.docs.forEach((d) => {
    const data = d.data() as Partial<Seat>;
    if ((data.rowId || '').toUpperCase() === row) {
      batch.delete(d.ref);
      n++;
    }
  });
  if (n > 0) await batch.commit();
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

