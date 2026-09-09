import * as dotenv from 'dotenv';
dotenv.config();
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { applicationService } from '../services/applicationService';
import { consentService } from '../services/consentService';
import { DEMO_PASSWORD } from '../constants/demoData';
import { UserProfile } from '../types';

async function testListeners() {
  console.log('Testing realtime listeners with UPPERCASE role...');
  const userA = await signInWithEmailAndPassword(auth, 'anusha@mahasetu.gov.in', DEMO_PASSWORD);

  const mockProfile: UserProfile = {
    uid: userA.user.uid,
    email: 'anusha@mahasetu.gov.in',
    name: 'Anusha G.',
    role: 'CITIZEN', // Uppercase!
    status: 'APPROVED',
    departmentId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let appsPassed = false;
  let consentsPassed = false;

  await new Promise<void>((resolve, reject) => {
    const unsubApps = applicationService.subscribeToApplications(mockProfile, (apps) => {
      console.log('Applications listener received apps count:', apps.length);
      appsPassed = true;
      if (consentsPassed) resolve();
    });

    const unsubConsents = consentService.subscribeToConsents(mockProfile, (consents) => {
      console.log('Consents listener received consents count:', consents.length);
      consentsPassed = true;
      if (appsPassed) resolve();
    });

    setTimeout(() => {
      unsubApps();
      unsubConsents();
      if (appsPassed && consentsPassed) {
        resolve();
      } else {
        reject(new Error('Timed out waiting for listeners'));
      }
    }, 4000);
  });

  console.log('SUCCESS: Both Applications and Consents listeners worked with zero permission errors!');
}

testListeners().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
