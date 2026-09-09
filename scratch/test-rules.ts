import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

async function testRules() {
  const cred = await signInWithEmailAndPassword(auth, 'tammu.admin@mahasetu.gov.in', 'MahaSetu@2026!');
  console.log('Signed in as Tammu, UID:', cred.user.uid);

  // Try creating Tammu's profile
  try {
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email: 'tammu.admin@mahasetu.gov.in',
      name: 'Tammu Vedesh Kumar',
      role: 'ADMIN',
      status: 'APPROVED',
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    console.log('Created Tammu profile successfully!');
  } catch (e: any) {
    console.log('Failed to create Tammu profile:', e.code, e.message);
  }

  // Also try reading departments
  try {
    const dSnap = await getDoc(doc(db, 'departments', 'DEPARTMENT_A'));
    console.log('Read department doc exists:', dSnap.exists());
  } catch (e: any) {
    console.log('Failed to read department:', e.code, e.message);
  }

  process.exit(0);
}

testRules();
