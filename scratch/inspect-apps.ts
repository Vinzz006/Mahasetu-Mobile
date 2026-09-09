import * as dotenv from 'dotenv';
dotenv.config();
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { DEMO_PASSWORD } from '../constants/demoData';

async function run() {
  console.log('Signing in as Anusha...');
  const userA = await signInWithEmailAndPassword(auth, 'anusha@mahasetu.gov.in', DEMO_PASSWORD);
  console.log('Anusha UID:', userA.user.uid);

  const appsRef = collection(db, 'applications');
  
  // Test query with citizenUid
  try {
    const q1 = query(appsRef, where('citizenUid', '==', userA.user.uid));
    const s1 = await getDocs(q1);
    console.log('Query where citizenUid == Anusha UID returned:', s1.size, 'docs');
  } catch (e: any) {
    console.error('Query where citizenUid failed:', e.message);
  }

  // Test query with citizenId
  try {
    const q2 = query(appsRef, where('citizenId', '==', userA.user.uid));
    const s2 = await getDocs(q2);
    console.log('Query where citizenId == Anusha UID returned:', s2.size, 'docs');
  } catch (e: any) {
    console.error('Query where citizenId failed:', e.message);
  }

  // Test unconstrained query
  try {
    const q3 = query(appsRef);
    const s3 = await getDocs(q3);
    console.log('Query all applications returned:', s3.size, 'docs');
  } catch (e: any) {
    console.log('Query all applications correctly failed with:', e.message);
  }

  // Test consents query with citizenUid
  const cRef = collection(db, 'consents');
  try {
    const qc1 = query(cRef, where('citizenUid', '==', userA.user.uid));
    const sc1 = await getDocs(qc1);
    console.log('Query where consents citizenUid == Anusha UID returned:', sc1.size, 'docs');
  } catch (e: any) {
    console.error('Query where consents citizenUid failed:', e.message);
  }

  // Test consents unconstrained query
  try {
    const qc2 = query(cRef);
    const sc2 = await getDocs(qc2);
    console.log('Query all consents returned:', sc2.size, 'docs');
  } catch (e: any) {
    console.log('Query all consents correctly failed with:', e.message);
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
