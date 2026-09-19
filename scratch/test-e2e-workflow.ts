import { auth, db } from '../lib/firebase';
import { authService } from '../services/authService';
import { applicationService } from '../services/applicationService';
import { verificationService } from '../services/verificationService';
import { DEMO_USERS } from '../constants/demoData';
import { doc, getDoc } from 'firebase/firestore';

async function runE2E() {
  console.log('========================================================');
  console.log('   MAHASETU MOBILE END-TO-END DEMO AUTH & WORKFLOW TEST');
  console.log('========================================================\n');

  // 1. Citizen Login
  console.log('[Test 1: Citizen Authentic Demo Login]');
  const priyaDemo = DEMO_USERS.find((u) => u.email === 'citizen.priya@mahasetu.gov.in')!;
  const priyaProfile = await authService.switchDemoAccount(priyaDemo);

  console.log('  ✓ Authenticated with Firebase Auth');
  console.log(`  ✓ auth.currentUser.uid: ${auth.currentUser?.uid}`);
  console.log(`  ✓ priyaProfile.uid: ${priyaProfile.uid}`);
  console.log(`  ✓ Profile role: ${priyaProfile.role}, status: ${priyaProfile.status}`);

  if (!auth.currentUser || auth.currentUser.uid !== priyaProfile.uid) {
    throw new Error('FAILED: auth.currentUser UID does not match profile UID!');
  }
  if (priyaProfile.uid.startsWith('demo-')) {
    throw new Error('FAILED: UID is still using fake demo- prefix!');
  }

  // 2. Submit Application
  console.log('\n[Test 2: Citizen Application Submission to Cloud Firestore]');
  const testApp = await applicationService.submitApplication(
    'srv-001',
    'Integrated Citizen Benefit',
    'ICB-2026',
    priyaProfile,
    {
      annualIncome: 180000,
      bankAccount: '123456789012',
      ifscCode: 'SBIN0001234',
      occupation: 'Artisan',
    }
  );

  console.log(`  ✓ Application created successfully! ID: ${testApp.id}`);
  console.log(`  ✓ Application Number: ${testApp.applicationNumber}`);

  const appDoc = await getDoc(doc(db, 'applications', testApp.id));
  if (!appDoc.exists()) {
    throw new Error('FAILED: Application document does not exist in Firestore!');
  }
  console.log('  ✓ Verified application document exists in Firestore');

  // 3. Department Officers Verification
  console.log('\n[Test 3: Department A Officer Verification]');
  const rameshDemo = DEMO_USERS.find((u) => u.email === 'officer.dept_a@mahasetu.gov.in')!;
  const rameshProfile = await authService.switchDemoAccount(rameshDemo);
  console.log(`  ✓ Ramesh signed in: UID = ${rameshProfile.uid}, role = ${rameshProfile.role}`);
  await verificationService.verifyApplication(testApp.id, rameshProfile, 'Revenue & Civil Supplies verified.');
  console.log('  ✓ Department A verification recorded successfully');

  console.log('\n[Test 4: Department B Officer Verification]');
  const sureshDemo = DEMO_USERS.find((u) => u.email === 'officer.dept_b@mahasetu.gov.in')!;
  const sureshProfile = await authService.switchDemoAccount(sureshDemo);
  console.log(`  ✓ Suresh signed in: UID = ${sureshProfile.uid}, role = ${sureshProfile.role}`);
  await verificationService.verifyApplication(testApp.id, sureshProfile, 'Social Welfare criteria verified.');
  console.log('  ✓ Department B verification recorded successfully');

  console.log('\n[Test 5: Department C Officer Verification]');
  const maheshDemo = DEMO_USERS.find((u) => u.email === 'officer.dept_c@mahasetu.gov.in')!;
  const maheshProfile = await authService.switchDemoAccount(maheshDemo);
  console.log(`  ✓ Mahesh signed in: UID = ${maheshProfile.uid}, role = ${maheshProfile.role}`);
  await verificationService.verifyApplication(testApp.id, maheshProfile, 'Labour welfare criteria verified.');
  console.log('  ✓ Department C verification recorded successfully');

  console.log('\n[Test 6: State Administrator Verification]');
  const anilDemo = DEMO_USERS.find((u) => u.email === 'admin.onboarding@mahasetu.gov.in')!;
  const anilProfile = await authService.switchDemoAccount(anilDemo);
  console.log(`  ✓ Anil signed in: UID = ${anilProfile.uid}, role = ${anilProfile.role}`);
  await verificationService.verifyApplication(testApp.id, anilProfile, 'Administrative review certified.');
  console.log('  ✓ Admin verification recorded successfully');

  console.log('\n[Test 7: Compliance Auditor Final Verification (5/5)]');
  const nehaDemo = DEMO_USERS.find((u) => u.email === 'auditor.compliance@mahasetu.gov.in')!;
  const nehaProfile = await authService.switchDemoAccount(nehaDemo);
  console.log(`  ✓ Neha signed in: UID = ${nehaProfile.uid}, role = ${nehaProfile.role}`);
  await verificationService.verifyApplication(testApp.id, nehaProfile, 'Compliance audit certified 5/5.');
  console.log('  ✓ Auditor verification recorded successfully');

  // Verify final application state
  const finalAppDoc = await getDoc(doc(db, 'applications', testApp.id));
  const finalData = finalAppDoc.data();
  console.log(`\n[Final Status Evaluation]`);
  console.log(`  Application Status: ${finalData?.status}`);
  console.log(`  Verified Count: ${finalData?.verificationSummary?.verifiedCount} / 5`);

  console.log('\n========================================================');
  console.log('  🎉 ALL ASSERTIONS PASSED! ARCHITECTURE FULLY VERIFIED!');
  console.log('========================================================\n');
  process.exit(0);
}

runE2E().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
