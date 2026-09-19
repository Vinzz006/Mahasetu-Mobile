import { authService } from '../services/authService';
import { auth, db } from '../lib/firebase';
import { DEMO_USERS, DEMO_PASSWORD } from '../constants/demoData';
import { applicationService } from '../services/applicationService';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';

async function runLiveEmailAuthTests() {
  console.log('========================================================');
  console.log('   MAHASETU MOBILE — LIVE EMAIL/PASSWORD AUTH TESTS');
  console.log('========================================================\n');

  // 1. DEMO USER SIGN IN WITH AUTHENTIC FIREBASE AUTH
  console.log('[1/5] Testing Demo Account Sign In via Firebase Auth...');
  const priyaDemo = DEMO_USERS.find((u) => u.id === 'demo-priya');
  if (!priyaDemo) throw new Error('Priya demo user not found in constants');

  const priyaProfile = await authService.switchDemoAccount(priyaDemo);
  console.log('  ✓ Demo authenticated successfully:');
  console.log(`    - UID: ${priyaProfile.uid}`);
  console.log(`    - Role: ${priyaProfile.role}`);
  console.log(`    - Status: ${priyaProfile.status}`);
  console.log(`    - auth.currentUser.uid: ${auth.currentUser?.uid}`);

  if (auth.currentUser?.uid !== priyaProfile.uid) {
    throw new Error('auth.currentUser does not match profile UID!');
  }

  // 2. VERIFY FIRESTORE WRITE WITH AUTHENTICATED DEMO USER
  console.log('\n[2/5] Testing Authenticated Application Submission (No permission-denied)...');
  const submission = await applicationService.submitApplication(
    'SCHEME_SCHOLARSHIP_01',
    'National Merit Scholarship Scheme 2026',
    'SCHOLARSHIP_01',
    priyaProfile,
    { annualIncome: 120000, category: 'GENERAL' }
  );

  console.log('  ✓ Application submitted to Firestore:');
  console.log(`    - Application ID: ${submission.id}`);
  console.log(`    - Application Number: ${submission.applicationNumber}`);
  console.log(`    - Status: ${submission.status}`);

  // 3. TEST USER REGISTRATION WITH EMAIL/PASSWORD
  console.log('\n[3/5] Testing New User Registration via Email/Password...');
  const testEmail = `test.applicant.${Date.now()}@example.com`;
  const testPassword = 'SecurePassword2026!';
  const testName = 'Test Registration Candidate';

  const newProfile = await authService.signUpWithEmail(testEmail, testPassword, testName);
  console.log('  ✓ Registered new user:');
  console.log(`    - UID: ${newProfile.uid}`);
  console.log(`    - Role: ${newProfile.role} (Expected: null)`);
  console.log(`    - Status: ${newProfile.status} (Expected: PENDING)`);
  console.log(`    - isActive: ${newProfile.isActive} (Expected: false)`);

  if (newProfile.role !== null || newProfile.status !== 'PENDING') {
    throw new Error(`Invalid new user state: role=${newProfile.role}, status=${newProfile.status}`);
  }

  // Verify record in Firestore
  const userDocRef = doc(db, 'users', newProfile.uid);
  const docSnap = await getDoc(userDocRef);
  if (!docSnap.exists()) {
    throw new Error('User document was not created in Firestore!');
  }
  console.log('  ✓ Firestore users/{uid} document confirmed present.');

  // 4. TEST SIGN OUT AND SIGN IN WITH EMAIL/PASSWORD
  console.log('\n[4/5] Testing Sign Out & Sign In with Email/Password...');
  await authService.logout();
  console.log(`  ✓ Signed out. auth.currentUser: ${auth.currentUser}`);

  const signedInProfile = await authService.signInWithEmail(testEmail, testPassword);
  console.log('  ✓ Signed in successfully with email/password:');
  console.log(`    - UID: ${signedInProfile.uid}`);
  console.log(`    - Status: ${signedInProfile.status}`);

  // 5. TEST AUTH ERROR MAPPING
  console.log('\n[5/5] Testing Auth Error Handling & Mapping...');
  let errorCaught = false;
  try {
    await authService.signInWithEmail(testEmail, 'WrongPassword123!');
  } catch (err: any) {
    errorCaught = true;
    const friendly = authService.mapAuthError(err);
    console.log(`  ✓ Correctly caught authentication error: "${err.code}"`);
    console.log(`  ✓ Friendly UI message: "${friendly}"`);
  }

  if (!errorCaught) {
    throw new Error('Expected invalid password error was not caught!');
  }

  // Cleanup test user document
  try {
    await deleteDoc(userDocRef);
    console.log('\n  ✓ Cleaned up test user document from Firestore.');
  } catch (cleanErr) {
    console.warn('  Note: could not delete test user doc:', cleanErr);
  }

  console.log('\n========================================================');
  console.log('   ALL 5 LIVE EMAIL/PASSWORD TESTS PASSED SUCCESSFULLY! ');
  console.log('========================================================');
}

runLiveEmailAuthTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });
