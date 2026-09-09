import * as dotenv from 'dotenv';
dotenv.config();

import { db, auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { DEMO_PASSWORD } from '../constants/demoData';

async function check() {
  console.log('Authenticating...');
  await signInWithEmailAndPassword(auth, 'tammu.admin@mahasetu.gov.in', DEMO_PASSWORD);
  console.log('Authenticated.');

  const cols = [
    'users',
    'applications',
    'applicationVerifications',
    'integrationLogs',
    'auditLogs',
    'consents',
    'dataExchanges',
    'residentProfiles',
  ];

  for (const c of cols) {
    const snap = await getDocs(collection(db, c));
    console.log(`\nCollection: ${c} (${snap.size} documents)`);
    snap.docs.forEach((d) => {
      const data = d.data();
      console.log(`  - [${d.id}]:`, {
        email: data.email,
        name: data.name || data.citizenName,
        role: data.role,
        status: data.status,
        isDemo: data.isDemo,
        serviceId: data.serviceId,
        applicationId: data.applicationId,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
      });
    });
  }
  process.exit(0);
}

check().catch((err) => {
  console.error('Error checking db:', err);
  process.exit(1);
});
