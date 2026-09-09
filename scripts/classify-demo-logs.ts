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

async function classifyDemoLogs() {
  console.log('[1] Authenticating as Admin...');
  await signInWithEmailAndPassword(auth, 'tammu.admin@mahasetu.gov.in', DEMO_PASSWORD);

  // Classify integrationLogs
  console.log('[2] Classifying integrationLogs...');
  const logsSnap = await getDocs(collection(db, 'integrationLogs'));
  for (const lDoc of logsSnap.docs) {
    const data = lDoc.data();
    // Both existing SMS logs are from the demo application app_1788937618789_syt0o (Akshita S S)
    if (data.applicationId === 'app_1788937618789_syt0o' || data.citizenId === 'kYVqBPzkOFcS4O2WTaa2jO8D5M93') {
      await updateDoc(doc(db, 'integrationLogs', lDoc.id), {
        isDemo: true,
        recordType: 'DEMO',
      });
      console.log(`    Tagged DEMO SMS Log: ${lDoc.id} (App: ${data.applicationId})`);
    }
  }
  console.log('✓ integrationLogs classification finished.');
  process.exit(0);
}

classifyDemoLogs().catch(console.error);
