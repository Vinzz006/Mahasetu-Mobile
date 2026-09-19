import * as dotenv from 'dotenv';
dotenv.config();

import { db, auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { DEMO_PASSWORD } from '../constants/demoData';

async function check() {
  await signInWithEmailAndPassword(auth, 'admin.onboarding@mahasetu.gov.in', DEMO_PASSWORD);
  const snap = await getDocs(collection(db, 'integrationLogs'));
  console.log('integrationLogs count:', snap.size);
  snap.docs.forEach((d) => {
    const data = d.data();
    console.log(d.id, {
      status: data.status,
      eventType: data.eventType,
      applicationId: data.applicationId,
      citizenId: data.citizenId,
      isDemo: data.isDemo,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
    });
  });
  process.exit(0);
}

check().catch(console.error);
