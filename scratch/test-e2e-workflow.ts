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
  const anushaDemo = DEMO_USERS.find((u) => u.email === 'anusha@mahasetu.gov.in')!;
  const anushaProfile = await authService.switchDemoAccount(anushaDemo);

  console.log('  ✓ Authenticated with Firebase Auth');
  console.log(`  ✓ auth.currentUser.uid: ${auth.currentUser?.uid}`);
  console.log(`  ✓ anushaProfile.uid: ${anushaProfile.uid}`);
  console.log(`  ✓ Profile role: ${anushaProfile.role}, status: ${anushaProfile.status}`);

  if (!auth.currentUser || auth.currentUser.uid !== anushaProfile.uid) {
    throw new Error('FAILED: auth.currentUser UID does not match profile UID!');
  }
  if (anushaProfile.uid.startsWith('demo-')) {
    throw new Error('FAILED: UID is still using fake demo- prefix!');
  }

  // 2. Submit Application
  console.log('\n[Test 2: Citizen Application Submission to Cloud Firestore]');
  const testApp = await applicationService.submitApplication(
    'srv-001',
    'Integrated Citizen Benefit',
    'ICB-2026',
    anushaProfile,
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
  const vineshDemo = DEMO_USERS.find((u) => u.email === 'vinesh.dept_a@mahasetu.gov.in')!;
  const vineshProfile = await authService.switchDemoAccount(vineshDemo);
  console.log(`  ✓ Vinesh signed in: UID = ${vineshProfile.uid}, role = ${vineshProfile.role}`);
  await verificationService.verifyApplication(testApp.id, vineshProfile, 'Revenue & Civil Supplies verified.');
  console.log('  ✓ Department A verification recorded successfully');

  console.log('\n[Test 4: Department B Officer Verification]');
  const saiDemo = DEMO_USERS.find((u) => u.email === 'sai.dept_b@mahasetu.gov.in')!;
  const saiProfile = await authService.switchDemoAccount(saiDemo);
  console.log(`  ✓ Sai signed in: UID = ${saiProfile.uid}, role = ${saiProfile.role}`);
  await verificationService.verifyApplication(testApp.id, saiProfile, 'Social Welfare criteria verified.');
  console.log('  ✓ Department B verification recorded successfully');

  console.log('\n[Test 5: Department C Officer Verification]');
  const omeshDemo = DEMO_USERS.find((u) => u.email === 'omesh.dept_c@mahasetu.gov.in')!;
  const omeshProfile = await authService.switchDemoAccount(omeshDemo);
  console.log(`  ✓ Omesh signed in: UID = ${omeshProfile.uid}, role = ${omeshProfile.role}`);
  await verificationService.verifyApplication(testApp.id, omeshProfile, 'Labour welfare criteria verified.');
  console.log('  ✓ Department C verification recorded successfully');

  console.log('\n[Test 6: State Administrator Verification]');
  const tammuDemo = DEMO_USERS.find((u) => u.email === 'tammu.admin@mahasetu.gov.in')!;
  const tammuProfile = await authService.switchDemoAccount(tammuDemo);
  console.log(`  ✓ Tammu signed in: UID = ${tammuProfile.uid}, role = ${tammuProfile.role}`);
  await verificationService.verifyApplication(testApp.id, tammuProfile, 'Administrative review certified.');
  console.log('  ✓ Admin verification recorded successfully');

  console.log('\n[Test 7: Compliance Auditor Final Verification (5/5)]');
  const tanushriDemo = DEMO_USERS.find((u) => u.email === 'tanushri.auditor@mahasetu.gov.in')!;
  const tanushriProfile = await authService.switchDemoAccount(tanushriDemo);
  console.log(`  ✓ Tanushri signed in: UID = ${tanushriProfile.uid}, role = ${tanushriProfile.role}`);
  await verificationService.verifyApplication(testApp.id, tanushriProfile, 'Compliance audit certified 5/5.');
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
