/**
 * One-time reset: clear ALL bookings/tickets from Firestore and free every seat.
 *
 *   node scripts/reset-bookings.cjs           -> dry run (counts only, no writes)
 *   node scripts/reset-bookings.cjs --yes     -> actually delete/reset
 *
 * Clears:  bookings / tickets / ticketEntries  (all events)
 * Resets:  seats/{eventId}/{block}.status -> "available"  (all events/blocks)
 */
const { initializeApp, getApps, getApp } = require('firebase/app');
const {
  getFirestore, collection, getDocs, doc, deleteDoc, updateDoc, writeBatch,
} = require('firebase/firestore');

const APPLY = process.argv.includes('--yes');

const app = getApps().length ? getApp() : initializeApp({
  apiKey: 'AIzaSyDcc6ANkeJAuUSvedrhuumEog2zI4YPzXc',
  authDomain: 'event-management-system-27c89.firebaseapp.com',
  projectId: 'event-management-system-27c89',
  appId: '1:536795248572:web:320f3d8b0920f7db8a9db9',
});
const db = getFirestore(app);

const CLEAR_COLS = ['bookings', 'tickets', 'ticketEntries'];
const KNOWN_BLOCKS = [
  'A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3',
  'A', 'B', 'C', 'D', 'D1', 'D2', 'D3', 'GALLERY', 'STANDING', 'GROUND',
  'VIP', 'N1', 'N2', 'S1', 'S2',
];

async function clearCollection(name) {
  const snap = await getDocs(collection(db, name));
  let deleted = 0;
  for (const d of snap.docs) {
    if (APPLY) await deleteDoc(d.ref);
    deleted++;
  }
  return deleted;
}

async function loadSeatMeta() {
  const map = new Map();
  try {
    const snap = await getDocs(collection(db, 'seatMeta'));
    snap.docs.forEach((d) => map.set(d.id, d.data().blocks || []));
  } catch (e) {
    console.warn('  could not read seatMeta:', e.code || e.message);
  }
  return map;
}

async function collectEventIds(metaById) {
  const ids = new Set(metaById.keys());
  try {
    const snap = await getDocs(collection(db, 'events'));
    snap.docs.forEach((d) => ids.add(d.id));
  } catch (e) {
    console.warn('  could not read events:', e.code || e.message);
  }
  return [...ids];
}

async function resetEventSeats(eventId, metaBlocksById) {
  const blocks = new Set(KNOWN_BLOCKS);
  (metaBlocksById.get(eventId) || []).forEach((b) => b && blocks.add(String(b).toUpperCase()));

  let freed = 0;
  for (const block of blocks) {
    let snap;
    try {
      snap = await getDocs(collection(db, 'seats', eventId, block));
    } catch (e) {
      continue;
    }
    if (snap.empty) continue;
    const busy = snap.docs.filter((d) => (d.data().status || 'available') !== 'available');
    if (!busy.length) continue;
    if (APPLY) {
      // Firestore batch limit = 500
      for (let i = 0; i < busy.length; i += 450) {
        const batch = writeBatch(db);
        busy.slice(i, i + 450).forEach((d) => {
          batch.update(d.ref, { status: 'available', bookedAt: null, bookedBy: null });
        });
        await batch.commit();
      }
    }
    freed += busy.length;
  }
  return freed;
}

(async () => {
  console.log(APPLY ? 'APPLY MODE — deleting/resetting...' : 'DRY RUN — no writes. Re-run with --yes to apply.\n');

  for (const col of CLEAR_COLS) {
    try {
      const n = await clearCollection(col);
      console.log(`${col.padEnd(15)} ${APPLY ? 'deleted' : 'would delete'} ${n} docs`);
    } catch (e) {
      console.log(`${col.padEnd(15)} FAILED:`, e.code || e.message);
    }
  }

  const metaById = await loadSeatMeta();
  const eventIds = await collectEventIds(metaById);
  console.log(`\nevents scanned: ${eventIds.length}`);
  for (const eventId of eventIds) {
    try {
      const freed = await resetEventSeats(eventId, metaById);
      console.log(`  ${eventId.padEnd(24)} ${APPLY ? 'freed' : 'would free'} ${freed} booked seats`);
    } catch (e) {
      console.log(`  ${eventId.padEnd(24)} FAILED:`, e.code || e.message);
    }
  }

  console.log(APPLY ? '\nDone. Admin dashboard + user app (My Ticket) are now blank.' : '\nDry run only.');
  process.exit(0);
})();
