import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { verifyAppCheck, verifyAppCheckToken } from '../lib/appCheck';
import { adminAppCheck } from '../lib/firebaseAdmin';

describe('Firebase App Check Verification & Attestation Tests', () => {
  it('1. verifyAppCheckToken returns valid true with appId on authentic token', async () => {
    const originalVerifyToken = adminAppCheck.verifyToken.bind(adminAppCheck);
    try {
      (adminAppCheck as any).verifyToken = async (token: string) => {
        if (token === 'valid_play_integrity_token') {
          return { appId: 'in.gov.mahasetu.mobile', token };
        }
        throw new Error('Firebase App Check token has expired or is invalid.');
      };

      const result = await verifyAppCheckToken('valid_play_integrity_token');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.appId, 'in.gov.mahasetu.mobile');
    } finally {
      adminAppCheck.verifyToken = originalVerifyToken;
    }
  });

  it('2. verifyAppCheckToken returns valid false on missing or empty token', async () => {
    const res1 = await verifyAppCheckToken('');
    assert.strictEqual(res1.valid, false);
    assert.ok(res1.error);

    const res2 = await verifyAppCheckToken(undefined);
    assert.strictEqual(res2.valid, false);
  });

  it('3. verifyAppCheckToken returns valid false on forged/expired token', async () => {
    const originalVerifyToken = adminAppCheck.verifyToken.bind(adminAppCheck);
    try {
      (adminAppCheck as any).verifyToken = async () => {
        throw new Error('App Check token verification failed: signature invalid.');
      };

      const result = await verifyAppCheckToken('forged_token');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes('signature invalid'));
    } finally {
      adminAppCheck.verifyToken = originalVerifyToken;
    }
  });

  it('4. verifyAppCheck allows missing token when APP_CHECK_ENFORCED is false', async () => {
    const originalEnforce = process.env.APP_CHECK_ENFORCED;
    try {
      process.env.APP_CHECK_ENFORCED = 'false';
      const req: any = { headers: {} };
      const res: any = {};
      const passed = await verifyAppCheck(req, res, 'req_dev');
      assert.strictEqual(passed, true);
    } finally {
      process.env.APP_CHECK_ENFORCED = originalEnforce;
    }
  });

  it('5. verifyAppCheck rejects missing token with 401 APP_CHECK_REQUIRED when APP_CHECK_ENFORCED is true', async () => {
    const originalEnforce = process.env.APP_CHECK_ENFORCED;
    try {
      process.env.APP_CHECK_ENFORCED = 'true';
      const req: any = { headers: {} };
      let statusCode = 0;
      let bodyString = '';
      const res: any = {
        writeHead: (status: number) => {
          statusCode = status;
        },
        end: (data: string) => {
          bodyString = data;
        },
      };

      const passed = await verifyAppCheck(req, res, 'req_strict');
      assert.strictEqual(passed, false);
      assert.strictEqual(statusCode, 401);
      const parsed = JSON.parse(bodyString);
      assert.strictEqual(parsed.code, 'APP_CHECK_REQUIRED');
    } finally {
      process.env.APP_CHECK_ENFORCED = originalEnforce;
    }
  });

  it('6. verifyAppCheck rejects invalid token with 401 APP_CHECK_INVALID when APP_CHECK_ENFORCED is true', async () => {
    const originalEnforce = process.env.APP_CHECK_ENFORCED;
    const originalVerifyToken = adminAppCheck.verifyToken.bind(adminAppCheck);
    try {
      process.env.APP_CHECK_ENFORCED = 'true';
      (adminAppCheck as any).verifyToken = async () => {
        throw new Error('Token expired');
      };

      const req: any = { headers: { 'x-firebase-appcheck': 'expired_token' } };
      let statusCode = 0;
      let bodyString = '';
      const res: any = {
        writeHead: (status: number) => {
          statusCode = status;
        },
        end: (data: string) => {
          bodyString = data;
        },
      };

      const passed = await verifyAppCheck(req, res, 'req_strict_invalid');
      assert.strictEqual(passed, false);
      assert.strictEqual(statusCode, 401);
      const parsed = JSON.parse(bodyString);
      assert.strictEqual(parsed.code, 'APP_CHECK_INVALID');
    } finally {
      process.env.APP_CHECK_ENFORCED = originalEnforce;
      adminAppCheck.verifyToken = originalVerifyToken;
    }
  });
});
