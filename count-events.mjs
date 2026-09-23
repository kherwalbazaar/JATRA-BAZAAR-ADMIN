import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDcc6ANkeJAuUSvedrhuumEog2zI4YPzXc",
  authDomain: "event-management-system-27c89.firebaseapp.com",
  projectId: "event-management-system-27c89",
  storageBucket: "event-management-system-27c89.firebasestorage.app",
  messagingSenderId: "536795248572",
  appId: "1:536795248572:web:320f3d8b0920f7db8a9db9",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

try {
  const snap = await getDocs(collection(db, 'events'));
  console.log('Total events in Firestore:', snap.size);
  snap.docs.forEach((d, i) => {
    const data = d.data();
    console.log(`${i + 1}. [${d.id}] ${data.title || '(no title)'} | status: ${data.status || '-'} | date: ${data.date || '-'}`);
  });
} catch (err) {
  console.error('Error reading events:', err.message);
}
