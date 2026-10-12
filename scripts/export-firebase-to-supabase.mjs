import fs from 'node:fs';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

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

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function sqlEscape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? '0' : String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

function parseDate(rawDate) {
  if (!rawDate) return '2026-10-23';
  const d = new Date(rawDate);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return '2026-10-23';
}

async function run() {
  console.log('--- JATRA BAZAAR: Extracting Firebase Firestore Data ---');
  const sqlStatements = [];
  sqlStatements.push('-- ============================================================================');
  sqlStatements.push('-- JATRA BAZAAR — Supabase Data Migration & Seed from Live Firebase Firestore');
  sqlStatements.push('-- Migration 000003: Production Data Push');
  sqlStatements.push('-- Generated: ' + new Date().toISOString());
  sqlStatements.push('-- ============================================================================');
  sqlStatements.push('');
  sqlStatements.push('BEGIN;');
  sqlStatements.push('');

  // 1. Events
  const eventsSnap = await getDocs(collection(db, 'events'));
  console.log(`Fetched ${eventsSnap.size} event(s)`);
  sqlStatements.push('-- 1. EVENTS');
  const eventIds = [];
  for (const d of eventsSnap.docs) {
    const data = d.data();
    eventIds.push(d.id);
    const dateFormatted = parseDate(data.date);
    const title = data.title || data.name || data.eventTitle || 'Untitled Event';
    const eventTitle = data.eventTitle || data.title || data.name || 'Untitled Event';
    const banners = Array.isArray(data.banners) ? data.banners : (Array.isArray(data.additionalBanners) ? data.additionalBanners : []);
    const actors = Array.isArray(data.actors) ? data.actors : (Array.isArray(data.cast) ? data.cast : []);

    sqlStatements.push(`INSERT INTO public.events (
  id, title, subtitle, event_title, committee_name, committee_location, party_name,
  language, audience, sale_mode, date, day, time, entry_time, start_time, end_time,
  duration, venue, address, city, phone, status, poster, additional_banners,
  actors, writer, director, music_director, singer, trailer_url, total_capacity,
  tickets_sold, total_revenue, organizer, description
) VALUES (
  ${sqlEscape(d.id)},
  ${sqlEscape(title)},
  ${sqlEscape(data.subtitle || '')},
  ${sqlEscape(eventTitle)},
  ${sqlEscape(data.committeeName || data.committee || '')},
  ${sqlEscape(data.committeeLocation || '')},
  ${sqlEscape(data.partyName || '')},
  ${sqlEscape(data.language || 'Santali')},
  ${sqlEscape(data.audience || 'All Ages')},
  ${sqlEscape(data.saleMode === 'Online' ? 'Online' : 'Counter')},
  ${sqlEscape(dateFormatted)}::date,
  ${sqlEscape(data.day || 'Friday')},
  ${sqlEscape(data.time || data.startTime || '11:00 PM')},
  ${sqlEscape(data.entryTime || '')},
  ${sqlEscape(data.startTime || '')},
  ${sqlEscape(data.endTime || '')},
  ${sqlEscape(data.duration || '')},
  ${sqlEscape(data.venue || data.location || '')},
  ${sqlEscape(data.address || '')},
  ${sqlEscape(data.city || '')},
  ${sqlEscape(data.phone || '')},
  ${sqlEscape(data.status || 'upcoming')},
  ${sqlEscape(data.poster || data.banner || '')},
  ${sqlEscape(banners)},
  ${sqlEscape(actors)},
  ${sqlEscape(data.writer || '')},
  ${sqlEscape(data.director || '')},
  ${sqlEscape(data.musicDirector || '')},
  ${sqlEscape(data.singer || '')},
  ${sqlEscape(data.trailerUrl || '')},
  ${Number(data.totalCapacity) || 575},
  ${Number(data.ticketsSold) || 0},
  ${Number(data.totalRevenue) || 0.00},
  ${sqlEscape(data.organizer || data.organizationName || '')},
  ${sqlEscape(data.description || data.about || '')}
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  event_title = EXCLUDED.event_title,
  date = EXCLUDED.date,
  status = EXCLUDED.status,
  updated_at = now();`);
  }
  sqlStatements.push('');

  // 2. Ticket Types
  const ticketTypesSnap = await getDocs(collection(db, 'ticketTypes'));
  console.log(`Fetched ${ticketTypesSnap.size} ticket type(s)`);
  sqlStatements.push('-- 2. TICKET TYPES');
  for (const d of ticketTypesSnap.docs) {
    const data = d.data();
    const eventId = data.eventId || eventIds[0] || '';
    sqlStatements.push(`INSERT INTO public.ticket_types (
  id, event_id, name, committee_name, blocks, rows, badge_text, price,
  total_quota, sold, color, bg_color, text_color, perks, gate_access
) VALUES (
  ${sqlEscape(d.id)},
  ${sqlEscape(eventId)},
  ${sqlEscape(data.name || 'General')},
  ${sqlEscape(data.committeeName || '')},
  ${sqlEscape(data.blocks || [])},
  ${sqlEscape(data.rows || [])},
  ${sqlEscape(data.badgeText || '')},
  ${Number(data.price) || 0.00},
  ${Number(data.totalQuota) || 0},
  ${Number(data.sold) || 0},
  ${sqlEscape(data.color || '#4f39f6')},
  ${sqlEscape(data.bgColor || '#eef2ff')},
  ${sqlEscape(data.textColor || '#312e81')},
  ${sqlEscape(data.perks || [])},
  ${sqlEscape(data.gateAccess || [])}
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  updated_at = now();`);
  }
  sqlStatements.push('');

  // 3. Seats (from shows/{id}/seats)
  sqlStatements.push('-- 3. SEATS');
  let seatCount = 0;
  for (const evId of eventIds) {
    const seatsSnap = await getDocs(collection(db, 'shows', evId, 'seats'));
    console.log(`Fetched ${seatsSnap.size} seats for event ${evId}`);
    seatCount += seatsSnap.size;

    // Batch insert 100 rows per statement
    const seatRows = [];
    for (const d of seatsSnap.docs) {
      const s = d.data();
      const blockId = s.blockId || s.block || 'A1';
      const rowId = s.rowId || s.row || 'A';
      const seatNumber = Number(s.seatNumber) || 1;
      const seatLabel = s.seatLabel || `${rowId}${seatNumber}`;
      const status = s.status || 'available';
      const price = Number(s.price) || 100.00;
      const bookedAt = s.bookedAt ? `'${new Date(s.bookedAt).toISOString()}'::timestamptz` : 'NULL';
      const bookingId = s.bookingId ? sqlEscape(s.bookingId) : 'NULL';

      seatRows.push(`(
  ${sqlEscape(d.id)},
  ${sqlEscape(evId)},
  ${sqlEscape(blockId)},
  ${sqlEscape(rowId)},
  ${seatNumber},
  ${sqlEscape(seatLabel)},
  ${sqlEscape(status)},
  ${price},
  ${bookedAt},
  ${bookingId}
)`);

      if (seatRows.length >= 100) {
        sqlStatements.push(`INSERT INTO public.seats (
  id, event_id, block_id, row_id, seat_number, seat_label, status, price, booked_at, booking_id
) VALUES\n${seatRows.join(',\n')}\nON CONFLICT (event_id, block_id, row_id, seat_number) DO UPDATE SET
  status = EXCLUDED.status,
  price = EXCLUDED.price,
  booking_id = EXCLUDED.booking_id,
  booked_at = EXCLUDED.booked_at,
  updated_at = now();\n`);
        seatRows.length = 0;
      }
    }

    if (seatRows.length > 0) {
      sqlStatements.push(`INSERT INTO public.seats (
  id, event_id, block_id, row_id, seat_number, seat_label, status, price, booked_at, booking_id
) VALUES\n${seatRows.join(',\n')}\nON CONFLICT (event_id, block_id, row_id, seat_number) DO UPDATE SET
  status = EXCLUDED.status,
  price = EXCLUDED.price,
  booking_id = EXCLUDED.booking_id,
  booked_at = EXCLUDED.booked_at,
  updated_at = now();\n`);
    }
  }

  // 4. Bookings
  const bookingsSnap = await getDocs(collection(db, 'bookings'));
  console.log(`Fetched ${bookingsSnap.size} booking(s)`);
  sqlStatements.push('-- 4. BOOKINGS');
  for (const d of bookingsSnap.docs) {
    const b = d.data();
    sqlStatements.push(`INSERT INTO public.bookings (
  id, ticket_number, event_id, event_name, customer_name, customer_phone,
  ticket_type_id, ticket_type_name, quantity, unit_price, amount, source,
  counter_name, payment_method, transaction_id, date, time, status,
  booking_status, assigned_gate, block, seats, ticket_amount, base_amount,
  convenience_fee, gst_on_convenience_fee, platform_charge, total_fees,
  final_customer_amount, payment_status, used_tickets, used_seats, used_count,
  entered_count, remaining_count
) VALUES (
  ${sqlEscape(d.id)},
  ${sqlEscape(b.ticketNumber || d.id)},
  ${sqlEscape(b.eventId || b.showId || eventIds[0] || '')},
  ${sqlEscape(b.eventName || '')},
  ${sqlEscape(b.customerName || 'Customer')},
  ${sqlEscape(b.customerPhone || '')},
  ${sqlEscape(b.ticketTypeId || '')},
  ${sqlEscape(b.ticketTypeName || 'General')},
  ${Number(b.quantity) || 1},
  ${Number(b.unitPrice) || 0.00},
  ${Number(b.amount || b.finalCustomerAmount) || 0.00},
  ${sqlEscape(b.source === 'Online' ? 'Online' : 'Counter')},
  ${sqlEscape(b.counterName || '')},
  ${sqlEscape(b.paymentMethod || 'UPI')},
  ${sqlEscape(b.transactionId || '')},
  ${sqlEscape(b.date || '23 Oct 2026')},
  ${sqlEscape(b.time || '11:00 PM')},
  ${sqlEscape(b.status || 'Confirmed')},
  ${sqlEscape(b.bookingStatus || 'Confirmed')},
  ${sqlEscape(b.assignedGate || 'Main Gate')},
  ${sqlEscape(b.block || '')},
  ${sqlEscape(b.seats || [])},
  ${Number(b.ticketAmount) || 0.00},
  ${Number(b.baseAmount) || 0.00},
  ${Number(b.convenienceFee) || 0.00},
  ${Number(b.gstOnConvenienceFee) || 0.00},
  ${Number(b.platformCharge) || 0.00},
  ${Number(b.totalFees) || 0.00},
  ${Number(b.finalCustomerAmount || b.amount) || 0.00},
  ${sqlEscape(b.paymentStatus || 'Successful')},
  ${sqlEscape(b.usedTickets || [])},
  ${sqlEscape(b.usedSeats || [])},
  ${Number(b.usedCount) || 0},
  ${Number(b.enteredCount) || 0},
  ${Number(b.remainingCount) || 1}
) ON CONFLICT (ticket_number) DO UPDATE SET
  status = EXCLUDED.status,
  booking_status = EXCLUDED.booking_status,
  updated_at = now();`);
  }
  sqlStatements.push('');

  // 5. Tickets
  const ticketsSnap = await getDocs(collection(db, 'tickets'));
  console.log(`Fetched ${ticketsSnap.size} ticket(s)`);
  sqlStatements.push('-- 5. TICKETS');
  for (const d of ticketsSnap.docs) {
    const t = d.data();
    sqlStatements.push(`INSERT INTO public.tickets (
  id, ticket_id, booking_id, booking_doc_id, ticket_index, total_tickets,
  event_id, event_name, ticket_type_id, ticket_type_name, seat, seat_index,
  seat_count, block, assigned_gate, customer_name, customer_phone, serial_number,
  qr_token, status, date, time, unit_price
) VALUES (
  ${sqlEscape(d.id)},
  ${sqlEscape(t.ticketId || d.id)},
  ${sqlEscape(t.bookingId || '')},
  ${sqlEscape(t.bookingDocId || '')},
  ${Number(t.ticketIndex) || 1},
  ${Number(t.totalTickets) || 1},
  ${sqlEscape(t.eventId || eventIds[0] || '')},
  ${sqlEscape(t.eventName || '')},
  ${sqlEscape(t.ticketTypeId || '')},
  ${sqlEscape(t.ticketTypeName || 'General')},
  ${sqlEscape(t.seat || '')},
  ${Number(t.seatIndex) || 1},
  ${Number(t.seatCount) || 1},
  ${sqlEscape(t.block || '')},
  ${sqlEscape(t.assignedGate || 'Main Gate')},
  ${sqlEscape(t.customerName || '')},
  ${sqlEscape(t.customerPhone || '')},
  ${sqlEscape(t.serialNumber || d.id)},
  ${sqlEscape(t.qrToken || d.id)},
  ${sqlEscape(t.status || 'ACTIVE')},
  ${sqlEscape(t.date || '23 Oct 2026')},
  ${sqlEscape(t.time || '11:00 PM')},
  ${Number(t.unitPrice) || 0.00}
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  updated_at = now();`);
  }
  sqlStatements.push('');

  // 6. Scanner Members
  const scannersSnap = await getDocs(collection(db, 'scannerMembers'));
  console.log(`Fetched ${scannersSnap.size} scanner member(s)`);
  sqlStatements.push('-- 6. SCANNER MEMBERS');
  for (const d of scannersSnap.docs) {
    const m = d.data();
    sqlStatements.push(`INSERT INTO public.scanner_members (
  id, scanner_id, name, email, mobile, approval_status, account_status,
  assigned_gate_id, total_scans
) VALUES (
  ${sqlEscape(d.id)},
  ${sqlEscape(m.scannerId || `SCN-${d.id.slice(0, 4)}`)},
  ${sqlEscape(m.name || 'Scanner')},
  ${sqlEscape(m.email || '')},
  ${sqlEscape(m.mobile || '0000000000')},
  ${sqlEscape(m.approvalStatus || 'approved')},
  ${sqlEscape(m.accountStatus || 'active')},
  ${sqlEscape(m.assignedGateId || '')},
  ${Number(m.totalScans) || 0}
) ON CONFLICT (scanner_id) DO UPDATE SET
  name = EXCLUDED.name,
  approval_status = EXCLUDED.approval_status,
  account_status = EXCLUDED.account_status,
  updated_at = now();`);
  }
  sqlStatements.push('');

  // 7. Ticket Entries
  const entriesSnap = await getDocs(collection(db, 'ticketEntries'));
  console.log(`Fetched ${entriesSnap.size} ticket entry doc(s)`);
  sqlStatements.push('-- 7. TICKET ENTRIES');
  for (const d of entriesSnap.docs) {
    const e = d.data();
    sqlStatements.push(`INSERT INTO public.ticket_entries (
  id, ticket_id, event_id, scanner_id, scanner_name, gate_id, entry_status,
  scan_result, scanned_at, booking_id, audience_name, ticket_type, seat, message
) VALUES (
  ${sqlEscape(d.id)},
  ${sqlEscape(e.ticketNumber || e.ticketId || d.id)},
  ${sqlEscape(e.eventId || eventIds[0] || '')},
  ${sqlEscape(e.scannerId || 'SCN-001')},
  ${sqlEscape(e.scannerName || 'Gate Scanner')},
  ${sqlEscape(e.gate || e.gateId || '')},
  ${sqlEscape(e.status === 'entered' ? 'entered' : 'rejected')},
  ${sqlEscape(e.status === 'entered' ? 'SUCCESS' : 'INVALID')},
  ${e.scannedAt ? `'${new Date(e.scannedAt).toISOString()}'::timestamptz` : 'now()'},
  ${sqlEscape(e.bookingId || '')},
  ${sqlEscape(e.audienceName || '')},
  ${sqlEscape(e.ticketTypeName || e.ticketType || '')},
  ${sqlEscape(e.seat || '')},
  ${sqlEscape('Migrated entry record')}
) ON CONFLICT (id) DO NOTHING;`);
  }
  sqlStatements.push('');

  // 8. Settings
  const settingsSnap = await getDocs(collection(db, 'settings'));
  console.log(`Fetched ${settingsSnap.size} settings doc(s)`);
  sqlStatements.push('-- 8. SETTINGS');
  for (const d of settingsSnap.docs) {
    sqlStatements.push(`INSERT INTO public.settings (
  id, data, description
) VALUES (
  ${sqlEscape(d.id)},
  ${sqlEscape(d.data())},
  'Migrated from Firebase settings'
) ON CONFLICT (id) DO UPDATE SET
  data = EXCLUDED.data,
  updated_at = now();`);
  }
  sqlStatements.push('');

  // 9. Audit Logs
  const auditSnap = await getDocs(collection(db, 'auditLogs'));
  console.log(`Fetched ${auditSnap.size} audit log(s)`);
  sqlStatements.push('-- 9. AUDIT LOGS');
  for (const d of auditSnap.docs) {
    const a = d.data();
    sqlStatements.push(`INSERT INTO public.audit_logs (
  id, action, performed_by, target_id, timestamp, metadata
) VALUES (
  ${sqlEscape(d.id)},
  ${sqlEscape(a.action || 'ACTION')},
  ${sqlEscape(a.performedBy || 'admin')},
  ${sqlEscape(a.targetId || '')},
  ${a.timestamp ? `'${new Date(a.timestamp).toISOString()}'::timestamptz` : 'now()'},
  ${sqlEscape(a.metadata || {})}
) ON CONFLICT (id) DO NOTHING;`);
  }
  sqlStatements.push('');

  sqlStatements.push('COMMIT;');
  sqlStatements.push('');

  const outputPath = path.join(root, 'supabase', 'migrations', '20261011000003_seed_firebase_data.sql');
  fs.writeFileSync(outputPath, sqlStatements.join('\n'), 'utf8');
  console.log(`\nSuccessfully exported all Firebase data to: ${outputPath}`);
  console.log(`Total seats extracted: ${seatCount}`);
}

run().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
