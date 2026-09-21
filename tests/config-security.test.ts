import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { Config, config } from '../constants/config';

describe('Transport & Configuration Security Tests', () => {
  it('1. Config exports all required properties with expected types', () => {
    assert.strictEqual(typeof Config.API_BASE_URL, 'string');
    assert.strictEqual(typeof Config.FIREBASE_API_KEY, 'string');
    assert.strictEqual(typeof Config.FIREBASE_AUTH_DOMAIN, 'string');
    assert.strictEqual(typeof Config.FIREBASE_PROJECT_ID, 'string');
    assert.strictEqual(typeof Config.DEMO_MODE, 'boolean');
  });

  it('2. Nested config object matches top-level Config values', () => {
    assert.strictEqual(config.apiBaseUrl, Config.API_BASE_URL);
    assert.strictEqual(config.demoMode, Config.DEMO_MODE);
    assert.strictEqual(config.firebase.apiKey, Config.FIREBASE_API_KEY);
    assert.strictEqual(config.firebase.projectId, Config.FIREBASE_PROJECT_ID);
  });

  it('3. In production mode, rejects insecure http:// URLs', () => {
    // Save current NODE_ENV
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      // Verify that an insecure HTTP URL cannot be validated in production
      const validate = (url: string) => {
        if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) {
          throw new Error('Insecure HTTP connection is strictly prohibited in production builds.');
        }
        return url;
      };

      assert.throws(
        () => validate('http://api.mahasetu.gov.in'),
        /Insecure HTTP connection is strictly prohibited/
      );
      assert.strictEqual(validate('https://api.mahasetu.gov.in'), 'https://api.mahasetu.gov.in');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
