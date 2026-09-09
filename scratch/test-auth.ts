import { auth } from '../lib/firebase';
import { signInAnonymously, createUserWithEmailAndPassword } from 'firebase/auth';

async function test() {
  try {
    const anon = await signInAnonymously(auth);
    console.log('Anonymous sign in succeeded! UID:', anon.user.uid);
  } catch (e: any) {
    console.log('Anonymous sign in failed:', e.code, e.message);
  }

  try {
    const emailCred = await createUserWithEmailAndPassword(auth, 'testdemo@mahasetu.gov.in', 'MahaSetu@2026!');
    console.log('Create email succeeded! UID:', emailCred.user.uid);
  } catch (e: any) {
    console.log('Create email failed:', e.code, e.message);
  }

  process.exit(0);
}

test();
