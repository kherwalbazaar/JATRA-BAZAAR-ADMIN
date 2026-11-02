/**
 * Repair / backfill the Supabase `seats` table from Firestore.
 *
 * The admin panel owns seat layout in Firestore (`shows/{showId}/seats`).
 * The customer app reads seats from Supabase only. Whenever the admin
 * mirror failed, the two drifted apart and the customer app rendered an
 * empty seat map. This script re-syncs them.
 *
 *   node scripts/sync-seats-to-supabase.mjs            -> dry run (report only)
 *   node scripts/sync-seats-to-supabase.mjs --apply    -> write to Supabase
 *
 * Rules (never destroy a sale):
 *   - seat missing in Supabase  -> inserted with the Firestore status/price.
 *   - seat present in both      -> price refreshed; status takes the STRONGER
 *                                  of the two (booked/sold > reserved > available),
 *                                  so a booked seat is never freed by this script.
 *   - seat only in Supabase     -> deleted ONLY when it is still "available".
 *                                  Booked/reserved rows are kept and reported.
 */
import fs from 'node:fs';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const root = path.resolve(process.cwd());

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
      })
  );
}

const env = loadEnv(path.join(root, '.env.local'));
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / key in .env.local');
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

const STATUS_RANK = { available: 0, reserved: 1, locked: 1, booked: 2, sold: 3 };
const rank = (s) => STATUS_RANK[String(s || 'available').toLowerCase()] ?? 0;

const norm = (v) => String(v ?? '').trim().toUpperCase();
const keyOf = (block, row, num) => `${norm(block)}|${norm(row)}|${Number(num)}`;

function toIso(val) {
  if (!val) return null;
  if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate().toISOString();
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString();
  }
  if (typeof val === 'string' && !Number.isNaN(Date.parse(val))) return new Date(val).toISOString();
  return null;
}

async function fetchAllSupabaseSeats(eventId) {
  const out = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('seats')
      .select(
        'id,seat_id,event_id,block_id,row_id,seat_number,seat_label,status,price,booking_id,reserved_by,reserved_at,booked_at,created_at,updated_at'
      )
      .eq('event_id', eventId)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`supabase read failed for ${eventId}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function upsertChunk(rows) {
  const { error } = await sb
    .from('seats')
    .upsert(rows, { onConflict: 'event_id,block_id,row_id,seat_number' });
  if (error) throw new Error(error.message);
}

async function deleteByIds(ids) {
  const { error } = await sb.from('seats').delete().in('id', ids);
  if (error) throw new Error(error.message);
}

async function run() {
  console.log(APPLY ? 'APPLY MODE — syncing Firestore seats to Supabase' : 'DRY RUN — no writes. Re-run with --apply.');
  console.log('');

  const eventsSnap = await getDocs(collection(db, 'events'));
  const eventIds = eventsSnap.docs.map((d) => d.id);
  console.log(`events: ${eventIds.length}`);

  let inserted = 0;
  let updated = 0;
  let deleted = 0;
  let keptBooked = 0;

  for (const eventId of eventIds) {
    const seatSnap = await getDocs(collection(db, 'shows', eventId, 'seats'));
    if (seatSnap.empty) continue;

    const firestoreSeats = new Map();
    for (const d of seatSnap.docs) {
      const s = d.data();
      const block = norm(s.blockId || s.block);
      const row = norm(s.rowId || s.row);
      const num = Number(s.seatNumber) || 0;
      if (!block || !row || !num) continue;
      const seatId = s.seatId || d.id;
      firestoreSeats.set(keyOf(block, row, num), {
        id: `${eventId}_${seatId}`,
        seat_id: seatId,
        show_id: eventId,
        event_id: eventId,
        block,
        block_id: block,
        row,
        row_id: row,
        number: num,
        seat_number: num,
        seat_label: s.seatLabel || `${row}${num}`,
        status: String(s.status || 'available').toLowerCase(),
        price: Number(s.price) || 100,
        booking_id: s.bookingId || null,
        reserved_by: s.reservedBy || null,
        reserved_at: toIso(s.reservedAt),
        booked_at: toIso(s.bookedAt),
        created_at: toIso(s.createdAt) || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const sbRows = await fetchAllSupabaseSeats(eventId);
    const sbByKey = new Map();
    for (const r of sbRows) {
      sbByKey.set(keyOf(r.block_id, r.row_id, r.seat_number), r);
    }

    const toInsert = [];
    const toUpdate = [];
    const toDelete = [];

    for (const [key, f] of firestoreSeats) {
      const existing = sbByKey.get(key);
      if (!existing) {
        toInsert.push(f);
        continue;
      }
      const patch = {};
      if (Number(existing.price) !== Number(f.price)) patch.price = f.price;
      const stronger = rank(f.status) > rank(existing.status) ? f.status : existing.status;
      if (stronger !== existing.status) patch.status = stronger;
      if (f.booking_id && f.booking_id !== existing.booking_id) patch.booking_id = f.booking_id;
      if (f.reserved_by && f.reserved_by !== existing.reserved_by) patch.reserved_by = f.reserved_by;
      if (f.reserved_at && !existing.reserved_at) patch.reserved_at = f.reserved_at;
      if (f.booked_at && !existing.booked_at) patch.booked_at = f.booked_at;
      if (Object.keys(patch).length) {
        toUpdate.push({ id: existing.id, patch });
      }
    }

    for (const [key, r] of sbByKey) {
      if (firestoreSeats.has(key)) continue;
      if (rank(r.status) > 0) {
        keptBooked++;
        console.log(`  ${eventId}: KEEPING Supabase-only seat ${r.id} (status ${r.status})`);
        continue;
      }
      toDelete.push(r.id);
    }

    console.log(
      `  ${eventId}: firestore=${firestoreSeats.size} supabase=${sbRows.length} ` +
        `-> insert ${toInsert.length}, update ${toUpdate.length}, delete ${toDelete.length}`
    );

    if (!APPLY) continue;

    const CHUNK = 200;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      await upsertChunk(toInsert.slice(i, i + CHUNK));
    }
    inserted += toInsert.length;

    for (const u of toUpdate) {
      const { error } = await sb
        .from('seats')
        .update({ ...u.patch, updated_at: new Date().toISOString() })
        .eq('id', u.id);
      if (error) throw new Error(`update ${u.id} failed: ${error.message}`);
    }
    updated += toUpdate.length;

    for (let i = 0; i < toDelete.length; i += CHUNK) {
      await deleteByIds(toDelete.slice(i, i + CHUNK));
    }
    deleted += toDelete.length;
  }

  console.log('');
  console.log(
    APPLY
      ? `Done. inserted=${inserted} updated=${updated} deleted=${deleted} keptBooked=${keptBooked}`
      : `Dry run only. inserted=${inserted} updated=${updated} deleted=${deleted} keptBooked=${keptBooked}`
  );
}

run().catch((err) => {
  console.error('Sync failed:', err.message || err);
  process.exit(1);
});
