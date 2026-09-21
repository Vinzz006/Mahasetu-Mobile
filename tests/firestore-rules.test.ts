import { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-mahasetu-rules-test';

describe('Firestore Security Rules Unit Tests', () => {
  let testEnv: RulesTestEnvironment;

  before(async () => {
    const rulesPath = path.resolve(__dirname, '../firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();

      // Seed initial data using admin context (bypasses rules)
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        // Seed users
        await setDoc(doc(db, 'users', 'citizen_alice'), {
          uid: 'citizen_alice',
          email: 'alice@example.com',
          role: 'CITIZEN',
          status: 'APPROVED',
          isActive: true,
        });
        await setDoc(doc(db, 'users', 'citizen_bob'), {
          uid: 'citizen_bob',
          email: 'bob@example.com',
          role: 'CITIZEN',
          status: 'APPROVED',
          isActive: true,
        });

        // Seed applications
        await setDoc(doc(db, 'applications', 'app_alice'), {
          id: 'app_alice',
          citizenId: 'citizen_alice',
          citizenUid: 'citizen_alice',
          status: 'UNDER_VERIFICATION',
        });
        await setDoc(doc(db, 'applications', 'app_bob'), {
          id: 'app_bob',
          citizenId: 'citizen_bob',
          citizenUid: 'citizen_bob',
          status: 'UNDER_VERIFICATION',
        });

        // Seed resident profiles
        await setDoc(doc(db, 'residentProfiles', 'citizen_alice'), {
          userId: 'citizen_alice',
          profileType: 'RESIDENT',
          certificationStatus: 'PENDING',
        });
      });
    }
  });

  it('1. Citizen cannot read another citizen user document', async () => {
    const aliceDb = testEnv
      .authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true })
      .firestore();

    // Alice reads own profile -> allowed
    await assertSucceeds(getDoc(doc(aliceDb, 'users', 'citizen_alice')));

    // Alice reads Bob profile -> denied
    await assertFails(getDoc(doc(aliceDb, 'users', 'citizen_bob')));
  });

  it('2. Citizen cannot read another citizen application', async () => {
    const aliceDb = testEnv
      .authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true })
      .firestore();

    // Alice reads own app -> allowed
    await assertSucceeds(getDoc(doc(aliceDb, 'applications', 'app_alice')));

    // Alice reads Bob app -> denied
    await assertFails(getDoc(doc(aliceDb, 'applications', 'app_bob')));
  });

  it('3. Citizen cannot create an application directly (must go through backend Admin SDK)', async () => {
    const aliceDb = testEnv
      .authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true })
      .firestore();

    // Attempt to directly create a pre-verified application
    await assertFails(
      setDoc(doc(aliceDb, 'applications', 'app_forged'), {
        id: 'app_forged',
        citizenId: 'citizen_alice',
        citizenUid: 'citizen_alice',
        status: 'APPLICATION_VERIFIED',
        verificationSummary: { isFullyVerified: true, verifiedCount: 5 },
      })
    );
  });

  it('4. Citizen cannot self-certify on residentProfile (forbidden certificationStatus)', async () => {
    const aliceDb = testEnv
      .authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true })
      .firestore();

    // Attempt to self-certify
    await assertFails(
      updateDoc(doc(aliceDb, 'residentProfiles', 'citizen_alice'), {
        certificationStatus: 'VERIFIED',
        certifiedBy: 'self',
        certifiedAt: new Date().toISOString(),
      })
    );
  });

  it('5. Officer cannot modify application verifications directly (backend-only write)', async () => {
    const officerDeptADb = testEnv
      .authenticatedContext('officer_dept_a', {
        role: 'DEPARTMENT_A',
        departmentId: 'DEPT_A',
        status: 'APPROVED',
        email_verified: true,
      })
      .firestore();

    // Attempt to write verification slot directly
    await assertFails(
      setDoc(doc(officerDeptADb, 'applicationVerifications', 'app_alice_department_a'), {
        id: 'app_alice_department_a',
        status: 'VERIFIED',
        verifierRole: 'DEPARTMENT_A',
      })
    );
  });

  it('6. Fake admin@mahasetu.gov.in account without custom claim gets zero admin rights', async () => {
    // Attacker registered with admin email, but lacks custom claims
    const fakeAdminDb = testEnv
      .authenticatedContext('fake_admin_uid', {
        email: 'admin@mahasetu.gov.in',
        email_verified: true,
        // No role: 'ADMIN' claim!
      })
      .firestore();

    // Cannot read other citizen user doc
    await assertFails(getDoc(doc(fakeAdminDb, 'users', 'citizen_alice')));

    // Cannot read other citizen application
    await assertFails(getDoc(doc(fakeAdminDb, 'applications', 'app_alice')));
  });

  it('7. Audit logs cannot be forged with a different actorUid', async () => {
    const aliceDb = testEnv
      .authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true })
      .firestore();

    // Attempt to create audit log impersonating citizen_bob
    await assertFails(
      addDoc(collection(aliceDb, 'auditLogs'), {
        actorUid: 'citizen_bob',
        actorRole: 'CITIZEN',
        action: 'MALICIOUS_ACTION',
        timestamp: new Date().toISOString(),
      })
    );

    // Legitimate audit log with own actorUid succeeds
    await assertSucceeds(
      addDoc(collection(aliceDb, 'auditLogs'), {
        actorUid: 'citizen_alice',
        actorRole: 'CITIZEN',
        action: 'CITIZEN_LOGIN',
        timestamp: new Date().toISOString(),
      })
    );
  });
});
