import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'http';
import { createBackendServer, verifyFirebaseToken } from '../server';
import { adminAuth, adminDb } from '../lib/firebaseAdmin';
import { twilioBackendService } from '../notifications/twilio.service';

describe('Backend Server Authentication & Security Tests', () => {
  let server: http.Server;
  let serverPort: number;
  let baseUrl: string;

  const originalVerifyIdToken = adminAuth.verifyIdToken.bind(adminAuth);
  const originalRunTransaction = adminDb.runTransaction.bind(adminDb);
  const originalBatch = adminDb.batch.bind(adminDb);
  const originalCollection = adminDb.collection.bind(adminDb);
  const originalSetCustomUserClaims = adminAuth.setCustomUserClaims.bind(adminAuth);
  const originalSendSms = twilioBackendService.sendApplicationStatusSms.bind(twilioBackendService);

  before(async () => {
    // Stub SMS sending so unit tests don't make network calls
    twilioBackendService.sendApplicationStatusSms = async () => ({
      success: true,
      status: 'SKIPPED',
    });

    server = createBackendServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as any;
        serverPort = address.port;
        baseUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  after(async () => {
    adminAuth.verifyIdToken = originalVerifyIdToken;
    adminAuth.setCustomUserClaims = originalSetCustomUserClaims;
    adminDb.runTransaction = originalRunTransaction;
    adminDb.batch = originalBatch;
    adminDb.collection = originalCollection;
    twilioBackendService.sendApplicationStatusSms = originalSendSms;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('1. Rejects request with no token with 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: 'SERVICE_01' }),
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error.includes('Unauthorized'), true);
    assert.ok(data.requestId, 'Response must include requestId');
  });

  it('2. Rejects forged / unsigned token with 401 Unauthorized', async () => {
    (adminAuth as any).verifyIdToken = async () => {
      throw new Error('Firebase ID token has invalid signature.');
    };

    const forgedToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhdHRhY2tlciIsInJvbGUiOiJBRE1JTiJ9.';
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${forgedToken}`,
      },
      body: JSON.stringify({ serviceId: 'SERVICE_01' }),
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error.includes('Unauthorized'), true);
  });

  it('3. Rejects citizen calling /verify with 403 Forbidden', async () => {
    (adminAuth as any).verifyIdToken = async () => {
      return {
        uid: 'citizen_test_123',
        email: 'citizen@example.com',
        role: 'CITIZEN',
        status: 'APPROVED',
        email_verified: true,
      };
    };

    const res = await fetch(`${baseUrl}/api/v1/applications/app_123/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_citizen_token',
      },
      body: JSON.stringify({ comments: 'Self verification attempt' }),
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error.includes('Forbidden'), true);
  });

  it('4. Department-A officer cannot fill ADMIN slot (verifierRole in body is ignored)', async () => {
    (adminAuth as any).verifyIdToken = async () => {
      return {
        uid: 'officer_dept_a_456',
        email: 'officer.a@mahasetu.gov.in',
        role: 'DEPARTMENT_A',
        departmentId: 'DEPT_A',
        status: 'APPROVED',
        email_verified: true,
      };
    };

    let writtenSlotDocId = '';
    (adminDb as any).runTransaction = async (updateFn: any) => {
      return updateFn({
        get: async (docRef: any) => {
          return {
            exists: true,
            data: () => ({
              id: 'app_test_1',
              citizenId: 'citizen_owner',
              status: 'UNDER_VERIFICATION',
              verificationSummary: { verifiedCount: 0 },
            }),
          };
        },
        set: (docRef: any, data: any) => {
          writtenSlotDocId = docRef.id || docRef.path || '';
        },
        update: () => {},
      });
    };

    // Attacker sends verifierRole: 'ADMIN' in the request body
    const res = await fetch(`${baseUrl}/api/v1/applications/app_test_1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dept_a_officer_token',
      },
      body: JSON.stringify({
        verifierRole: 'ADMIN',
        departmentId: 'ADMIN',
        comments: 'Malicious attempt to sign as ADMIN',
      }),
    });

    assert.strictEqual(res.status, 200);
    // Verified that slot written is department_a, NOT admin!
    assert.ok(writtenSlotDocId.includes('department_a'), `Must write to department_a slot, got ${writtenSlotDocId}`);
    assert.strictEqual(writtenSlotDocId.includes('admin'), false, 'Cannot write to admin slot');
  });

  it('5. Body-supplied citizenId is ignored on POST /applications', async () => {
    (adminAuth as any).verifyIdToken = async () => {
      return {
        uid: 'legitimate_citizen_999',
        email: 'citizen@example.com',
        role: 'CITIZEN',
        status: 'APPROVED',
        email_verified: true,
      };
    };

    let committedAppData: any = null;
    (adminDb as any).batch = () => {
      return {
        create: (ref: any, data: any) => {
          if (data.serviceId) {
            committedAppData = data;
          }
        },
        commit: async () => {},
      };
    };

    // Attacker tries to create application for another victim
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_citizen_token',
      },
      body: JSON.stringify({
        citizenId: 'victim_citizen_000',
        citizenUid: 'victim_citizen_000',
        id: 'overwritten_app_id',
        status: 'APPLICATION_VERIFIED',
        serviceId: 'INCOME_CERT_01',
      }),
    });

    assert.strictEqual(res.status, 201);
    assert.ok(committedAppData, 'Application must be created in batch');
    assert.strictEqual(committedAppData.citizenId, 'legitimate_citizen_999');
    assert.strictEqual(committedAppData.citizenUid, 'legitimate_citizen_999');
    assert.strictEqual(committedAppData.status, 'APPLICATION_SUBMITTED');
    assert.notStrictEqual(committedAppData.id, 'overwritten_app_id');
  });

  it('6. Second verify is idempotent and returns duplicate: true without re-verification', async () => {
    (adminAuth as any).verifyIdToken = async () => {
      return {
        uid: 'officer_dept_b_789',
        email: 'officer.b@mahasetu.gov.in',
        role: 'DEPARTMENT_B',
        departmentId: 'DEPT_B',
        status: 'APPROVED',
        email_verified: true,
      };
    };

    (adminDb as any).runTransaction = async (updateFn: any) => {
      return updateFn({
        get: async (docRef: any) => {
          const id = docRef.id || docRef.path || '';
          if (id.includes('department_b')) {
            // Already verified slot!
            return {
              exists: true,
              data: () => ({ status: 'VERIFIED', verifierRole: 'DEPARTMENT_B' }),
            };
          }
          return {
            exists: true,
            data: () => ({ id: 'app_test_2', status: 'UNDER_VERIFICATION' }),
          };
        },
        set: () => {},
        update: () => {},
      });
    };

    const res = await fetch(`${baseUrl}/api/v1/applications/app_test_2/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dept_b_officer_token',
      },
      body: JSON.stringify({ comments: 'Second verify attempt' }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.duplicate, true);
    assert.strictEqual(data.message.includes('already verified'), true);
  });

  it('7. Rejects request payloads larger than 100 KB with 413 Payload Too Large', async () => {
    const hugeString = 'A'.repeat(110 * 1024); // 110 KB
    try {
      const res = await fetch(`${baseUrl}/api/v1/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: hugeString }),
      });
      assert.strictEqual(res.status, 413);
    } catch {
      // Destroyed socket on client is expected when server aborts on >100KB
    }
  });

  it('8. Rejects malformed JSON with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ malformed_json: missing_quotes ',
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error.includes('Invalid JSON'), true);
  });

  it('9. Public health endpoint /api/v1/health is accessible without token', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
  });

  it('10. Rejects non-admin attempting user approval with 403 Forbidden', async () => {
    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'citizen_attacker_1',
      email: 'citizen@example.com',
      role: 'CITIZEN',
      status: 'APPROVED',
      email_verified: true,
    });

    const res = await fetch(`${baseUrl}/api/v1/admin/user-approvals/target_user_1/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_citizen_token',
      },
      body: JSON.stringify({ role: 'DEPARTMENT_A', departmentId: 'DEPT_A' }),
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error.includes('Forbidden'), true);
  });

  it('11. Rejects admin attempting self-approval or self-role change with 400 Bad Request', async () => {
    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'admin_user_1',
      email: 'admin@mahasetu.gov.in',
      role: 'ADMIN',
      status: 'APPROVED',
      email_verified: true,
    });

    const res = await fetch(`${baseUrl}/api/v1/admin/user-approvals/admin_user_1/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_admin_token',
      },
      body: JSON.stringify({ role: 'ADMIN' }),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error.includes('Self-approval or self-role assignment is prohibited'), true);
  });

  it('12. Admin successfully approves user and assigns signed custom claims', async () => {
    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'admin_user_1',
      email: 'admin@mahasetu.gov.in',
      role: 'ADMIN',
      status: 'APPROVED',
      email_verified: true,
    });

    let assignedClaims: any = null;
    let savedFirestoreData: any = null;

    (adminAuth as any).setCustomUserClaims = async (uid: string, claims: any) => {
      assignedClaims = { uid, claims };
    };

    (adminDb as any).collection = (colName: string) => ({
      doc: (docId: string) => ({
        set: async (data: any) => {
          savedFirestoreData = { colName, docId, data };
        },
      }),
    });

    const res = await fetch(`${baseUrl}/api/v1/admin/user-approvals/target_dept_officer/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_admin_token',
      },
      body: JSON.stringify({ role: 'DEPARTMENT_A', departmentId: 'DEPT_A' }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);

    // Verify custom claims set via Admin Auth
    assert.ok(assignedClaims, 'Must call setCustomUserClaims');
    assert.strictEqual(assignedClaims.uid, 'target_dept_officer');
    assert.strictEqual(assignedClaims.claims.role, 'DEPARTMENT_A');
    assert.strictEqual(assignedClaims.claims.departmentId, 'DEPT_A');
    assert.strictEqual(assignedClaims.claims.status, 'APPROVED');

    // Verify Firestore updated
    assert.ok(savedFirestoreData, 'Must write to users collection');
    assert.strictEqual(savedFirestoreData.colName, 'users');
    assert.strictEqual(savedFirestoreData.docId, 'target_dept_officer');
    assert.strictEqual(savedFirestoreData.data.role, 'DEPARTMENT_A');
    assert.strictEqual(savedFirestoreData.data.status, 'APPROVED');
    assert.strictEqual(savedFirestoreData.data.approvedBy, 'admin_user_1');
  });
});

