import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

async function check() {
  const emails = [
    'citizen.priya@mahasetu.gov.in',
    'citizen.rahul@mahasetu.gov.in',
    'officer.dept_a@mahasetu.gov.in',
    'admin.onboarding@mahasetu.gov.in'
  ];
  for (const email of emails) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, 'MahaSetu@2026!');
      console.log(`Signed in: ${email} -> UID: ${cred.user.uid}`);
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      console.log(`Doc exists: ${userDoc.exists()}`, userDoc.data());
    } catch (e: any) {
      console.log(`Failed for ${email}: ${e.code} ${e.message}`);
    }
  }
  process.exit(0);
}

check();
