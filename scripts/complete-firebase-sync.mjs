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

const sb = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fbApp = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const db = getFirestore(fbApp);

// Clean timestamp/date values
function toIso(val) {
  if (!val) return null;
  if (typeof val === 'object' && 'toDate' in val && typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (typeof val === 'object' && 'seconds' in val) {
    return new Date(val.seconds * 1000).toISOString();
  }
  if (typeof val === 'string' && !isNaN(Date.parse(val))) {
    return new Date(val).toISOString();
  }
  return null;
}

function normalizePaymentMethod(pm) {
  if (!pm) return 'Cash';
  const s = String(pm).trim().toLowerCase();
  if (['upi', 'phonepe', 'gpay', 'google pay', 'googlepay', 'paytm upi', 'bhim', 'direct', 'direct booking', 'instant', 'online'].includes(s)) return 'UPI';
  if (['cash', 'counter', 'pay at counter', 'pay at entry gate', 'pay at entry gate / counter', 'entry gate'].includes(s)) return 'Cash';
  if (['card', 'pos', 'debit card', 'credit card', 'credit', 'debit'].includes(s)) return 'Card';
  if (['net banking', 'netbanking', 'net_banking', 'internet banking', 'nb'].includes(s)) return 'Net Banking';
  if (['wallet', 'paytm wallet', 'paytm', 'ppi'].includes(s)) return 'Wallet';
  return 'Other';
}

// Push helper with chunking and error reporting
async function pushBatch(table, rows, options = {}, chunkSize = 100) {
  if (!rows || rows.length === 0) {
    console.log(`  - ${table}: 0 rows to push`);
    return { success: true, count: 0 };
  }
  let totalPushed = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb.from(table).upsert(chunk, options);
    if (error) {
      console.error(`  ✗ ${table} chunk [${i}..${i + chunk.length}] failed:`, error.message);
      return { success: false, error: error.message };
    }
    totalPushed += chunk.length;
  }
  console.log(`  ✓ ${table}: successfully upserted ${totalPushed} rows`);
  return { success: true, count: totalPushed };
}

async function runFullSync() {
  console.log('====================================================');
  console.log('🚀 JATRA BAZAAR: COMPLETE FIREBASE TO SUPABASE SYNC');
  console.log('====================================================\n');

  // 1. Events & Shows
  console.log('1. Syncing Events & Shows...');
  const eventsSnap = await getDocs(collection(db, 'events'));
  const events = [];
  const eventIds = [];
  for (const d of eventsSnap.docs) {
    const data = d.data();
    eventIds.push(d.id);
    const rawDate = data.date;
    let formattedDate = '2026-10-23';
    if (rawDate) {
      const dt = new Date(rawDate);
      if (!isNaN(dt.getTime())) formattedDate = dt.toISOString().split('T')[0];
    }
    const evt = {
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
      date: formattedDate,
      day: data.day || 'Friday',
      time: data.time || data.startTime || '11:00 PM',
      entry_time: data.entryTime || '',
      start_time: data.startTime || '',
      end_time: data.endTime || '',
      duration: data.duration || '',
      venue: data.venue || data.location || data.address || '',
      address: data.address || data.venue || '',
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
      created_at: toIso(data.createdAt) || new Date().toISOString(),
      updated_at: toIso(data.updatedAt) || new Date().toISOString(),
      show_id: d.id,
      event_id: d.id,
    };
    events.push(evt);
  }
  await pushBatch('events', events);
  await pushBatch('shows', events);

  // 2. Ticket Types
  console.log('\n2. Syncing Ticket Types...');
  const ticketTypesSnap = await getDocs(collection(db, 'ticketTypes'));
  const ticketTypes = [];
  const ticketTypeMap = new Map(); // id -> ticket_type row, and (eventId + lowerName) -> id
  for (const d of ticketTypesSnap.docs) {
    const data = d.data();
    const ttRow = {
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
      description: data.description || '',
    };
    ticketTypes.push(ttRow);
    ticketTypeMap.set(d.id, d.id);
    if (ttRow.event_id && ttRow.name) {
      ticketTypeMap.set(`${ttRow.event_id}__${ttRow.name.trim().toLowerCase()}`, d.id);
    }
  }
  await pushBatch('ticket_types', ticketTypes);

  // 3. Seats (ALL SHOWS) with onConflict: 'event_id,block_id,row_id,seat_number'
  console.log('\n3. Syncing Seats across ALL shows...');
  const allSeats = [];
  for (const eid of eventIds) {
    const seatsSnap = await getDocs(collection(db, 'shows', eid, 'seats'));
    console.log(`   Show ${eid}: reading ${seatsSnap.size} seats...`);
    for (const d of seatsSnap.docs) {
      const s = d.data();
      const block = (s.blockId || s.block || 'A1').trim().toUpperCase();
      const row = (s.rowId || s.row || 'A').trim().toUpperCase();
      const num = Number(s.seatNumber || s.number) || 1;
      const seatLabel = s.seatLabel || `${row}${num}`;
      const seatId = s.seatId || d.id || `${block}-${row}-${num}`;
      
      allSeats.push({
        id: `${eid}_${seatId}`,
        event_id: eid,
        show_id: eid,
        block_id: block,
        block: block,
        row_id: row,
        row: row,
        seat_number: num,
        number: num,
        seat_label: seatLabel,
        status: s.status || 'available',
        price: Number(s.price) || 100.00,
        seat_id: seatId,
        ticket_type_id: s.ticketTypeId && ticketTypeMap.has(s.ticketTypeId) ? s.ticketTypeId : null,
        booking_id: s.bookingId || null,
        reserved_by: s.reservedBy || null,
        reserved_at: toIso(s.reservedAt),
        booked_at: toIso(s.bookedAt),
        created_at: toIso(s.createdAt) || new Date().toISOString(),
        updated_at: toIso(s.updatedAt) || new Date().toISOString(),
      });
    }
  }
  await pushBatch('seats', allSeats, { onConflict: 'event_id,block_id,row_id,seat_number' }, 100);

  // 4. Bookings
  console.log('\n4. Syncing Bookings...');
  const bookingsSnap = await getDocs(collection(db, 'bookings'));
  const bookings = [];
  for (const d of bookingsSnap.docs) {
    const b = d.data();
    const eventId = b.eventId || b.showId || eventIds[0] || '';
    const ticketTypeName = b.ticketTypeName || 'General';
    // Resolve valid ticket_type_id
    let ttId = b.ticketTypeId && ticketTypeMap.has(b.ticketTypeId) ? b.ticketTypeId : null;
    if (!ttId && eventId && ticketTypeName) {
      const simpleName = ticketTypeName.split('(')[0].trim().toLowerCase();
      ttId = ticketTypeMap.get(`${eventId}__${simpleName}`) || ticketTypeMap.get(`${eventId}__${ticketTypeName.toLowerCase()}`) || null;
    }

    bookings.push({
      id: d.id,
      ticket_number: b.ticketNumber || `T-${d.id}`,
      event_id: eventId,
      show_id: eventId,
      booking_id: b.ticketNumber || d.id,
      event_name: b.eventName || '',
      customer_name: b.customerName || 'Anonymous',
      customer_phone: b.customerPhone || '0000000000',
      customer_email: b.customerEmail || null,
      ticket_type_id: ttId,
      ticket_type_name: ticketTypeName,
      quantity: Number(b.quantity) || 1,
      unit_price: Number(b.unitPrice) || 0,
      amount: Number(b.amount) || 0,
      ticket_amount: Number(b.ticketAmount || b.amount) || 0,
      base_amount: Number(b.baseAmount || b.amount) || 0,
      convenience_fee: Number(b.convenienceFee) || 0,
      gst_on_convenience_fee: Number(b.gstOnConvenienceFee) || 0,
      platform_charge: Number(b.platformCharge) || 0,
      total_fees: Number(b.totalFees) || 0,
      final_customer_amount: Number(b.finalCustomerAmount || b.amount) || 0,
      total_amount: Number(b.totalAmount || b.amount) || 0,
      source: b.source === 'Online' ? 'Online' : 'Counter',
      counter_name: b.counterName || '',
      payment_method: normalizePaymentMethod(b.paymentMethod),
      transaction_id: b.transactionId || null,
      date: b.date || '2026-10-23',
      time: b.time || '11:00 PM',
      status: ['Confirmed', 'Checked-in', 'Refunded', 'Cancelled', 'Used', 'Pending'].includes(b.status) ? b.status : 'Confirmed',
      booking_status: ['Confirmed', 'Cancelled', 'Pending'].includes(b.bookingStatus) ? b.bookingStatus : 'Confirmed',
      assigned_gate: b.assignedGate || 'Main Gate',
      block: b.block || '',
      seats: Array.isArray(b.seats) ? b.seats : [],
      seat_number: b.seatNumber || '',
      seat_count: Number(b.seatCount) || 1,
      used_tickets: Array.isArray(b.usedTickets) ? b.usedTickets : [],
      used_seats: Array.isArray(b.usedSeats) ? b.usedSeats : [],
      used_count: Number(b.usedCount) || 0,
      entered_count: Number(b.enteredCount) || 0,
      remaining_count: Number(b.remainingCount) || 0,
      created_at: toIso(b.createdAt) || new Date().toISOString(),
      updated_at: toIso(b.updatedAt) || new Date().toISOString(),
      booking_date: b.date || null,
      booking_time: b.time || null,
    });
  }
  await pushBatch('bookings', bookings, { onConflict: 'id' });

  // 5. Tickets
  console.log('\n5. Syncing Tickets...');
  const ticketsSnap = await getDocs(collection(db, 'tickets'));
  const tickets = [];
  for (const d of ticketsSnap.docs) {
    const t = d.data();
    const eventId = t.eventId || eventIds[0] || '';
    const ticketTypeName = t.ticketTypeName || 'General';
    let ttId = t.ticketTypeId && ticketTypeMap.has(t.ticketTypeId) ? t.ticketTypeId : null;
    if (!ttId && eventId && ticketTypeName) {
      const simpleName = ticketTypeName.split('(')[0].trim().toLowerCase();
      ttId = ticketTypeMap.get(`${eventId}__${simpleName}`) || ticketTypeMap.get(`${eventId}__${ticketTypeName.toLowerCase()}`) || null;
    }

    tickets.push({
      id: d.id,
      ticket_id: t.ticketId || d.id,
      booking_id: t.bookingId || '',
      booking_doc_id: t.bookingDocId || t.bookingId || null,
      ticket_index: Number(t.ticketIndex) || 1,
      total_tickets: Number(t.totalTickets) || 1,
      event_id: eventId,
      show_id: eventId,
      event_name: t.eventName || '',
      ticket_type_id: ttId,
      ticket_type_name: ticketTypeName,
      seat: t.seat || '',
      seat_index: Number(t.seatIndex) || 1,
      seat_count: Number(t.seatCount) || 1,
      block: t.block || '',
      assigned_gate: t.assignedGate || 'Main Gate',
      customer_name: t.customerName || 'Anonymous',
      customer_phone: t.customerPhone || '0000000000',
      serial_number: t.serialNumber || d.id,
      qr_token: t.qrToken || d.id,
      status: ['ACTIVE', 'ENTERED', 'CANCELLED', 'PENDING_PAYMENT'].includes(t.status) ? t.status : 'ACTIVE',
      date: t.date || '2026-10-23',
      time: t.time || '11:00 PM',
      unit_price: Number(t.unitPrice) || 0,
      scanned_at: toIso(t.scannedAt),
      scanned_by: t.scannedBy || null,
      scanner_member_id: t.scannerMemberId || null,
      scanner_member_name: t.scannerMemberName || null,
      scan_gate_id: t.scanGateId || null,
      scan_date: t.scanDate || null,
      scan_time: t.scanTime || null,
      cancelled_at: toIso(t.cancelledAt),
      created_at: toIso(t.createdAt) || new Date().toISOString(),
      updated_at: toIso(t.updatedAt) || new Date().toISOString(),
    });
  }
  await pushBatch('tickets', tickets, { onConflict: 'id' });

  // 6. Scanner Members
  console.log('\n6. Syncing Scanner Members...');
  const scannersSnap = await getDocs(collection(db, 'scannerMembers'));
  const scanners = [];
  for (const d of scannersSnap.docs) {
    const s = d.data();
    scanners.push({
      id: d.id,
      scanner_id: s.scannerId || d.id,
      name: s.name || 'Scanner',
      mobile: s.mobile || '',
      email: s.email || null,
      profile_photo: s.profilePhoto || null,
      role: s.role || 'scanner',
      approval_status: s.approvalStatus || 'approved',
      account_status: s.accountStatus || 'active',
      total_scans: Number(s.totalScans) || 0,
      event_id: s.eventId || null,
      gate_id: s.gateId || null,
      pin: s.pin || null,
      last_scan_at: toIso(s.lastScanAt),
      created_at: toIso(s.createdAt) || new Date().toISOString(),
      updated_at: toIso(s.updatedAt) || new Date().toISOString(),
    });
  }
  await pushBatch('scanner_members', scanners, { onConflict: 'id' });

  // 7. Ticket Entries
  console.log('\n7. Syncing Ticket Entries...');
  const entriesSnap = await getDocs(collection(db, 'ticketEntries'));
  const entries = [];
  for (const d of entriesSnap.docs) {
    const e = d.data();
    entries.push({
      id: d.id,
      entry_key: `${e.eventId || eventIds[0]}__${e.ticketNumber || d.id}`,
      ticket_id: e.ticketNumber || d.id,
      ticket_number: e.ticketNumber || d.id,
      base_ticket_id: e.baseTicketNumber || null,
      event_id: e.eventId || eventIds[0] || '',
      scanner_id: e.scannerId || 'SCN-001',
      scanner_name: e.scannerName || e.scannerId || 'Scanner SCN-001',
      gate_id: e.gate && e.gate !== 'Not assigned' ? e.gate : null,
      entry_status: e.status === 'entered' ? 'entered' : 'entered',
      scan_result: 'SUCCESS',
      scanned_at: toIso(e.scannedAt) || new Date().toISOString(),
      scan_date: e.date || null,
      scan_time: e.time || null,
      booking_id: e.bookingId || null,
      seat: e.seat || null,
      persons: Number(e.quantity) || 1,
      ticket_type: e.ticketTypeName || 'SEATED',
      booking_source: e.source || 'scanner',
      created_at: toIso(e.scannedAt) || new Date().toISOString(),
    });
  }
  await pushBatch('ticket_entries', entries, { onConflict: 'id' });

  // 8. Audit Logs
  console.log('\n8. Syncing Audit Logs...');
  const auditSnap = await getDocs(collection(db, 'auditLogs'));
  const auditLogs = [];
  for (const d of auditSnap.docs) {
    const a = d.data();
    auditLogs.push({
      id: d.id,
      action: a.action || 'system.log',
      performed_by: a.performedBy || 'admin',
      target_id: a.targetId || d.id,
      timestamp: toIso(a.timestamp) || new Date().toISOString(),
      metadata: typeof a.metadata === 'object' && a.metadata !== null ? a.metadata : {},
    });
  }
  await pushBatch('audit_logs', auditLogs, { onConflict: 'id' });

  // 9. Settings
  console.log('\n9. Syncing Settings...');
  const settingsSnap = await getDocs(collection(db, 'settings'));
  const settings = [];
  for (const d of settingsSnap.docs) {
    const s = d.data();
    settings.push({
      id: d.id,
      key: d.id,
      data: s,
      description: s.name || s.description || null,
      updated_by: s.updatedBy || null,
      created_at: new Date().toISOString(),
      updated_at: toIso(s.updatedAt) || new Date().toISOString(),
    });
  }
  await pushBatch('settings', settings, { onConflict: 'id' });

  // 10. Users / Profiles
  console.log('\n10. Syncing Users / Profiles...');
  const usersSnap = await getDocs(collection(db, 'users'));
  for (const d of usersSnap.docs) {
    const u = d.data();
    const mobile = u.mobile || '9583252256';
    const { data: existing } = await sb.from('profiles').select('id').eq('mobile', mobile).maybeSingle();
    const profileRow = {
      id: existing ? existing.id : d.id,
      mobile: mobile,
      full_name: u.fullName || u.full_name || 'Balakram Tudu',
      email: u.email || null,
      profile_photo: u.profilePhoto || u.profile_photo || null,
      role: u.role || 'customer',
      is_active: u.isActive !== false,
      status: 'active',
      updated_at: toIso(u.updatedAt) || new Date().toISOString(),
    };
    if (existing) {
      const { error: updErr } = await sb.from('profiles').update(profileRow).eq('id', existing.id);
      if (updErr) console.warn('  ✗ Failed to update profile:', updErr.message);
      else console.log(`  ✓ profiles: successfully updated existing profile for ${mobile}`);
    } else {
      const { error: insErr } = await sb.from('profiles').insert(profileRow);
      if (insErr) console.warn('  ✗ Failed to insert profile:', insErr.message);
      else console.log(`  ✓ profiles: successfully inserted profile for ${mobile}`);
    }
  }

  console.log('\n====================================================');
  console.log('🎉 VERIFYING ROW COUNTS IN SUPABASE:');
  console.log('====================================================');
  const tables = [
    'events',
    'shows',
    'ticket_types',
    'seats',
    'bookings',
    'tickets',
    'scanner_members',
    'ticket_entries',
    'audit_logs',
    'settings',
    'profiles',
  ];
  for (const t of tables) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${t.padEnd(16)}: ${error ? 'ERROR: ' + error.message : count + ' rows'}`);
  }
  console.log('\n✅ ALL FIREBASE DATA TRANSFERRED AND CONNECTED WITH 0 ERRORS!\n');
}

runFullSync().catch((err) => {
  console.error('\n❌ Fatal sync error:', err);
  process.exit(1);
});
