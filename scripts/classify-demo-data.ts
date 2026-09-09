import * as dotenv from 'dotenv';
dotenv.config();

import { db, auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { DEMO_PASSWORD } from '../constants/demoData';

/**
 * Classifies explicitly seeded demonstration personas and their previous test records
 * with isDemo: true, cleanly isolating them from production administrative metrics
 * without deleting user accounts or breaking login functionality.
 */
async function classifyDemoData() {
  console.log('====================================================');
  console.log('MAHASETU DEMO DATA CLASSIFICATION ENGINE');
  console.log('====================================================\n');

  console.log('[1] Authenticating as Admin...');
  await signInWithEmailAndPassword(auth, 'tammu.admin@mahasetu.gov.in', DEMO_PASSWORD);
  console.log('    ✓ Authenticated as Administrator.\n');

  // 1. Classify Demo Personas in `users`
  console.log('[2] Classifying seeded demo user personas in users collection...');
  const demoPersonaEmails = new Set([
    'anusha@mahasetu.gov.in',
    'muthumayil@mahasetu.gov.in',
    'akshita@mahasetu.gov.in',
    'kanimozhi@mahasetu.gov.in',
    'applicant.test@mahasetu.gov.in',
  ]);

  const usersSnap = await getDocs(collection(db, 'users'));
  const demoCitizenUids = new Set<string>();

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const email = (data.email || '').toLowerCase().trim();

    if (demoPersonaEmails.has(email)) {
      demoCitizenUids.add(userDoc.id);
      await updateDoc(doc(db, 'users', userDoc.id), {
        isDemo: true,
        recordType: 'DEMO',
      });
      console.log(`    Tagged DEMO Persona: ${data.name || email} (${userDoc.id})`);
    } else {
      // Official operational accounts or real user registrations
      await updateDoc(doc(db, 'users', userDoc.id), {
        isDemo: false,
        recordType: 'PRODUCTION',
      });
      console.log(`    Preserved REAL/OPERATIONAL Account: ${data.name || email} (${userDoc.id})`);
    }
  }

  // 2. Classify Applications submitted by demo personas
  console.log('\n[3] Classifying applications collection...');
  const appsSnap = await getDocs(collection(db, 'applications'));
  const demoAppIds = new Set<string>();

  for (const appDoc of appsSnap.docs) {
    const data = appDoc.data();
    const citizenUid = data.citizenId || data.citizenUid;

    if (demoCitizenUids.has(citizenUid) || data.citizenName === 'Anusha G.' || data.citizenName === 'Muthumayil M.' || data.citizenName === 'Akshita S S') {
      demoAppIds.add(appDoc.id);
      await updateDoc(doc(db, 'applications', appDoc.id), {
        isDemo: true,
        recordType: 'DEMO',
      });
      console.log(`    Tagged DEMO Application: ${appDoc.id} (${data.citizenName})`);
    } else {
      await updateDoc(doc(db, 'applications', appDoc.id), {
        isDemo: false,
        recordType: 'PRODUCTION',
      });
      console.log(`    Preserved REAL Application: ${appDoc.id} (${data.citizenName})`);
    }
  }

  // 3. Classify applicationVerifications belonging to demo applications
  console.log('\n[4] Classifying applicationVerifications collection...');
  const verifsSnap = await getDocs(collection(db, 'applicationVerifications'));
  for (const vDoc of verifsSnap.docs) {
    const data = vDoc.data();
    if (demoAppIds.has(data.applicationId)) {
      await updateDoc(doc(db, 'applicationVerifications', vDoc.id), {
        isDemo: true,
        recordType: 'DEMO',
      });
    } else {
      await updateDoc(doc(db, 'applicationVerifications', vDoc.id), {
        isDemo: false,
        recordType: 'PRODUCTION',
      });
    }
  }
  console.log(`    Processed ${verifsSnap.size} verification slot records.`);

  // 4. Classify integrationLogs belonging to demo applications
  console.log('\n[5] Classifying integrationLogs collection...');
  const logsSnap = await getDocs(collection(db, 'integrationLogs'));
  for (const lDoc of logsSnap.docs) {
    const data = lDoc.data();
    if (demoAppIds.has(data.applicationId) || demoCitizenUids.has(data.citizenId)) {
      await updateDoc(doc(db, 'integrationLogs', lDoc.id), {
        isDemo: true,
        recordType: 'DEMO',
      });
      console.log(`    Tagged DEMO SMS Log: ${lDoc.id} (App: ${data.applicationId})`);
    } else {
      await updateDoc(doc(db, 'integrationLogs', lDoc.id), {
        isDemo: false,
        recordType: 'PRODUCTION',
      });
      console.log(`    Preserved REAL SMS Log: ${lDoc.id}`);
    }
  }

  console.log('\n====================================================');
  console.log('DEMO DATA CLASSIFICATION COMPLETE');
  console.log('All demo records marked with isDemo: true');
  console.log('All real accounts marked with isDemo: false');
  console.log('====================================================');
  process.exit(0);
}

classifyDemoData().catch((err) => {
  console.error('Classification error:', err);
  process.exit(1);
});
