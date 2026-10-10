/**
 * One-time sync: reconcile seat status between the LIVE path
 * (shows/{showId}/seats/{seatId}) and the LEGACY path
 * (seats/{showId}/{block}/{row}-{n}).
 *
 *   node scripts/sync-seat-status.cjs          -> dry run (reports only)
 *   node scripts/sync-seat-status.cjs --yes    -> apply fixes
 *
 * Rules:
 *   - booked/reserved/sold WINS over available (never free a sold seat).
 *   - bookedAt/bookingId copied from whichever side has them.
 *   - legacy booked seat with NO live doc  -> live doc created as booked.
 *   - live  booked seat with NO legacy doc -> legacy untouched (live is source of truth).
 */
const { initializeApp, getApps, getApp } = require('firebase/app');
const {
  getFirestore, collection, getDocs, doc, setDoc, updateDoc, writeBatch,
} = require('firebase/firestore');

const APPLY = process.argv.includes('--yes');

const app = getApps().length ? getApp() : initializeApp({
  apiKey: 'AIzaSyDcc6ANkeJAuUSvedrhuumEog2zI4YPzXc',
  authDomain: 'event-management-system-27c89.firebaseapp.com',
  projectId: 'event-management-system-27c89',
  appId: '1:536795248572:web:320f3d8b0920f7db8a9db9',
});
const db = getFirestore(app);

const RANK = { available: 0, reserved: 1, sold: 2, booked: 3 };
const norm = (s) => String(s || '').trim().toUpperCase();
const statusOf = (d) => String(d && d.status || 'available').toLowerCase();

function keyOf(block, row, n) {
  return `${norm(block)}/${norm(row)}-${Number(n)}`;
}

function legacyKey(block, docId, data) {
  const id = norm(docId);
  const row = norm(data.rowId || data.row);
  const n = Number(data.seatNumber);
  if (row && Number.isFinite(n)) return keyOf(block, row, n);
  // docId like "B-6" (or a full "A1-B-6")
  const parts = id.split('-');
  if (parts.length >= 3) return keyOf(parts[0], parts[1], parts[2]);
  if (parts.length === 2) return keyOf(block, parts[0], parts[1]);
  return `${norm(block)}/${id}`;
}

function liveKey(data, id) {
  const parts = norm(id).split('-');
  const block = norm(data.blockId || data.block) || parts[0];
  const row = norm(data.rowId || data.row) || parts[1];
  const n = Number(data.seatNumber) || Number(parts[2]);
  if (!Number.isFinite(n)) return null;
  return keyOf(block, row, n);
}

async function collectShowIds() {
  const ids = new Set();
  for (const col of ['shows', 'events']) {
    try {
      const snap = await getDocs(collection(db, col));
      snap.docs.forEach((d) => ids.add(d.id));
    } catch (e) {
      console.warn(`  could not read ${col}:`, e.code || e.message);
    }
  }
  try {
    const snap = await getDocs(collection(db, 'seatMeta'));
    snap.docs.forEach((d) => ids.add(d.id));
  } catch (e) {
    console.warn('  could not read seatMeta:', e.code || e.message);
  }
  return [...ids];
}

async function collectBlocks(showId) {
  const blocks = new Set();
  try {
    const snap = await getDocs(collection(db, 'shows', showId, 'seats'));
    snap.docs.forEach((d) => {
      const b = norm(d.data().blockId || d.data().block) || norm(d.id).split('-')[0];
      if (b) blocks.add(b);
    });
  } catch (e) {
    console.warn(`  ${showId}: live seats read failed:`, e.code || e.message);
  }
  try {
    const meta = await getDocs(collection(db, 'seatMeta'));
    meta.docs.forEach((d) => {
      if (d.id !== showId) return;
      (d.data().blocks || []).forEach((b) => b && blocks.add(norm(b)));
    });
  } catch (e) { /* seatMeta optional */ }
  return [...blocks];
}

(async () => {
  console.log(APPLY ? 'APPLY MODE — syncing seat status...\n' : 'DRY RUN — no writes. Re-run with --yes to apply.\n');

  const showIds = await collectShowIds();
  console.log(`shows scanned: ${showIds.length}`);

  let updated = 0, created = 0, conflicts = 0;

  for (const showId of showIds) {
    // Live seats
    const live = new Map();
    try {
      const snap = await getDocs(collection(db, 'shows', showId, 'seats'));
      snap.docs.forEach((d) => {
        const k = liveKey(d.data(), d.id);
        if (k) live.set(k, { ref: d.ref, id: d.id, data: d.data() });
      });
    } catch (e) {
      console.warn(`  ${showId}: live read failed:`, e.code || e.message);
      continue;
    }

    // Legacy seats per block
    const legacy = new Map();
    const blocks = await collectBlocks(showId);
    for (const block of blocks) {
      let snap;
      try {
        snap = await getDocs(collection(db, 'seats', showId, block));
      } catch (e) {
        continue;
      }
      snap.docs.forEach((d) => {
        legacy.set(legacyKey(block, d.id, d.data()), { ref: d.ref, id: d.id, data: d.data(), block });
      });
    }

    const allKeys = new Set([...live.keys(), ...legacy.keys()]);
    const fixes = [];

    for (const k of allKeys) {
      const l = live.get(k);
      const g = legacy.get(k);
      const ls = l ? String(statusOf(l.data)).toLowerCase() : 'available';
      const gs = g ? String(statusOf(g.data)).toLowerCase() : 'available';
      const winner = (RANK[ls] || 0) >= (RANK[gs] || 0) ? ls : gs;

      if (winner !== 'available') conflicts++;

      // Legacy booked, live doc missing -> create live doc as booked
      if (!l && winner !== 'available') {
        fixes.push({ type: 'create-live', k, g, winner });
        continue;
      }
      // Live available but legacy stronger -> update live
      if (l && winner !== ls) {
        fixes.push({ type: 'update-live', k, l, winner, src: g });
        continue;
      }
      // Live stronger, legacy exists & weaker -> update legacy (keep old app in sync)
      if (g && winner !== gs && ls !== 'available') {
        fixes.push({ type: 'update-legacy', k, g, winner, src: l });
      }
    }

    if (!fixes.length) {
      console.log(`  ${showId}: OK (live=${live.size}, legacy=${legacy.size})`);
      continue;
    }

    console.log(`  ${showId}: ${fixes.length} fix(es) (live=${live.size}, legacy=${legacy.size})`);
    for (const f of fixes) {
      console.log(`    ${f.type.padEnd(13)} ${f.k} -> ${f.winner}`);
      if (!APPLY) continue;
      if (f.type === 'create-live') {
        const d = f.g.data;
        const parts = f.k.split('/');
        const [row, n] = parts[1].split('-');
        await setDoc(doc(db, 'shows', showId, 'seats', `${parts[0]}-${row}-${n}`), {
          seatId: `${parts[0]}-${row}-${n}`,
          showId,
          eventId: d.eventId || showId,
          block: parts[0],
          blockId: parts[0],
          row,
          rowId: row,
          seatNumber: Number(n),
          seatLabel: d.seatLabel || `${row}${n}`,
          price: Number(d.price) || 0,
          status: String(f.winner).toLowerCase(),
          bookedAt: d.bookedAt || null,
          bookingId: d.bookingId || null,
          createdAt: d.createdAt || new Date().toISOString(),
        });
        created++;
      } else if (f.type === 'update-live') {
        const patch = { status: f.winner };
        if (f.src && (f.src.data.bookedAt || f.src.data.bookingId)) {
          patch.bookedAt = f.src.data.bookedAt || null;
          patch.bookingId = f.src.data.bookingId || null;
        }
        await updateDoc(f.l.ref, patch);
        updated++;
      } else if (f.type === 'update-legacy') {
        const patch = { status: f.winner };
        if (f.src && (f.src.data.bookedAt || f.src.data.bookingId)) {
          patch.bookedAt = f.src.data.bookedAt || null;
          patch.bookingId = f.src.data.bookingId || null;
        }
        await updateDoc(f.g.ref, patch);
        updated++;
      }
    }
  }

  console.log(APPLY ? `\nDone. created=${created} updated=${updated} (booked-status seats seen: ${conflicts})` : `\nDry run only. Re-run with --yes to apply.`);
  process.exit(0);
})();

