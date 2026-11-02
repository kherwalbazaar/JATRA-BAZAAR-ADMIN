import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

const firebaseConfig = {
  apiKey: "AIzaSyDa-placeholder",
  projectId: "jatra-bazaar",
  appId: "1:724584223253:web:7eb94cf5e1ba09968a3562",
};

// Use the actual Firebase config from src/lib/firebase.ts
import fs from 'fs';
const fbSrc = fs.readFileSync('./src/lib/firebase.ts', 'utf-8');
const apiKeyMatch = fbSrc.match(/apiKey:\s*['"]([^'"]+)['"]/);
const authDomainMatch = fbSrc.match(/authDomain:\s*['"]([^'"]+)['"]/);
const projectIdMatch = fbSrc.match(/projectId:\s*['"]([^'"]+)['"]/);
const storageBucketMatch = fbSrc.match(/storageBucket:\s*['"]([^'"]+)['"]/);
const messagingSenderIdMatch = fbSrc.match(/messagingSenderId:\s*['"]([^'"]+)['"]/);
const appIdMatch = fbSrc.match(/appId:\s*['"]([^'"]+)['"]/);

const realConfig = {
  apiKey: apiKeyMatch ? apiKeyMatch[1] : '',
  authDomain: authDomainMatch ? authDomainMatch[1] : '',
  projectId: projectIdMatch ? projectIdMatch[1] : '',
  storageBucket: storageBucketMatch ? storageBucketMatch[1] : '',
  messagingSenderId: messagingSenderIdMatch ? messagingSenderIdMatch[1] : '',
  appId: appIdMatch ? appIdMatch[1] : '',
};

console.log('Firebase config loaded for project:', realConfig.projectId);
const app = initializeApp(realConfig);
const db = getFirestore(app);

const sbUrl = 'https://fmiaiuhmmlyciafxgvna.supabase.co';
const sbKey = 'sb_publishable_3CszK-oOtR0ce83iCNU30g_-ZuSt8or';
const sb = createClient(sbUrl, sbKey);

function stripUndefined(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const res = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) res[key] = stripUndefined(value);
    }
    return res;
  }
  return obj;
}

function mapSupabaseBooking(row) {
  const seats = Array.isArray(row.seats) ? row.seats.map(String) : [];
  const quantity = Number(row.quantity) || (seats.length > 0 ? seats.length : 1);
  const amount = Number(row.amount) || Number(row.final_customer_amount) || Number(row.ticket_amount) || 0;
  const statusRaw = String(row.status || row.booking_status || 'Confirmed');
  let status = 'Confirmed';
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
    source: row.source || 'Online',
    paymentMethod: row.payment_method || 'UPI',
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
    paymentStatus: row.payment_status || 'Successful',
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

function mapSupabaseSeat(row) {
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
    status: row.status || 'available',
    price: Number(row.price) || 0,
    bookingId: row.booking_id ? String(row.booking_id) : null,
    bookedAt: row.booked_at ? String(row.booked_at) : null,
    reservedAt: row.reserved_at ? String(row.reserved_at) : null,
    reservedBy: row.reserved_by ? String(row.reserved_by) : null,
    createdAt: String(row.created_at || ''),
  };
}

function mapSupabaseTicket(row) {
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
    status: row.status || 'ACTIVE',
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

console.log('1. Syncing Supabase bookings to Firestore...');
const { data: bData } = await sb.from('bookings').select('*');
let bCount = 0;
for (const row of bData || []) {
  const b = mapSupabaseBooking(row);
  if (b.id) {
    await setDoc(doc(db, 'bookings', b.id), stripUndefined(b), { merge: true });
    bCount++;
  }
}
console.log(`Synced ${bCount} bookings to Firestore.`);

console.log('2. Syncing Supabase tickets to Firestore...');
const { data: tData } = await sb.from('tickets').select('*');
let tCount = 0;
for (const row of tData || []) {
  const t = mapSupabaseTicket(row);
  if (t.id) {
    await setDoc(doc(db, 'tickets', t.id), stripUndefined(t), { merge: true });
    tCount++;
  }
}
console.log(`Synced ${tCount} tickets to Firestore.`);

console.log('3. Syncing Supabase booked seats to Firestore...');
const { data: sData } = await sb.from('seats').select('*').in('status', ['booked', 'reserved', 'sold']);
let sCount = 0;
for (const row of sData || []) {
  const s = mapSupabaseSeat(row);
  if (s.eventId && s.id) {
    await setDoc(doc(db, 'shows', s.eventId, 'seats', s.id), stripUndefined(s), { merge: true });
    sCount++;
  }
}
console.log(`Synced ${sCount} booked seats to Firestore.`);

console.log('\n--- VERIFYING FIRESTORE READ ---');
const snap21 = await getDoc(doc(db, 'bookings', 'JB_1793285951962_QQXVMG'));
if (snap21.exists()) {
  console.log('SUCCESS! Booking NJ26-00021 exists in Firestore:');
  console.log(snap21.data().ticketNumber, snap21.data().customerName, snap21.data().seats, snap21.data().amount);
} else {
  console.error('Booking NJ26-00021 NOT found in Firestore!');
}

const snapSeatB4 = await getDoc(doc(db, 'shows', 'wWpPHoS1Hb83ODSY5nBf', 'seats', 'B1-B-4'));
if (snapSeatB4.exists()) {
  console.log('SUCCESS! Seat B1-B-4 in shows/wWpPHoS1Hb83ODSY5nBf/seats exists in Firestore:');
  console.log(snapSeatB4.data().id, snapSeatB4.data().status, snapSeatB4.data().bookingId);
} else {
  console.error('Seat B1-B-4 NOT found in Firestore!');
}

process.exit(0);
