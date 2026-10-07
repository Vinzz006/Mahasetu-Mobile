import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import { scanFileForSecrets, scanRepository } from '../scripts/scan-secrets';

describe('Repository Secret Scanning & Leak Prevention Tests', () => {
  it('1. scanFileForSecrets flags raw Google API keys', () => {
    const rawKeyContent = 'const key = "AIzaSyB12345678901234567890123456789012";';
    const issues = scanFileForSecrets('test.ts', rawKeyContent);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].id, 'firebase_live_key');
  });

  it('2. scanFileForSecrets ignores dummy dev placeholder key', () => {
    const dummyKeyContent = 'const key = "AIzaSyDummyDevKeyForTestingOnly00000";';
    const issues = scanFileForSecrets('constants/config.ts', dummyKeyContent);
    assert.strictEqual(issues.length, 0);
  });

  it('3. scanFileForSecrets flags raw Twilio Auth Tokens', () => {
    const twilioContent = 'TWILIO_AUTH_TOKEN = "0123456789abcdef0123456789abcdef"';
    const issues = scanFileForSecrets('.env', twilioContent);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].id, 'raw_twilio_auth_token');
  });

  it('4. Entire repository passes automated secret scanning with zero leaks', () => {
    const rootDir = path.resolve(__dirname, '..');
    const leaks = scanRepository(rootDir);
    assert.deepStrictEqual(leaks, [], `Expected zero secret leaks in repository, but found: ${JSON.stringify(leaks)}`);
  });
});
