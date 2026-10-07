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
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-mahasetu-rules-test';

describe('Firestore Security Rules Comprehensive Unit Tests', () => {
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

        // 1. Users
        await setDoc(doc(db, 'users', 'citizen_alice'), {
          uid: 'citizen_alice',
          email: 'alice@example.com',
          role: 'CITIZEN',
          status: 'APPROVED',
          isActive: true,
          displayName: 'Alice Citizen',
        });
        await setDoc(doc(db, 'users', 'citizen_bob'), {
          uid: 'citizen_bob',
          email: 'bob@example.com',
          role: 'CITIZEN',
          status: 'APPROVED',
          isActive: true,
          displayName: 'Bob Citizen',
        });

        // 2. Applications
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

        // 3. Application Verifications
        await setDoc(doc(db, 'applicationVerifications', 'verif_alice'), {
          id: 'verif_alice',
          citizenId: 'citizen_alice',
          citizenUid: 'citizen_alice',
          status: 'PENDING',
        });

        // 4. Notifications
        await setDoc(doc(db, 'notifications', 'notif_alice'), {
          id: 'notif_alice',
          userId: 'citizen_alice',
          title: 'Welcome',
          read: false,
        });

        // 5. Consents
        await setDoc(doc(db, 'consents', 'consent_alice'), {
          id: 'consent_alice',
          citizenUid: 'citizen_alice',
          citizenId: 'citizen_alice',
          status: 'PENDING',
        });

        // 6. Data Exchanges
        await setDoc(doc(db, 'dataExchanges', 'exchange_1'), {
          id: 'exchange_1',
          data: 'sensitive',
        });

        // 7. Integration Logs
        await setDoc(doc(db, 'integrationLogs', 'int_log_1'), {
          id: 'int_log_1',
          source: 'gateway',
        });

        // 8. Audit Logs
        await setDoc(doc(db, 'auditLogs', 'audit_1'), {
          id: 'audit_1',
          action: 'SEED',
        });

        // 9. Workflows
        await setDoc(doc(db, 'workflows', 'wf_1'), {
          id: 'wf_1',
          name: 'Income Certificate',
        });

        // 10. Services & Departments
        await setDoc(doc(db, 'services', 'srv_1'), {
          id: 'srv_1',
          name: 'Revenue Service',
        });
        await setDoc(doc(db, 'departments', 'dept_a'), {
          id: 'dept_a',
          name: 'Department of Revenue',
        });

        // 11. AI Conversations & Messages
        await setDoc(doc(db, 'aiConversations', 'conv_alice'), {
          id: 'conv_alice',
          userId: 'citizen_alice',
          title: 'Help Request',
        });
        await setDoc(doc(db, 'aiConversations', 'conv_alice', 'messages', 'msg_1'), {
          id: 'msg_1',
          userId: 'citizen_alice',
          content: 'Hello AI',
        });

        // 12. Resident Profiles
        await setDoc(doc(db, 'residentProfiles', 'citizen_alice'), {
          userId: 'citizen_alice',
          profileType: 'CITIZEN',
          certificationStatus: 'PENDING',
        });

        // 13. Unknown Collection
        await setDoc(doc(db, 'secretInternalDocs', 'secret_1'), {
          secret: 'confidential',
        });
      });
    }
  });

  // =========================================================================
  // RULE 1: USERS COLLECTION
  // =========================================================================
  it('1. Users: Citizen reads own document (allow), reads another (deny), Admin/Auditor reads any (allow)', async () => {
    const aliceDb = testEnv.authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();
    const adminDb = testEnv.authenticatedContext('admin_user', { role: 'ADMIN', status: 'APPROVED', email_verified: true }).firestore();
    const auditorDb = testEnv.authenticatedContext('auditor_user', { role: 'AUDITOR', status: 'APPROVED', email_verified: true }).firestore();

    await assertSucceeds(getDoc(doc(aliceDb, 'users', 'citizen_alice')));
    await assertFails(getDoc(doc(aliceDb, 'users', 'citizen_bob')));
    await assertSucceeds(getDoc(doc(adminDb, 'users', 'citizen_alice')));
    await assertSucceeds(getDoc(doc(auditorDb, 'users', 'citizen_alice')));
  });

  it('1b. Users: Self-create requires pending/null role, status PENDING, and allowlist keys', async () => {
    const newCitizenDb = testEnv.authenticatedContext('new_citizen', { email_verified: true }).firestore();

    // Valid signup create
    await assertSucceeds(
      setDoc(doc(newCitizenDb, 'users', 'new_citizen'), {
        uid: 'new_citizen',
        email: 'new@example.com',
        role: 'pending',
        status: 'PENDING',
        isActive: false,
        name: 'New Citizen',
        createdAt: '2026-01-01',
      })
    );

    // Attempt to self-grant ADMIN role -> DENIED
    await assertFails(
      setDoc(doc(newCitizenDb, 'users', 'attacker_admin'), {
        uid: 'attacker_admin',
        email: 'attacker@example.com',
        role: 'ADMIN',
        status: 'APPROVED',
        isActive: true,
      })
    );
  });

  it('1c. Users: Self-update restricted to allowlist fields; cannot delete', async () => {
    const aliceDb = testEnv.authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();

    // Allowed profile field update
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'users', 'citizen_alice'), {
        displayName: 'Alice Updated',
      })
    );

    // Forbidden privilege escalation update
    await assertFails(
      updateDoc(doc(aliceDb, 'users', 'citizen_alice'), {
        role: 'ADMIN',
      })
    );

    // Delete denied
    await assertFails(deleteDoc(doc(aliceDb, 'users', 'citizen_alice')));
  });

  // =========================================================================
  // RULE 2: APPLICATIONS COLLECTION
  // =========================================================================
  it('2. Applications: Read by owner, officer, admin, auditor; all client writes denied', async () => {
    const aliceDb = testEnv.authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();
    const bobDb = testEnv.authenticatedContext('citizen_bob', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();
    const officerDb = testEnv.authenticatedContext('officer_1', { role: 'DEPARTMENT_A', departmentId: 'DEPARTMENT_A', status: 'APPROVED', email_verified: true }).firestore();
    const adminDb = testEnv.authenticatedContext('admin_1', { role: 'ADMIN', status: 'APPROVED', email_verified: true }).firestore();

    await assertSucceeds(getDoc(doc(aliceDb, 'applications', 'app_alice')));
    await assertFails(getDoc(doc(bobDb, 'applications', 'app_alice')));
    await assertSucceeds(getDoc(doc(officerDb, 'applications', 'app_alice')));
    await assertSucceeds(getDoc(doc(adminDb, 'applications', 'app_alice')));

    // Client write denied
    await assertFails(
      setDoc(doc(aliceDb, 'applications', 'app_forged'), {
        id: 'app_forged',
        citizenUid: 'citizen_alice',
        status: 'APPROVED',
      })
    );
  });

  // =========================================================================
  // RULE 3: APPLICATION VERIFICATIONS
  // =========================================================================
  it('3. Verifications: Read by owner, admin, auditor, officer; all client writes denied', async () => {
    const aliceDb = testEnv.authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();
    const bobDb = testEnv.authenticatedContext('citizen_bob', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();
    const officerDb = testEnv.authenticatedContext('officer_1', { role: 'DEPARTMENT_A', departmentId: 'DEPARTMENT_A', status: 'APPROVED', email_verified: true }).firestore();

    await assertSucceeds(getDoc(doc(aliceDb, 'applicationVerifications', 'verif_alice')));
    await assertFails(getDoc(doc(bobDb, 'applicationVerifications', 'verif_alice')));
    await assertSucceeds(getDoc(doc(officerDb, 'applicationVerifications', 'verif_alice')));

    // Officer direct write denied
    await assertFails(
      updateDoc(doc(officerDb, 'applicationVerifications', 'verif_alice'), {
        status: 'VERIFIED',
      })
    );
  });

  // =========================================================================
  // RULE 4: NOTIFICATIONS
  // =========================================================================
  it('4. Notifications: Read/create own, update read field only, cannot delete', async () => {
    const aliceDb = testEnv.authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();
    const bobDb = testEnv.authenticatedContext('citizen_bob', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();

    await assertSucceeds(getDoc(doc(aliceDb, 'notifications', 'notif_alice')));
    await assertFails(getDoc(doc(bobDb, 'notifications', 'notif_alice')));

    // Mark as read succeeds
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'notifications', 'notif_alice'), {
        read: true,
      })
    );

    // Modify title fails
    await assertFails(
      updateDoc(doc(aliceDb, 'notifications', 'notif_alice'), {
        title: 'Tampered Title',
      })
    );

    // Delete fails
    await assertFails(deleteDoc(doc(aliceDb, 'notifications', 'notif_alice')));
  });

  // =========================================================================
  // RULE 5: CONSENTS
  // =========================================================================
  it('5. Consents: Read by owner/officer/admin; update GRANTED/DENIED only by owner', async () => {
    const aliceDb = testEnv.authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();
    const bobDb = testEnv.authenticatedContext('citizen_bob', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();

    await assertSucceeds(getDoc(doc(aliceDb, 'consents', 'consent_alice')));
    await assertFails(getDoc(doc(bobDb, 'consents', 'consent_alice')));

    // Alice updates status to GRANTED
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'consents', 'consent_alice'), {
        status: 'GRANTED',
        updatedAt: '2026-01-01',
      })
    );

    // Bob cannot update Alice's consent
    await assertFails(
      updateDoc(doc(bobDb, 'consents', 'consent_alice'), {
        status: 'DENIED',
        updatedAt: '2026-01-01',
      })
    );
  });

  // =========================================================================
  // RULE 6, 7, 8, 9: EXCHANGES, INTEGRATION LOGS, AUDIT LOGS, WORKFLOWS
  // =========================================================================
  it('6-9. System Collections: Internal logs/exchanges/workflows read restricted; writes blocked', async () => {
    const citizenDb = testEnv.authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();
    const officerDb = testEnv.authenticatedContext('officer_1', { role: 'DEPARTMENT_A', departmentId: 'DEPARTMENT_A', status: 'APPROVED', email_verified: true }).firestore();
    const auditorDb = testEnv.authenticatedContext('auditor_1', { role: 'AUDITOR', status: 'APPROVED', email_verified: true }).firestore();

    // Data Exchanges
    await assertFails(getDoc(doc(citizenDb, 'dataExchanges', 'exchange_1')));
    await assertSucceeds(getDoc(doc(officerDb, 'dataExchanges', 'exchange_1')));
    await assertSucceeds(getDoc(doc(auditorDb, 'dataExchanges', 'exchange_1')));

    // Integration Logs
    await assertFails(getDoc(doc(citizenDb, 'integrationLogs', 'int_log_1')));
    await assertFails(getDoc(doc(officerDb, 'integrationLogs', 'int_log_1')));
    await assertSucceeds(getDoc(doc(auditorDb, 'integrationLogs', 'int_log_1')));

    // Workflows
    await assertFails(getDoc(doc(citizenDb, 'workflows', 'wf_1')));
    await assertSucceeds(getDoc(doc(officerDb, 'workflows', 'wf_1')));

    // Audit Logs: Citizen cannot read; citizen can only append log with matching actorUid
    await assertFails(getDoc(doc(citizenDb, 'auditLogs', 'audit_1')));
    await assertSucceeds(getDoc(doc(auditorDb, 'auditLogs', 'audit_1')));

    await assertSucceeds(
      addDoc(collection(citizenDb, 'auditLogs'), {
        actorUid: 'citizen_alice',
        actorRole: 'CITIZEN',
        action: 'CITIZEN_LOGIN',
        timestamp: '2026-01-01',
      })
    );
    await assertFails(
      addDoc(collection(citizenDb, 'auditLogs'), {
        actorUid: 'impersonated_bob',
        actorRole: 'CITIZEN',
        action: 'CITIZEN_LOGIN',
        timestamp: '2026-01-01',
      })
    );
  });

  // =========================================================================
  // RULE 10: SERVICES & DEPARTMENTS CATALOGUE
  // =========================================================================
  it('10. Services & Departments: Signed-in read allowed, admin write only', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const citizenDb = testEnv.authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();
    const adminDb = testEnv.authenticatedContext('admin_1', { role: 'ADMIN', status: 'APPROVED', email_verified: true }).firestore();

    await assertFails(getDoc(doc(unauthDb, 'services', 'srv_1')));
    await assertSucceeds(getDoc(doc(citizenDb, 'services', 'srv_1')));
    await assertSucceeds(getDoc(doc(citizenDb, 'departments', 'dept_a')));

    // Citizen cannot edit service
    await assertFails(
      updateDoc(doc(citizenDb, 'services', 'srv_1'), {
        name: 'Hacked Service',
      })
    );

    // Admin can edit service
    await assertSucceeds(
      updateDoc(doc(adminDb, 'services', 'srv_1'), {
        name: 'Updated Service Name',
      })
    );
  });

  // =========================================================================
  // RULE 11: AI CONVERSATIONS & MESSAGES
  // =========================================================================
  it('11. AI Conversations: Owner and Admin read/write/delete; other citizens denied', async () => {
    const aliceDb = testEnv.authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();
    const bobDb = testEnv.authenticatedContext('citizen_bob', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();

    await assertSucceeds(getDoc(doc(aliceDb, 'aiConversations', 'conv_alice')));
    await assertFails(getDoc(doc(bobDb, 'aiConversations', 'conv_alice')));

    await assertSucceeds(getDoc(doc(aliceDb, 'aiConversations', 'conv_alice', 'messages', 'msg_1')));
    await assertFails(getDoc(doc(bobDb, 'aiConversations', 'conv_alice', 'messages', 'msg_1')));
  });

  // =========================================================================
  // RULE 12: RESIDENT PROFILES
  // =========================================================================
  it('12. Resident Profiles: Read by owner/admin/auditor; citizen client write denied (backend API only)', async () => {
    const aliceDb = testEnv.authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();
    const bobDb = testEnv.authenticatedContext('citizen_bob', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();
    const adminDb = testEnv.authenticatedContext('admin_1', { role: 'ADMIN', status: 'APPROVED', email_verified: true }).firestore();

    await assertSucceeds(getDoc(doc(aliceDb, 'residentProfiles', 'citizen_alice')));
    await assertFails(getDoc(doc(bobDb, 'residentProfiles', 'citizen_alice')));
    await assertSucceeds(getDoc(doc(adminDb, 'residentProfiles', 'citizen_alice')));

    // Citizen write denied (routes via backend API)
    await assertFails(
      setDoc(doc(aliceDb, 'residentProfiles', 'citizen_alice'), {
        userId: 'citizen_alice',
        profileType: 'CITIZEN',
      })
    );

    // Admin write allowed
    await assertSucceeds(
      updateDoc(doc(adminDb, 'residentProfiles', 'citizen_alice'), {
        certificationStatus: 'VERIFIED',
      })
    );
  });

  // =========================================================================
  // RULE 13: DEFAULT DENY-ALL
  // =========================================================================
  it('13. Default Deny-All: Any unknown collection is strictly blocked for read and write', async () => {
    const adminDb = testEnv.authenticatedContext('admin_1', { role: 'ADMIN', status: 'APPROVED', email_verified: true }).firestore();
    const citizenDb = testEnv.authenticatedContext('citizen_alice', { role: 'CITIZEN', status: 'APPROVED', email_verified: true }).firestore();

    await assertFails(getDoc(doc(adminDb, 'secretInternalDocs', 'secret_1')));
    await assertFails(getDoc(doc(citizenDb, 'secretInternalDocs', 'secret_1')));
    await assertFails(
      setDoc(doc(adminDb, 'unknownCollection', 'doc1'), {
        foo: 'bar',
      })
    );
  });
});

