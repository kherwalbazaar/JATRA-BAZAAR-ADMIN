import fs from 'node:fs';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(process.cwd());
const envPath = path.join(root, '.env.local');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

const env = loadEnv(envPath);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://fmiaiuhmmlyciafxgvna.supabase.co';
const supabaseKey =
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('No Supabase key found in .env.local');
  process.exit(1);
}

const isServiceRole = !!env.SUPABASE_SERVICE_ROLE_KEY;
console.log(`Connecting to Supabase at: ${supabaseUrl}`);
console.log(`Auth mode: ${isServiceRole ? 'Service Role (Full Admin Bypass)' : 'Publishable / Anon Key'}\n`);

const sb = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

async function pushTable(name, rows) {
  if (!rows || rows.length === 0) {
    console.log(`  - ${name}: 0 rows to push`);
    return true;
  }
  // Chunk in batches of 100
  const chunkSize = 100;
  let successCount = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb.from(name).upsert(chunk);
    if (error) {
      console.error(`  ✗ ${name} chunk [${i}..${i + chunk.length}] failed:`, error.message);
      return false;
    }
    successCount += chunk.length;
  }
  console.log(`  ✓ ${name}: successfully upserted ${successCount} rows`);
  return true;
}

async function main() {
  console.log('=== SYNCING FIREBASE TO SUPABASE ===\n');

  // 1. Events
  console.log('1. Reading events from Firebase...');
  const eventsSnap = await getDocs(collection(db, 'events'));
  const events = [];
  const eventIds = [];
  for (const d of eventsSnap.docs) {
    const data = d.data();
    eventIds.push(d.id);
    events.push({
      id: d.id,
      title: data.title || data.name || data.eventTitle || 'Untitled Event',
      subtitle: data.subtitle || '',
      event_title: data.eventTitle || data.title || data.name || 'Untitled Event',
      committee_name: data.committeeName || data.committee || '',
      committee_location: data.committeeLocation || '',
      party_name: data.partyName || '',
      language: data.language || 'Santali',
      audience: data.audience || 'All Ages',
      sale_mode: data.saleMode === 'Online' ? 'Online' : 'Counter',
      date: data.date ? new Date(data.date).toISOString().split('T')[0] : '2026-10-23',
      day: data.day || 'Friday',
      time: data.time || data.startTime || '11:00 PM',
      entry_time: data.entryTime || '',
      start_time: data.startTime || '',
      end_time: data.endTime || '',
      duration: data.duration || '',
      venue: data.venue || data.location || '',
      address: data.address || '',
      city: data.city || '',
      phone: data.phone || '',
      status: data.status || 'upcoming',
      poster: data.poster || data.banner || '',
      additional_banners: Array.isArray(data.banners) ? data.banners : (Array.isArray(data.additionalBanners) ? data.additionalBanners : []),
      actors: Array.isArray(data.actors) ? data.actors : (Array.isArray(data.cast) ? data.cast : []),
      writer: data.writer || '',
      director: data.director || '',
      music_director: data.musicDirector || '',
      singer: data.singer || '',
      trailer_url: data.trailerUrl || '',
      total_capacity: Number(data.totalCapacity) || 575,
      tickets_sold: Number(data.ticketsSold) || 0,
      total_revenue: Number(data.totalRevenue) || 0.00,
      organizer: data.organizer || data.organizationName || '',
      description: data.description || data.about || '',
    });
  }
  await pushTable('events', events);

  // 2. Ticket Types
  console.log('2. Reading ticket types from Firebase...');
  const ticketTypesSnap = await getDocs(collection(db, 'ticketTypes'));
  const ticketTypes = [];
  for (const d of ticketTypesSnap.docs) {
    const data = d.data();
    ticketTypes.push({
      id: d.id,
      event_id: data.eventId || eventIds[0] || '',
      name: data.name || '',
      committee_name: data.committeeName || '',
      blocks: Array.isArray(data.blocks) ? data.blocks : [],
      rows: Array.isArray(data.rows) ? data.rows : [],
      badge_text: data.badgeText || '',
      price: Number(data.price) || 0,
      total_quota: Number(data.totalQuota) || 0,
      sold: Number(data.sold) || 0,
      color: data.color || '#4f39f6',
      bg_color: data.bgColor || '#eef2ff',
      text_color: data.textColor || '#312e81',
      perks: Array.isArray(data.perks) ? data.perks : [],
      gate_access: Array.isArray(data.gateAccess) ? data.gateAccess : [],
      gate: data.gate || '',
      display_order: Number(data.displayOrder) || 0,
    });
  }
  await pushTable('ticket_types', ticketTypes);

  // 3. Seats
  console.log('3. Reading seats from Firebase...');
  const allSeats = [];
  for (const eid of eventIds) {
    const seatsSnap = await getDocs(collection(db, 'shows', eid, 'seats'));
    for (const d of seatsSnap.docs) {
      const s = d.data();
      allSeats.push({
        id: `${eid}_${d.id}`,
        event_id: eid,
        block_id: s.blockId || s.block || 'A1',
        row_id: s.rowId || s.row || 'A',
        seat_number: Number(s.seatNumber || s.number) || 1,
        seat_label: s.seatLabel || `${s.row || 'A'}${s.seatNumber || 1}`,
        status: s.status || 'available',
        price: Number(s.price) || 100.00,
        seat_id: s.seatId || d.id,
        block: s.block || s.blockId || 'A1',
        row: s.row || s.rowId || 'A',
        number: Number(s.seatNumber || s.number) || 1,
        show_id: eid,
      });
    }
  }
  await pushTable('seats', allSeats);

  // 4. Bookings
  console.log('4. Reading bookings from Firebase...');
  const bookingsSnap = await getDocs(collection(db, 'bookings'));
  const bookings = [];
  for (const d of bookingsSnap.docs) {
    const b = d.data();
    bookings.push({
      id: d.id,
      ticket_number: b.ticketNumber || `T-${d.id}`,
      event_id: b.eventId || b.showId || eventIds[0] || '',
      event_name: b.eventName || '',
      customer_name: b.customerName || 'Anonymous',
      customer_phone: b.customerPhone || '0000000000',
      customer_email: b.customerEmail || null,
      ticket_type_name: b.ticketTypeName || '',
      quantity: Number(b.quantity) || 1,
      unit_price: Number(b.unitPrice) || 0,
      amount: Number(b.amount) || 0,
      source: b.source === 'Online' ? 'Online' : 'Counter',
      counter_name: b.counterName || '',
      payment_method: b.paymentMethod || 'Cash',
      transaction_id: b.transactionId || null,
      date: b.date || '',
      time: b.time || '',
      status: b.status || 'Confirmed',
      booking_status: b.bookingStatus || 'Confirmed',
      assigned_gate: b.assignedGate || 'Main Gate',
      block: b.block || '',
      seats: Array.isArray(b.seats) ? b.seats : [],
      seat_number: b.seatNumber || '',
      seat_count: Number(b.seatCount) || 1,
      total_amount: Number(b.totalAmount || b.amount) || 0,
      ticket_amount: Number(b.ticketAmount) || 0,
    });
  }
  await pushTable('bookings', bookings);

  // 5. Tickets
  console.log('5. Reading tickets from Firebase...');
  const ticketsSnap = await getDocs(collection(db, 'tickets'));
  const tickets = [];
  for (const d of ticketsSnap.docs) {
    const t = d.data();
    tickets.push({
      id: d.id,
      ticket_id: t.ticketId || d.id,
      booking_id: t.bookingId || '',
      ticket_index: Number(t.ticketIndex) || 1,
      total_tickets: Number(t.totalTickets) || 1,
      event_id: t.eventId || eventIds[0] || '',
      event_name: t.eventName || '',
      ticket_type_name: t.ticketTypeName || '',
      seat: t.seat || '',
      seat_index: Number(t.seatIndex) || 1,
      seat_count: Number(t.seatCount) || 1,
      block: t.block || '',
      assigned_gate: t.assignedGate || 'Main Gate',
      customer_name: t.customerName || 'Anonymous',
      customer_phone: t.customerPhone || '0000000000',
      serial_number: t.serialNumber || '',
      qr_token: t.qrToken || d.id,
      status: t.status || 'ACTIVE',
      date: t.date || '',
      time: t.time || '',
      unit_price: Number(t.unitPrice) || 0,
    });
  }
  await pushTable('tickets', tickets);

  // 6. Scanner Members
  console.log('6. Reading scanner members from Firebase...');
  const scannersSnap = await getDocs(collection(db, 'scannerMembers'));
  const scanners = [];
  for (const d of scannersSnap.docs) {
    const s = d.data();
    scanners.push({
      id: d.id,
      scanner_id: s.scannerId || d.id,
      name: s.name || 'Scanner',
      mobile: s.mobile || '',
      role: s.role || 'scanner',
      approval_status: s.approvalStatus || 'approved',
      account_status: s.accountStatus || 'active',
      total_scans: Number(s.totalScans) || 0,
    });
  }
  await pushTable('scanner_members', scanners);

  console.log('\n=== Supabase Sync Complete! ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
