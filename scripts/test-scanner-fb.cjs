/* Quick connectivity test: scannerMembers collection read/write */
const { initializeApp, getApps, getApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, onSnapshot, query, where } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
}
const cfg = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDcc6ANkeJAuUSvedrhuumEog2zI4YPzXc',
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'event-management-system-27c89.firebaseapp.com',
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'event-management-system-27c89',
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'event-management-system-27c89.firebasestorage.app',
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '536795248572',
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:536795248572:web:320f3d8b0920f7db8a9db9',
};

(async () => {
  try {
    const app = getApps().length ? getApp() : initializeApp(cfg);
    const db = getFirestore(app);

    // 1. READ existing members
    const snap = await getDocs(collection(db, 'scannerMembers'));
    console.log('READ ok — existing scannerMembers:', snap.size);
    snap.docs.slice(0, 5).forEach((d) => {
      const x = d.data();
      console.log('  -', d.id, '|', x.scannerId, '|', x.name, '|', x.approvalStatus, '|', x.accountStatus);
    });

    // 2. WRITE a temp doc
    const ref = await addDoc(collection(db, 'scannerMembers'), {
      scannerId: 'SCN-TEST',
      name: 'Connectivity Test',
      email: 'test@example.com',
      mobile: '+91 00000 00000',
      profilePhoto: '',
      approvalStatus: 'pending',
      accountStatus: 'active',
      createdAt: new Date().toISOString(),
      totalScans: 0,
    });
    console.log('WRITE ok — created doc:', ref.id);

    // 3. Listener test (2s)
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => { unsub(); reject(new Error('listener timeout (no snapshot in 2s)')); }, 4000);
      const unsub = onSnapshot(collection(db, 'scannerMembers'), (s) => {
        clearTimeout(t);
        console.log('LISTENER ok — snapshot docs:', s.size);
        unsub();
        resolve();
      }, (err) => {
        clearTimeout(t);
        reject(err);
      });
    });

    // 4. where() query test (portal login)
    const q = query(collection(db, 'scannerMembers'), where('scannerId', '==', 'SCN-TEST'));
    const qs = await getDocs(q);
    console.log('QUERY ok — where scannerId == SCN-TEST:', qs.size);

    // 5. cleanup
    await deleteDoc(doc(db, 'scannerMembers', ref.id));
    console.log('CLEANUP ok — test doc deleted');
    console.log('\nALL TESTS PASSED — scannerMembers fully connected');
    process.exit(0);
  } catch (err) {
    console.error('\nFAILED:', err && err.code ? err.code : '', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
