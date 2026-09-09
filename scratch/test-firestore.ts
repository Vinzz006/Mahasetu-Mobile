import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

async function testFirestore() {
  try {
    const snap = await getDocs(collection(db, 'departments'));
    console.log('Firestore connected! Departments count:', snap.size);
  } catch (e: any) {
    console.log('Firestore test result:', e.code, e.message);
  }
  process.exit(0);
}

testFirestore();
