import * as dotenv from 'dotenv';
dotenv.config();

import { db, auth } from '../lib/firebase';
import { signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { DEMO_USERS, DEMO_PASSWORD } from '../constants/demoData';

const OFFICIAL_DEMO_EMAILS = new Set(DEMO_USERS.map((u) => u.email.toLowerCase()));
const OFFICIAL_DEMO_NAMES = new Set(DEMO_USERS.map((u) => u.name.toLowerCase()));

const OLD_EMAILS_CANDIDATES = [
  'anusha@mahasetu.gov.in',
  'muthumayil@mahasetu.gov.in',
  'akshita@mahasetu.gov.in',
  'kanimozhi@mahasetu.gov.in',
  'vinesh.dept_a@mahasetu.gov.in',
  'sai.dept_b@mahasetu.gov.in',
  'omesh.dept_c@mahasetu.gov.in',
  'tammu.admin@mahasetu.gov.in',
  'shanmugam.admin@mahasetu.gov.in',
  'tanushri.auditor@mahasetu.gov.in',
  'vineshhh006@gmail.com',
  'vineshshanmugam006@gmail.com',
  'vineshshanmugam1006@gmail.com',
  'shanmugamvinesh75@gmail.com',
  'mrxyz@gmail.com',
  'mrxxx@gmail.com',
  'mryxz@gmail.com',
  'test.applicant.1788864462775@example.com',
  'citizen.test.1788969500861@gmail.com',
  'applicant.test@mahasetu.gov.in',
];

const PASSWORDS_TO_TRY = [
  'MahaSetu@2026!',
  'MahaSetu@2025!',
  'password',
  'Test@1234',
  '123456',
  'Password@123',
];

async function purgeOldUserData() {
  console.log('========================================================');
  console.log('   MAHASETU DATABASE PURGE: REMOVING ALL OLD USER DATA  ');
  console.log('========================================================\n');

  // STEP 1: Delete Old Users from Firebase Authentication
  console.log('--- Step 1: Deleting Old User Accounts from Firebase Auth ---');
  for (const email of OLD_EMAILS_CANDIDATES) {
    if (OFFICIAL_DEMO_EMAILS.has(email.toLowerCase())) {
      console.log(`[SKIP DEMO] Preserving official account: ${email}`);
      continue;
    }

    let deleted = false;
    for (const pwd of PASSWORDS_TO_TRY) {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, pwd);
        const uid = cred.user.uid;
        await deleteUser(cred.user);
        console.log(`  ✓ DELETED from Auth: ${email} (UID: ${uid})`);
        deleted = true;
        break;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          // May not exist with this password or at all
        }
      }
    }
    if (!deleted) {
      console.log(`  - Note: ${email} already not present in Auth or non-standard password`);
    }
  }

  // STEP 2: Authenticate as Demo Admin to delete Firestore records
  console.log('\n--- Step 2: Authenticating as Admin for Firestore Purge ---');
  const adminCred = await signInWithEmailAndPassword(auth, 'admin.onboarding@mahasetu.gov.in', DEMO_PASSWORD);
  console.log(`  ✓ Authenticated as Administrator: Anil Shinde (${adminCred.user.uid})\n`);

  // STEP 3: Purge Old Users from `users` Collection
  console.log('--- Step 3: Purging Old Records from users Collection ---');
  const usersSnap = await getDocs(collection(db, 'users'));
  let deletedUsersCount = 0;

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const email = (data.email || '').toLowerCase().trim();

    if (OFFICIAL_DEMO_EMAILS.has(email)) {
      console.log(`  ✓ PRESERVED Demo User: ${data.name} (${email}) [${userDoc.id}]`);
    } else {
      try {
        await deleteDoc(doc(db, 'users', userDoc.id));
        console.log(`  🗑️ DELETED User Document: ${data.name || '<no-name>'} (${email || '<no-email>'}) [${userDoc.id}]`);
        deletedUsersCount++;
      } catch (delErr: any) {
        console.error(`  ❌ Failed to delete user ${userDoc.id}:`, delErr.message);
      }
    }
  }
  console.log(`Total old user documents deleted: ${deletedUsersCount}\n`);

  // STEP 4: Purge Old Applications
  console.log('--- Step 4: Purging Applications from Old Users ---');
  const appsSnap = await getDocs(collection(db, 'applications'));
  let deletedAppsCount = 0;

  for (const appDoc of appsSnap.docs) {
    const data = appDoc.data();
    const citizenEmail = (data.citizenEmail || data.email || '').toLowerCase().trim();
    const citizenName = (data.citizenName || '').toLowerCase().trim();

    // If application was submitted by old users, delete it
    const isOfficial = OFFICIAL_DEMO_EMAILS.has(citizenEmail) && OFFICIAL_DEMO_NAMES.has(citizenName);
    if (!isOfficial) {
      try {
        await deleteDoc(doc(db, 'applications', appDoc.id));
        console.log(`  🗑️ DELETED Old Application: [${appDoc.id}] ${data.citizenName} (${citizenEmail}) - ${data.serviceId}`);
        deletedAppsCount++;
      } catch (appErr: any) {
        console.error(`  ❌ Failed to delete application ${appDoc.id}:`, appErr.message);
      }
    } else {
      console.log(`  ✓ PRESERVED Demo Application: [${appDoc.id}] ${data.citizenName}`);
    }
  }
  console.log(`Total old applications deleted: ${deletedAppsCount}\n`);

  // STEP 5: Purge Old Resident Profiles
  console.log('--- Step 5: Purging Old Resident Profiles ---');
  const profilesSnap = await getDocs(collection(db, 'residentProfiles'));
  let deletedProfilesCount = 0;

  for (const profDoc of profilesSnap.docs) {
    const data = profDoc.data();
    const email = (data.email || '').toLowerCase().trim();

    if (!OFFICIAL_DEMO_EMAILS.has(email)) {
      try {
        await deleteDoc(doc(db, 'residentProfiles', profDoc.id));
        console.log(`  🗑️ DELETED Resident Profile: [${profDoc.id}]`);
        deletedProfilesCount++;
      } catch (profErr: any) {
        console.error(`  ❌ Failed to delete profile ${profDoc.id}:`, profErr.message);
      }
    } else {
      console.log(`  ✓ PRESERVED Demo Resident Profile: [${profDoc.id}]`);
    }
  }
  console.log(`Total old resident profiles deleted: ${deletedProfilesCount}\n`);

  // STEP 6: Clean Up Verification Records referencing old verifier names
  console.log('--- Step 6: Scrubbing Real Names from applicationVerifications ---');
  const verifsSnap = await getDocs(collection(db, 'applicationVerifications'));

  const verifierLogins: Record<string, { email: string; demoName: string }> = {
    DEPARTMENT_A: { email: 'officer.dept_a@mahasetu.gov.in', demoName: 'Ramesh Kumar' },
    DEPARTMENT_B: { email: 'officer.dept_b@mahasetu.gov.in', demoName: 'Suresh Joshi' },
    DEPARTMENT_C: { email: 'officer.dept_c@mahasetu.gov.in', demoName: 'Mahesh Deshmukh' },
    ADMIN: { email: 'admin.onboarding@mahasetu.gov.in', demoName: 'Anil Shinde' },
    AUDITOR: { email: 'auditor.compliance@mahasetu.gov.in', demoName: 'Neha Deshpande' },
  };

  let scrubbedCount = 0;

  for (const [key, verifier] of Object.entries(verifierLogins)) {
    try {
      const vCred = await signInWithEmailAndPassword(auth, verifier.email, DEMO_PASSWORD);
      const matchingDocs = verifsSnap.docs.filter((d) => {
        const data = d.data();
        const role = data.verifierKey || data.verifierRole;
        return role === key || (key === 'DEPARTMENT_A' && (role === 'DEPT_A' || role === 'DEPARTMENT_A'))
          || (key === 'DEPARTMENT_B' && (role === 'DEPT_B' || role === 'DEPARTMENT_B'))
          || (key === 'DEPARTMENT_C' && (role === 'DEPT_C' || role === 'DEPARTMENT_C'));
      });

      for (const vDoc of matchingDocs) {
        const data = vDoc.data();
        if (data.verifierName !== verifier.demoName) {
          try {
            await updateDoc(doc(db, 'applicationVerifications', vDoc.id), {
              verifierName: verifier.demoName,
              verifierId: vCred.user.uid,
              verifierUserId: vCred.user.uid,
              updatedAt: new Date(),
            });
            console.log(`  ✓ Scrubbed verification [${vDoc.id}]: verifierName updated to "${verifier.demoName}"`);
            scrubbedCount++;
          } catch (updateErr: any) {
            console.warn(`  ⚠️ Could not update ${vDoc.id}:`, updateErr.message);
          }
        }
      }
    } catch (authErr: any) {
      console.warn(`  ⚠️ Could not sign in as ${verifier.email}:`, authErr.message);
    }
  }
  console.log(`Total verification records scrubbed: ${scrubbedCount}\n`);

  console.log('========================================================');
  console.log('   DATABASE PURGE SUCCESSFULLY COMPLETED!              ');
  console.log('========================================================');
  process.exit(0);
}

purgeOldUserData().catch((err) => {
  console.error('Purge error:', err);
  process.exit(1);
});
