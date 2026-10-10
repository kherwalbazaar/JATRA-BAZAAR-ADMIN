/**
 * Merge Row E into the Star ticket category (as per serial order):
 *   - ticketTypes/{starId}.rows: ["A","B","C","D"] -> ["A","B","C","D","E"]
 *   - seats with rowId "E" get price updated to the Star price (both paths)
 *
 *   node scripts/merge-row-e.cjs                -> dry run (report only)
 *   node scripts/merge-row-e.cjs --yes          -> update Star rows only
 *   node scripts/merge-row-e.cjs --yes --prices -> also sync E seat prices to Star price
 */
const { initializeApp, getApps, getApp } = require('firebase/app');
const {
  getFirestore, collection, getDocs, doc, updateDoc, writeBatch,
} = require('firebase/firestore');

const APPLY = process.argv.includes('--yes');
const APPLY_PRICES = process.argv.includes('--prices');

const app = getApps().length ? getApp() : initializeApp({
  apiKey: 'AIzaSyDcc6ANkeJAuUSvedrhuumEog2zI4YPzXc',
  authDomain: 'event-management-system-27c89.firebaseapp.com',
  projectId: 'event-management-system-27c89',
  appId: '1:536795248572:web:320f3d8b0920f7db8a9db9',
});
const db = getFirestore(app);

(async () => {
  // 1) Star ticket type
  const ttSnap = await getDocs(collection(db, 'ticketTypes'));
  const star = ttSnap.docs.find((d) => String(d.data().name || '').toLowerCase() === 'star');
  if (!star) { console.log('Star ticket type not found'); process.exit(0); }
  const starData = star.data();
  const rows = Array.isArray(starData.rows) ? starData.rows.map((r) => String(r).toUpperCase()) : [];
  const price = Number(starData.price) || 0;
  console.log(`Star ${star.id}: rows=${JSON.stringify(rows)} price=${price}`);

  if (!rows.includes('E')) {
    const nextRows = [...rows, 'E'].sort();
    console.log(`${APPLY ? 'Updating' : 'Would update'} Star rows -> ${JSON.stringify(nextRows)}`);
    if (APPLY) await updateDoc(doc(db, 'ticketTypes', star.id), { rows: nextRows });
  } else {
    console.log('Row E already in Star rows.');
  }

  // 2) Seats with rowId E (both paths) — sync price to Star price
  const events = await getDocs(collection(db, 'events'));
  for (const ev of events.docs) {
    const showId = ev.id;
    // live path
    const liveSnap = await getDocs(collection(db, 'shows', showId, 'seats'));
    const eSeats = liveSnap.docs.filter((d) => String(d.data().rowId || d.data().row || '').toUpperCase() === 'E');
    const blocks = [...new Set(eSeats.map((d) => d.data().blockId || d.data().block))];
    console.log(`[${showId}] live E seats: ${eSeats.length} in blocks: ${blocks.join(', ') || '-'}`);
    const prices = [...new Set(eSeats.map((d) => Number(d.data().price) || 0))];
    console.log(`[${showId}] live E seat prices: ${prices.join(', ')}`);

    if (APPLY_PRICES && price > 0) {
      let i = 0;
      while (i < eSeats.length) {
        const batch = writeBatch(db);
        eSeats.slice(i, i + 400).forEach((d) => {
          const p = Number(d.data().price) || 0;
          if (p !== price) batch.update(d.ref, { price });
        });
        await batch.commit();
        i += 400;
      }
      // legacy path
      for (const block of blocks) {
        const legSnap = await getDocs(collection(db, 'seats', showId, block));
        const legE = legSnap.docs.filter((d) => String(d.data().rowId || d.data().row || d.id.split('-')[0] || '').toUpperCase() === 'E');
        let j = 0;
        while (j < legE.length) {
          const batch = writeBatch(db);
          legE.slice(j, j + 400).forEach((d) => {
            const p = Number(d.data().price) || 0;
            if (p !== price) batch.update(d.ref, { price });
          });
          await batch.commit();
          j += 400;
        }
        console.log(`[${showId}] legacy block ${block}: ${legE.length} E seats checked`);
      }
    }
  }
  console.log(APPLY ? 'Done.' : 'Dry run — re-run with --yes to apply.');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
