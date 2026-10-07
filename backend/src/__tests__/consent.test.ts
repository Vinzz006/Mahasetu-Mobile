import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { verifyOfficerConsent } from '../lib/consentValidator';

describe('Consent Enforcement & Officer Document Access Tests', () => {
  it('1. Statutory Admin & Auditor oversight bypasses departmental consent check', async () => {
    const mockDb: any = {};
    const adminRes = await verifyOfficerConsent({
      db: mockDb,
      citizenUid: 'citizen_123',
      departmentId: '',
      officerRole: 'ADMIN',
      officerUid: 'admin_1',
    });
    assert.strictEqual(adminRes.allowed, true);
    assert.strictEqual(adminRes.isAuditOverride, true);

    const auditorRes = await verifyOfficerConsent({
      db: mockDb,
      citizenUid: 'citizen_123',
      departmentId: '',
      officerRole: 'AUDITOR',
      officerUid: 'auditor_1',
    });
    assert.strictEqual(auditorRes.allowed, true);
    assert.strictEqual(auditorRes.isAuditOverride, true);
  });

  it('2. Department officer with active GRANTED consent is allowed access', async () => {
    const mockDb: any = {
      collection: () => ({
        where: () => ({
          where: () => ({
            get: async () => ({
              empty: false,
              docs: [
                {
                  id: 'consent_doc_1',
                  data: () => ({
                    citizenUid: 'citizen_123',
                    targetDepartment: 'DEPARTMENT_A',
                    status: 'GRANTED',
                    expiresAt: new Date(Date.now() + 86400000).toISOString(),
                  }),
                },
              ],
            }),
          }),
        }),
      }),
    };

    const res = await verifyOfficerConsent({
      db: mockDb,
      citizenUid: 'citizen_123',
      departmentId: 'DEPARTMENT_A',
      officerRole: 'DEPARTMENT_A',
      officerUid: 'officer_dept_a',
    });

    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.consentId, 'consent_doc_1');
  });

  it('3. Department officer without active consent (empty or DENIED) is denied access', async () => {
    const mockDb: any = {
      collection: () => ({
        where: () => ({
          where: () => ({
            get: async () => ({
              empty: true,
              docs: [],
            }),
          }),
        }),
      }),
    };

    const res = await verifyOfficerConsent({
      db: mockDb,
      citizenUid: 'citizen_123',
      departmentId: 'DEPARTMENT_A',
      officerRole: 'DEPARTMENT_A',
      officerUid: 'officer_dept_a',
    });

    assert.strictEqual(res.allowed, false);
    assert.ok(res.reason?.includes('No active GRANTED consent'));
  });

  it('4. Department officer with expired consent is denied access', async () => {
    const mockDb: any = {
      collection: () => ({
        where: () => ({
          where: () => ({
            get: async () => ({
              empty: false,
              docs: [
                {
                  id: 'consent_expired_1',
                  data: () => ({
                    citizenUid: 'citizen_123',
                    targetDepartment: 'DEPARTMENT_A',
                    status: 'GRANTED',
                    expiresAt: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
                  }),
                },
              ],
            }),
          }),
        }),
      }),
    };

    const res = await verifyOfficerConsent({
      db: mockDb,
      citizenUid: 'citizen_123',
      departmentId: 'DEPARTMENT_A',
      officerRole: 'DEPARTMENT_A',
      officerUid: 'officer_dept_a',
    });

    assert.strictEqual(res.allowed, false);
    assert.ok(res.reason?.includes('expired'));
  });

  it('5. Officer from different department (DEPT_B) is denied access when consent was for DEPT_A', async () => {
    const mockDb: any = {
      collection: () => ({
        where: () => ({
          where: () => ({
            get: async () => ({
              empty: false,
              docs: [
                {
                  id: 'consent_dept_a_only',
                  data: () => ({
                    citizenUid: 'citizen_123',
                    targetDepartment: 'DEPARTMENT_A',
                    status: 'GRANTED',
                    expiresAt: new Date(Date.now() + 86400000).toISOString(),
                  }),
                },
              ],
            }),
          }),
        }),
      }),
    };

    const res = await verifyOfficerConsent({
      db: mockDb,
      citizenUid: 'citizen_123',
      departmentId: 'DEPARTMENT_B',
      officerRole: 'DEPARTMENT_B',
      officerUid: 'officer_dept_b',
    });

    assert.strictEqual(res.allowed, false);
    assert.ok(res.reason?.includes('No active citizen consent grants access to DEPARTMENT_B'));
  });
});
