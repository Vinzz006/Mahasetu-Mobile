import * as dotenv from 'dotenv';
dotenv.config();

import { db, auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { DEMO_USERS, DEMO_PASSWORD } from '../constants/demoData';

const OFFICIAL_EMAILS = new Set(DEMO_USERS.map((u) => u.email.toLowerCase()));

async function inspectOldUsers() {
  console.log('--- Authenticating Admin ---');
  await signInWithEmailAndPassword(auth, 'admin.onboarding@mahasetu.gov.in', DEMO_PASSWORD);
  console.log('Authenticated.\n');

  console.log('Official Demo Emails:', Array.from(OFFICIAL_EMAILS));

  // 1. Check users collection
  console.log('\n================ USERS COLLECTION ================');
  const usersSnap = await getDocs(collection(db, 'users'));
  const oldUsers: Array<{ id: string; email?: string; name?: string; role?: string }> = [];
  const officialUsers: Array<{ id: string; email?: string; name?: string; role?: string }> = [];

  usersSnap.forEach((d) => {
    const data = d.data();
    const email = (data.email || '').toLowerCase();
    if (OFFICIAL_EMAILS.has(email)) {
      officialUsers.push({ id: d.id, email: data.email, name: data.name, role: data.role });
    } else {
      oldUsers.push({ id: d.id, email: data.email, name: data.name, role: data.role });
    }
  });

  console.log(`Total users in Firestore: ${usersSnap.size}`);
  console.log(`Official demo users found (${officialUsers.length}):`);
  officialUsers.forEach((u) => console.log(`  ✓ [${u.id}] ${u.name} (${u.email}) - ${u.role}`));

  console.log(`\nOld / Non-official users found (${oldUsers.length}):`);
  oldUsers.forEach((u) => console.log(`  ⚠️ [${u.id}] ${u.name || '<no-name>'} (${u.email || '<no-email>'}) - ${u.role}`));

  // 2. Check applications collection
  console.log('\n================ APPLICATIONS COLLECTION ================');
  const appsSnap = await getDocs(collection(db, 'applications'));
  console.log(`Total applications: ${appsSnap.size}`);
  const oldApps: any[] = [];
  appsSnap.forEach((d) => {
    const data = d.data();
    const citizenEmail = (data.citizenEmail || data.email || '').toLowerCase();
    const isOfficial = OFFICIAL_EMAILS.has(citizenEmail) || officialUsers.some((u) => u.id === data.citizenId || u.id === data.userId);
    if (!isOfficial) {
      oldApps.push({ id: d.id, citizenId: data.citizenId, citizenName: data.citizenName, citizenEmail, serviceId: data.serviceId, status: data.status });
    }
  });
  console.log(`Old / Non-official applications found: ${oldApps.length}`);
  oldApps.forEach((a) => console.log(`  ⚠️ App [${a.id}]: ${a.citizenName} (${a.citizenEmail}) - ${a.serviceId} [${a.status}] (citizenId: ${a.citizenId})`));

  // 3. Check residentProfiles
  console.log('\n================ RESIDENT PROFILES ================');
  const profilesSnap = await getDocs(collection(db, 'residentProfiles'));
  console.log(`Total resident profiles: ${profilesSnap.size}`);
  profilesSnap.forEach((d) => {
    const data = d.data();
    console.log(`  Profile [${d.id}]:`, { name: data.name, email: data.email, aadhaarNumber: data.aadhaarNumber, isDemo: data.isDemo });
  });

  // 4. Check applicationVerifications
  console.log('\n================ APPLICATION VERIFICATIONS ================');
  const verifsSnap = await getDocs(collection(db, 'applicationVerifications'));
  console.log(`Total verification documents: ${verifsSnap.size}`);

  process.exit(0);
}

inspectOldUsers().catch((err) => {
  console.error('Inspection error:', err);
  process.exit(1);
});
