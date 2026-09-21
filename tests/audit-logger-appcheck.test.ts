import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { logger } from '../backend/src/lib/logger';
import { verifyAppCheck } from '../backend/src/lib/appCheck';
import { adminAppCheck } from '../backend/src/lib/firebaseAdmin';

describe('Structured Audit Logger & Firebase App Check Tests', () => {
  describe('1. Zero-PII Structured Audit Logger', () => {
    it('1.1. Emits valid JSON containing required security schema', () => {
      let loggedOutput = '';
      const originalLog = console.log;
      try {
        console.log = (msg: string) => {
          loggedOutput = msg;
        };

        logger.audit({
          event: 'TEST_EVENT',
          action: 'test_action',
          actor: { uid: 'user_123', role: 'ADMIN' },
          target: { resource: 'application', id: 'app_999' },
          outcome: 'SUCCESS',
        });

        assert.ok(loggedOutput.length > 0);
        const parsed = JSON.parse(loggedOutput);
        assert.strictEqual(parsed.level, 'AUDIT');
        assert.strictEqual(parsed.event, 'TEST_EVENT');
        assert.strictEqual(parsed.action, 'test_action');
        assert.strictEqual(parsed.actor.uid, 'user_123');
        assert.strictEqual(parsed.actor.role, 'ADMIN');
        assert.strictEqual(parsed.target.resource, 'application');
        assert.strictEqual(parsed.target.id, 'app_999');
        assert.strictEqual(parsed.outcome, 'SUCCESS');
        assert.ok(parsed.timestamp);
      } finally {
        console.log = originalLog;
      }
    });

    it('1.2. Scrubs and redacts PII (Aadhaar, passwords, emails, phones)', () => {
      let loggedOutput = '';
      const originalLog = console.log;
      try {
        console.log = (msg: string) => {
          loggedOutput = msg;
        };

        logger.audit({
          event: 'PII_SCRUB_TEST',
          action: 'verify_scrub',
          outcome: 'SUCCESS',
          details: {
            aadhaarNumber: '123456789012',
            secretToken: 'sensitive_jwt_token',
            passwordField: 'userSecretPassword123',
            userEmail: 'ramesh.kumar@mahasetu.gov.in',
            phoneNumber: '+919876543210',
            publicInfo: 'Public Description',
          },
        });

        const parsed = JSON.parse(loggedOutput);
        assert.strictEqual(parsed.details.aadhaarNumber, '[REDACTED]');
        assert.strictEqual(parsed.details.secretToken, '[REDACTED]');
        assert.strictEqual(parsed.details.passwordField, '[REDACTED]');
        assert.strictEqual(parsed.details.userEmail.includes('ramesh.kumar'), false);
        assert.strictEqual(parsed.details.phoneNumber.includes('987654'), false);
        assert.strictEqual(parsed.details.publicInfo, 'Public Description');
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('2. Firebase App Check Backend Verification', () => {
    it('2.1. Passes request when App Check is not enforced and token is missing', async () => {
      const originalEnforce = process.env.APP_CHECK_ENFORCED;
      try {
        process.env.APP_CHECK_ENFORCED = 'false';
        const req: any = { headers: {} };
        const res: any = {};
        const passed = await verifyAppCheck(req, res, 'req_1');
        assert.strictEqual(passed, true);
      } finally {
        process.env.APP_CHECK_ENFORCED = originalEnforce;
      }
    });

    it('2.2. Rejects request with 401 when App Check is enforced and token is missing', async () => {
      const originalEnforce = process.env.APP_CHECK_ENFORCED;
      try {
        process.env.APP_CHECK_ENFORCED = 'true';
        const req: any = { headers: {} };
        let writtenStatus = 0;
        let writtenData = '';
        const res: any = {
          writeHead: (status: number) => {
            writtenStatus = status;
          },
          end: (data: string) => {
            writtenData = data;
          },
        };

        const passed = await verifyAppCheck(req, res, 'req_2');
        assert.strictEqual(passed, false);
        assert.strictEqual(writtenStatus, 401);
        assert.ok(writtenData.includes('App Check token is required'));
      } finally {
        process.env.APP_CHECK_ENFORCED = originalEnforce;
      }
    });

    it('2.3. Successfully verifies valid token when enforced', async () => {
      const originalEnforce = process.env.APP_CHECK_ENFORCED;
      const originalVerifyToken = adminAppCheck.verifyToken.bind(adminAppCheck);
      try {
        process.env.APP_CHECK_ENFORCED = 'true';
        (adminAppCheck as any).verifyToken = async () => ({
          appId: 'gov.mahasetu.mobile',
          token: 'valid_app_check_token',
        });

        const req: any = { headers: { 'x-firebase-appcheck': 'valid_token' } };
        const res: any = {};
        const passed = await verifyAppCheck(req, res, 'req_3');
        assert.strictEqual(passed, true);
      } finally {
        process.env.APP_CHECK_ENFORCED = originalEnforce;
        adminAppCheck.verifyToken = originalVerifyToken;
      }
    });
  });
});
