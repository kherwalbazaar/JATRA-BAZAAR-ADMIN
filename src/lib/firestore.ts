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
  Unsubscribe,
} from 'firebase/firestore';
import { db, FIRESTORE_COLLECTIONS } from './firebase';
import {
  EventItem,
  TicketType,
  BookingItem,
  GateInfo,
  CounterBooth,
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

