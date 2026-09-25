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
  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventItem));
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
      const events = snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventItem));
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
  const ref = await addDoc(colRef(C.EVENTS), event);
  return ref.id;
}

export async function updateEvent(id: string, data: Partial<EventItem>): Promise<void> {
  await updateDoc(docRef(C.EVENTS, id), data);
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
  const ref = await addDoc(colRef(C.BOOKINGS), booking);
  return ref.id;
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
  audienceName?: string;
  persons?: number;
  ticketType?: string;
  bookingSource?: string;
  eventName?: string;
  gateId?: string;
  entryTime?: string;
  previousEntryTime?: string;
  previousScannerId?: string;
  previousScannerName?: string;
  previousGateId?: string;
  message?: string;
}

function entryDocId(eventId: string, ticketNumber: string): string {
  return `${eventId}__${ticketNumber}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
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
  const member = await getScannerMemberOnce(ctx.memberId);
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

  // 2. Extract ticket id from QR (JSON payload or plain code) — never trust QR content beyond the id
  let ticketNumber = code;
  try {
    const parsed = JSON.parse(code);
    if (parsed && typeof parsed === 'object') {
      ticketNumber = String(parsed.id ?? parsed.ticketNumber ?? '');
    }
  } catch {
    /* plain ticket code */
  }
  ticketNumber = ticketNumber.trim().toUpperCase();
  if (!ticketNumber) {
    return { result: 'INVALID', message: 'This ticket could not be verified.' };
  }

  const base = {
    eventId: ctx.eventId,
    scannerId: member.scannerId,
    memberId: member.id,
    scannerName: member.name,
    gateId: ctx.gateId,
    ticketId: ticketNumber,
  };

  const logRejection = async (
    result: EntryResult['result'],
    extra: Partial<TicketEntry> = {}
  ): Promise<EntryResult> => {
    try {
      await addDoc(colRef(C.TICKET_ENTRIES), {
        ...base,
        ...extra,
        entryStatus: 'rejected',
        scanResult: result,
        scannedAt: new Date().toISOString(),
      } satisfies Omit<TicketEntry, 'id'>);
    } catch (err) {
      console.warn('Failed to log rejected scan:', err);
    }
    await writeAuditLog({
      action: 'entry.rejected',
      performedBy: member.scannerId,
      targetId: ticketNumber,
      metadata: { result, eventId: ctx.eventId },
    });
    return { result, ticketId: ticketNumber, ...extra } as EntryResult;
  };

  // 3. Find ticket in database
  const q = query(colRef(C.BOOKINGS), where('ticketNumber', '==', ticketNumber));
  const snap = await getDocs(q);
  if (snap.empty) {
    await logRejection('INVALID', { audienceName: undefined });
    return { result: 'INVALID', ticketId: ticketNumber, message: 'This ticket could not be verified.' };
  }
  const booking = { id: snap.docs[0].id, ...snap.docs[0].data() } as BookingItem;

  // 4. Check event
  if (booking.eventId !== ctx.eventId) {
    await logRejection('WRONG_EVENT', {
      audienceName: booking.customerName,
      persons: booking.quantity,
      ticketType: booking.ticketTypeName,
    });
    return {
      result: 'WRONG_EVENT',
      ticketId: ticketNumber,
      audienceName: booking.customerName,
      persons: booking.quantity,
      message: 'This ticket belongs to another event.',
    };
  }

  // 5. Check cancellation
  if (booking.status === 'Cancelled' || booking.status === 'Refunded') {
    await logRejection('CANCELLED', {
      audienceName: booking.customerName,
      persons: booking.quantity,
      ticketType: booking.ticketTypeName,
    });
    return {
      result: 'CANCELLED',
      ticketId: ticketNumber,
      audienceName: booking.customerName,
      persons: booking.quantity,
      message: 'This ticket has been cancelled.',
    };
  }

  // 6. Check payment/confirmation
  if (booking.status !== 'Confirmed' && booking.status !== 'Checked-in') {
    await logRejection('UNPAID', {
      audienceName: booking.customerName,
      persons: booking.quantity,
      ticketType: booking.ticketTypeName,
    });
    return {
      result: 'UNPAID',
      ticketId: ticketNumber,
      audienceName: booking.customerName,
      persons: booking.quantity,
      message: 'This ticket is not eligible for entry.',
    };
  }

  // 7. Atomic duplicate-entry check (double-scan security)
  const entryRef = docRef(C.TICKET_ENTRIES, entryDocId(ctx.eventId, ticketNumber));
  let alreadyUsed: { entryTime?: string; scannerId?: string; scannerName?: string; gateId?: string } | null = null;

  const won = await runTransaction(db, async (tx) => {
    const existing = await tx.get(entryRef);
    if (existing.exists()) {
      const e = existing.data() as TicketEntry;
      if (e.entryStatus === 'entered') {
        alreadyUsed = {
          entryTime: e.scannedAt,
          scannerId: e.scannerId,
          scannerName: e.scannerName,
          gateId: e.gateId,
        };
        return false;
      }
      // stale rejected record at this id — allow overwrite to entered
      tx.set(entryRef, {
        ...base,
        audienceName: booking.customerName,
        persons: booking.quantity,
        ticketType: booking.ticketTypeName,
        bookingSource: booking.source,
        entryStatus: 'entered',
        scanResult: 'SUCCESS',
        scannedAt: new Date().toISOString(),
      });
      return true;
    }
    tx.set(entryRef, {
      ...base,
      audienceName: booking.customerName,
      persons: booking.quantity,
      ticketType: booking.ticketTypeName,
      bookingSource: booking.source,
      entryStatus: 'entered',
      scanResult: 'SUCCESS',
      scannedAt: new Date().toISOString(),
    });
    return true;
  });

  if (!won) {
    const prev = (alreadyUsed || {}) as { entryTime?: string; scannerId?: string; scannerName?: string; gateId?: string };
    await logRejection('ALREADY_USED', {
      audienceName: booking.customerName,
      persons: booking.quantity,
      ticketType: booking.ticketTypeName,
      previousEntryTime: prev.entryTime,
      previousScannerId: prev.scannerId,
      previousGateId: prev.gateId,
    });
    return {
      result: 'ALREADY_USED',
      ticketId: ticketNumber,
      audienceName: booking.customerName,
      persons: booking.quantity,
      previousEntryTime: prev.entryTime,
      previousScannerId: prev.scannerId,
      previousScannerName: prev.scannerName,
      previousGateId: prev.gateId,
      message: 'This ticket has already been used for entry.',
    };
  }

  // 8. Best-effort post-entry updates (booking status, gate counter, scanner stats)
  try {
    if (booking.status !== 'Checked-in') {
      await updateDoc(docRef(C.BOOKINGS, booking.id), { status: 'Checked-in' });
    }
  } catch (err) {
    console.warn('Failed to update booking status:', err);
  }
  try {
    const gateSnap = await getDoc(docRef(C.GATES, ctx.gateId));
    if (gateSnap.exists()) {
      const gate = gateSnap.data() as GateInfo;
      const newEntered = gate.entered + booking.quantity;
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
  try {
    const memberSnap = await getDoc(docRef(C.SCANNER_MEMBERS, member.id));
    if (memberSnap.exists()) {
      const m = memberSnap.data() as ScannerMember;
      await updateDoc(docRef(C.SCANNER_MEMBERS, member.id), {
        totalScans: (m.totalScans || 0) + 1,
        lastScanAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('Failed to update scanner stats:', err);
  }
  await writeAuditLog({
    action: 'entry.accepted',
    performedBy: member.scannerId,
    targetId: ticketNumber,
    metadata: { eventId: ctx.eventId, gateId: ctx.gateId, persons: booking.quantity },
  });

  return {
    result: 'SUCCESS',
    ticketId: ticketNumber,
    audienceName: booking.customerName,
    persons: booking.quantity,
    ticketType: booking.ticketTypeName,
    bookingSource: booking.source,
    gateId: ctx.gateId,
    entryTime: new Date().toISOString(),
  };
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
  const mine = entries.filter((e) => e.memberId === memberId);
  const today = todayStr();
  return {
    todayEntries: mine.filter((e) => e.entryStatus === 'entered' && (e.scannedAt || '').startsWith(today)).length,
    successful: mine.filter((e) => e.scanResult === 'SUCCESS').length,
    alreadyUsed: mine.filter((e) => e.scanResult === 'ALREADY_USED').length,
    invalid: mine.filter((e) => e.scanResult === 'INVALID' || e.scanResult === 'WRONG_EVENT').length,
    recent: mine.slice(0, 8),
  };
}

