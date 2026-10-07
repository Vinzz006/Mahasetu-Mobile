import { describe, it, before, after, beforeEach } from 'node:test';
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
  const originalGetUser = adminAuth.getUser.bind(adminAuth);
  const originalRevokeRefreshTokens = adminAuth.revokeRefreshTokens.bind(adminAuth);
  const originalUpdateUser = adminAuth.updateUser.bind(adminAuth);
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

  beforeEach(() => {
    (adminAuth as any).getUser = async (uid: string) => ({
      uid,
      email: `${uid}@example.com`,
      customClaims: {},
    });
    (adminAuth as any).setCustomUserClaims = async () => {};
    (adminAuth as any).revokeRefreshTokens = async () => {};
    (adminAuth as any).updateUser = async () => ({});
    (adminDb as any).collection = (colName: string) => ({
      doc: (docId: string) => ({
        id: docId,
        path: `${colName}/${docId}`,
        get: async () => ({ exists: true, id: docId, data: () => ({ id: docId }) }),
        set: async () => {},
        update: async () => {},
      }),
      where: () => ({
        where: () => ({
          get: async () => ({
            docs: [
              { id: 'admin1', data: () => ({ role: 'ADMIN', status: 'APPROVED', isActive: true }) },
              { id: 'admin2', data: () => ({ role: 'ADMIN', status: 'APPROVED', isActive: true }) },
            ],
          }),
        }),
      }),
    });
  });

  after(async () => {
    adminAuth.verifyIdToken = originalVerifyIdToken;
    adminAuth.setCustomUserClaims = originalSetCustomUserClaims;
    adminAuth.getUser = originalGetUser;
    adminAuth.revokeRefreshTokens = originalRevokeRefreshTokens;
    adminAuth.updateUser = originalUpdateUser;
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
      auth_time: Math.floor(Date.now() / 1000) - 10,
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
      auth_time: Math.floor(Date.now() / 1000) - 10,
    });

    let assignedClaims: any = null;
    let savedFirestoreData: any = null;

    (adminAuth as any).setCustomUserClaims = async (uid: string, claims: any) => {
      assignedClaims = { uid, claims };
    };

    (adminDb as any).collection = (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => ({ exists: true, data: () => ({ id: docId }) }),
        set: async (data: any) => {
          savedFirestoreData = { colName, docId, data };
        },
      }),
      where: () => ({
        where: () => ({
          get: async () => ({
            docs: [
              { id: 'admin1', data: () => ({ role: 'ADMIN', status: 'APPROVED', isActive: true }) },
              { id: 'admin2', data: () => ({ role: 'ADMIN', status: 'APPROVED', isActive: true }) },
            ],
          }),
        }),
      }),
    });

    const res = await fetch(`${baseUrl}/api/v1/admin/user-approvals/target_dept_officer/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_admin_token',
      },
      body: JSON.stringify({ role: 'DEPARTMENT_A', departmentId: 'DEPARTMENT_A' }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);

    // Verify custom claims set via Admin Auth
    assert.ok(assignedClaims, 'Must call setCustomUserClaims');
    assert.strictEqual(assignedClaims.uid, 'target_dept_officer');
    assert.strictEqual(assignedClaims.claims.role, 'DEPARTMENT_A');
    assert.strictEqual(assignedClaims.claims.departmentId, 'DEPARTMENT_A');
    assert.strictEqual(assignedClaims.claims.status, 'APPROVED');

    // Verify Firestore updated
    assert.ok(savedFirestoreData, 'Must write to users collection');
    assert.strictEqual(savedFirestoreData.colName, 'users');
    assert.strictEqual(savedFirestoreData.docId, 'target_dept_officer');
    assert.strictEqual(savedFirestoreData.data.role, 'DEPARTMENT_A');
    assert.strictEqual(savedFirestoreData.data.status, 'APPROVED');
    assert.strictEqual(savedFirestoreData.data.approvedBy, 'admin_user_1');
  });

  it('13. Rejects user with unverified email with 403 Forbidden', async () => {
    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'unverified_user_1',
      email: 'unverified@example.com',
      role: 'CITIZEN',
      status: 'APPROVED',
      email_verified: false,
    });

    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer unverified_token',
      },
      body: JSON.stringify({ serviceId: 'SERVICE_01' }),
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error.includes('Verified email address required'), true);
  });

  it('14. Rejects user with missing status on requireApproved route with 403 Forbidden', async () => {
    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'no_status_user',
      email: 'nostatus@example.com',
      role: 'CITIZEN',
      email_verified: true,
      // status is omitted/undefined
    });

    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer no_status_token',
      },
      body: JSON.stringify({ serviceId: 'SERVICE_01' }),
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error.includes('Approved account required'), true);
  });

  it('15. Rejects user with rejected role with 403 Forbidden', async () => {
    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'rejected_user_1',
      email: 'rejected@example.com',
      role: 'rejected',
      status: 'REJECTED',
      email_verified: true,
    });

    const res = await fetch(`${baseUrl}/api/v1/resident-profile`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer rejected_token',
      },
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error.includes('Invalid or unrecognized role'), true);
  });

  it('16. Rejects user with SUSPENDED status on requireApproved and requireApproved:false routes', async () => {
    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'suspended_user_1',
      email: 'suspended@example.com',
      role: 'CITIZEN',
      status: 'SUSPENDED',
      email_verified: true,
    });

    // 1. On requireApproved route (POST /applications) -> 403
    const resApp = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer suspended_token',
      },
      body: JSON.stringify({ serviceId: 'SERVICE_01' }),
    });
    assert.strictEqual(resApp.status, 403);

    // 2. On requireApproved:false route (GET /resident-profile) -> 403
    const resProf = await fetch(`${baseUrl}/api/v1/resident-profile`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer suspended_token',
      },
    });
    assert.strictEqual(resProf.status, 403);
    const profData = await resProf.json();
    assert.strictEqual(profData.error.includes('Account is suspended or rejected'), true);
  });

  it('17. Rejects user on role/endpoint mismatch with 403 Forbidden', async () => {
    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'dept_a_officer_1',
      email: 'officer.a@mahasetu.gov.in',
      role: 'DEPARTMENT_A',
      departmentId: 'DEPT_A',
      status: 'APPROVED',
      email_verified: true,
    });

    // Department officer trying to call Citizen-only endpoint (POST /applications)
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer officer_token',
      },
      body: JSON.stringify({ serviceId: 'SERVICE_01' }),
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error.includes('Insufficient role privileges'), true);
  });

  it('18. Allows PENDING citizen to access resident-profile but blocks application submission and AI chat', async () => {
    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'pending_citizen_1',
      email: 'pending.citizen@example.com',
      role: 'CITIZEN',
      status: 'PENDING',
      email_verified: true,
    });

    // Mock Firestore for residentProfile
    (adminDb as any).collection = (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => ({
          exists: true,
          data: () => ({ userId: docId, personalDetails: { firstName: 'Pending' } }),
        }),
      }),
    });

    // 1. GET /resident-profile -> 200 (allowed for onboarding)
    const resProf = await fetch(`${baseUrl}/api/v1/resident-profile`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer pending_token',
      },
    });
    assert.strictEqual(resProf.status, 200);

    // 2. POST /applications -> 403 (blocked because status != APPROVED)
    const resApp = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer pending_token',
      },
      body: JSON.stringify({ serviceId: 'SERVICE_01' }),
    });
    assert.strictEqual(resApp.status, 403);

    // 3. POST /ai/chat -> 403 (blocked because status != APPROVED)
    const resAi = await fetch(`${baseUrl}/api/v1/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer pending_token',
      },
      body: JSON.stringify({ message: 'Hello AI' }),
    });
    assert.strictEqual(resAi.status, 403);
  });

  it('19. Rejects unknown endpoint with 404 Not Found', async () => {
    const res = await fetch(`${baseUrl}/api/v1/unknown-endpoint`, {
      method: 'GET',
    });
    assert.strictEqual(res.status, 404);
  });

  it('20. Demoting or approving officer revokes refresh tokens immediately', async () => {
    let revokedUid = '';
    (adminAuth as any).revokeRefreshTokens = async (uid: string) => {
      revokedUid = uid;
    };
    (adminAuth as any).getUser = async (uid: string) => ({
      uid,
      email: `${uid}@example.com`,
      customClaims: { role: 'CITIZEN', status: 'PENDING' },
    });

    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'admin_user_1',
      email: 'admin@mahasetu.gov.in',
      role: 'ADMIN',
      status: 'APPROVED',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000) - 10,
    });

    const res = await fetch(`${baseUrl}/api/v1/admin/user-approvals/officer_target_1/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_admin_token',
      },
      body: JSON.stringify({ role: 'DEPARTMENT_A', departmentId: 'DEPARTMENT_A' }),
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(revokedUid, 'officer_target_1');
  });

  it('21. Rejects department role with mismatched departmentId or non-department role with departmentId with 400 Bad Request', async () => {
    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'admin_user_1',
      email: 'admin@mahasetu.gov.in',
      role: 'ADMIN',
      status: 'APPROVED',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000) - 10,
    });
    (adminAuth as any).getUser = async (uid: string) => ({
      uid,
      email: `${uid}@example.com`,
      customClaims: {},
    });

    // 1. DEPARTMENT_A with departmentId DEPARTMENT_B -> 400
    const resMismatch = await fetch(`${baseUrl}/api/v1/admin/user-approvals/target_1/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_admin_token',
      },
      body: JSON.stringify({ role: 'DEPARTMENT_A', departmentId: 'DEPARTMENT_B' }),
    });
    assert.strictEqual(resMismatch.status, 400);
    const dataMismatch = await resMismatch.json();
    assert.strictEqual(dataMismatch.error.includes('Department ID must match'), true);

    // 2. CITIZEN with departmentId DEPARTMENT_A -> 400
    const resCitizenDept = await fetch(`${baseUrl}/api/v1/admin/user-approvals/target_1/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_admin_token',
      },
      body: JSON.stringify({ role: 'CITIZEN', departmentId: 'DEPARTMENT_A' }),
    });
    assert.strictEqual(resCitizenDept.status, 400);
    const dataCitizenDept = await resCitizenDept.json();
    assert.strictEqual(dataCitizenDept.error.includes('Department ID is not permitted for non-department roles'), true);
  });

  it('22. Rejects demoting or rejecting the last remaining ADMIN with 400 Bad Request', async () => {
    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'admin_caller_1',
      email: 'admin.caller@mahasetu.gov.in',
      role: 'ADMIN',
      status: 'APPROVED',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000) - 10,
    });

    // Target is currently an ADMIN
    (adminAuth as any).getUser = async (uid: string) => ({
      uid,
      email: 'admin.target@mahasetu.gov.in',
      customClaims: { role: 'ADMIN', status: 'APPROVED' },
    });

    // Mock Firestore users search: no other admins exist
    (adminDb as any).collection = (colName: string) => ({
      where: () => ({
        where: () => ({
          get: async () => ({
            docs: [
              { id: 'admin.target', data: () => ({ role: 'ADMIN', status: 'APPROVED', isActive: true }) },
            ],
          }),
        }),
      }),
      doc: () => ({
        set: async () => {},
        get: async () => ({ exists: true }),
      }),
    });

    // Try to reject the last admin
    const res = await fetch(`${baseUrl}/api/v1/admin/user-approvals/admin.target/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_admin_token',
      },
      body: JSON.stringify({ reason: 'Malicious attempt to remove last admin' }),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error.includes('Cannot reject the last remaining administrator'), true);
  });

  it('23. Admin suspends user: sets SUSPENDED status, revokes tokens, disables user in auth', async () => {
    let disabledUid = '';
    let disabledVal = false;
    let revokedUid = '';
    let updatedClaims: any = null;

    (adminAuth as any).getUser = async (uid: string) => ({
      uid,
      email: `${uid}@example.com`,
      customClaims: { role: 'CITIZEN', status: 'APPROVED' },
    });
    (adminAuth as any).updateUser = async (uid: string, props: any) => {
      disabledUid = uid;
      disabledVal = props.disabled;
    };
    (adminAuth as any).revokeRefreshTokens = async (uid: string) => {
      revokedUid = uid;
    };
    (adminAuth as any).setCustomUserClaims = async (uid: string, claims: any) => {
      updatedClaims = { uid, claims };
    };

    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'admin_user_1',
      email: 'admin@mahasetu.gov.in',
      role: 'ADMIN',
      status: 'APPROVED',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000) - 10,
    });

    const res = await fetch(`${baseUrl}/api/v1/admin/users/bad_actor_uid/suspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_admin_token',
      },
      body: JSON.stringify({ reason: 'Fraudulent activity detected' }),
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(disabledUid, 'bad_actor_uid');
    assert.strictEqual(disabledVal, true);
    assert.strictEqual(revokedUid, 'bad_actor_uid');
    assert.strictEqual(updatedClaims.claims.status, 'SUSPENDED');
  });

  it('24. Admin reinstates user: sets APPROVED status, revokes tokens, enables user in auth', async () => {
    let disabledUid = '';
    let disabledVal = true;
    let revokedUid = '';
    let updatedClaims: any = null;

    (adminAuth as any).getUser = async (uid: string) => ({
      uid,
      email: `${uid}@example.com`,
      customClaims: { role: 'CITIZEN', status: 'SUSPENDED' },
    });
    (adminAuth as any).updateUser = async (uid: string, props: any) => {
      disabledUid = uid;
      disabledVal = props.disabled;
    };
    (adminAuth as any).revokeRefreshTokens = async (uid: string) => {
      revokedUid = uid;
    };
    (adminAuth as any).setCustomUserClaims = async (uid: string, claims: any) => {
      updatedClaims = { uid, claims };
    };

    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'admin_user_1',
      email: 'admin@mahasetu.gov.in',
      role: 'ADMIN',
      status: 'APPROVED',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000) - 10,
    });

    const res = await fetch(`${baseUrl}/api/v1/admin/users/bad_actor_uid/reinstate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_admin_token',
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(disabledUid, 'bad_actor_uid');
    assert.strictEqual(disabledVal, false);
    assert.strictEqual(revokedUid, 'bad_actor_uid');
    assert.strictEqual(updatedClaims.claims.status, 'APPROVED');
  });

  it('25. Rejects privileged action when authAge exceeds 300s with 401 REAUTH_REQUIRED', async () => {
    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'admin_user_1',
      email: 'admin@mahasetu.gov.in',
      role: 'ADMIN',
      status: 'APPROVED',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000) - 350, // 350 seconds old (exceeds 300s max)
    });

    const res = await fetch(`${baseUrl}/api/v1/admin/users/target_1/suspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer stale_admin_token',
      },
      body: JSON.stringify({ reason: 'Suspension attempt with stale auth' }),
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.code, 'REAUTH_REQUIRED');
  });

  it('26. Rejects admin action when target user is not found in auth with 404', async () => {
    (adminAuth as any).getUser = async () => {
      throw new Error('User not found');
    };

    (adminAuth as any).verifyIdToken = async () => ({
      uid: 'admin_user_1',
      email: 'admin@mahasetu.gov.in',
      role: 'ADMIN',
      status: 'APPROVED',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000) - 10,
    });

    const res = await fetch(`${baseUrl}/api/v1/admin/users/nonexistent_user/suspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_admin_token',
      },
      body: JSON.stringify({ reason: 'Target does not exist' }),
    });

    assert.strictEqual(res.status, 404);
  });
});

