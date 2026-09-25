const { initializeApp, getApps, getApp } = require('firebase/app');
const { getFirestore, getDocs, collection } = require('firebase/firestore');
const app = getApps().length ? getApp() : initializeApp({
  apiKey: 'AIzaSyDcc6ANkeJAuUSvedrhuumEog2zI4YPzXc',
  authDomain: 'event-management-system-27c89.firebaseapp.com',
  projectId: 'event-management-system-27c89',
  appId: '1:536795248572:web:320f3d8b0920f7db8a9db9',
});
const db = getFirestore(app);
const cols = ['events', 'bookings', 'ticketTypes', 'gates', 'counters', 'settings', 'scannerMembers', 'ticketEntries', 'auditLogs'];
(async () => {
  for (const c of cols) {
    try {
      const s = await getDocs(collection(db, c));
      console.log(c.padEnd(16), 'READ OK  docs=' + s.size);
    } catch (e) {
      console.log(c.padEnd(16), 'DENIED  ', e.code || e.message);
    }
  }
  process.exit(0);
})();
