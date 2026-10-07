import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { redirectSystemPath } from '../app/+native-intent';

describe('Native Intent & Deep Link Security Filter Tests', () => {
  it('1. Allows safe known application routes', () => {
    assert.strictEqual(redirectSystemPath({ path: '/(citizen)/(tabs)', initial: false }), '/(citizen)/(tabs)');
    assert.strictEqual(redirectSystemPath({ path: '/(admin)/(tabs)', initial: false }), '/(admin)/(tabs)');
    assert.strictEqual(redirectSystemPath({ path: '/(department)/(tabs)', initial: false }), '/(department)/(tabs)');
    assert.strictEqual(redirectSystemPath({ path: '/(pending)/profile', initial: false }), '/(pending)/profile');
    assert.strictEqual(redirectSystemPath({ path: '/resident-details', initial: false }), '/resident-details');
    assert.strictEqual(redirectSystemPath({ path: '/', initial: false }), '/');
  });

  it('2. Normalizes deep links with custom schemes (mahasetu://)', () => {
    assert.strictEqual(
      redirectSystemPath({ path: 'mahasetu:///(citizen)/(tabs)', initial: true }),
      '/(citizen)/(tabs)'
    );
    assert.strictEqual(
      redirectSystemPath({ path: 'https://mahasetu.gov.in/(citizen)/(tabs)', initial: true }),
      '/(citizen)/(tabs)'
    );
  });

  it('3. Neutralizes directory traversal attacks', () => {
    assert.strictEqual(redirectSystemPath({ path: '/(citizen)/../(admin)', initial: false }), '/');
    assert.strictEqual(redirectSystemPath({ path: '/..%2f..%2fetc%2fpasswd', initial: false }), '/');
  });

  it('4. Neutralizes script and pseudo-protocol injection', () => {
    assert.strictEqual(
      redirectSystemPath({ path: 'javascript:alert(1)', initial: false }),
      '/'
    );
    assert.strictEqual(
      redirectSystemPath({ path: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', initial: false }),
      '/'
    );
  });

  it('5. Rejects unauthorized / unknown path targets', () => {
    assert.strictEqual(redirectSystemPath({ path: '/secret-internal-endpoint', initial: false }), '/');
    assert.strictEqual(redirectSystemPath({ path: '/evil.com/redirect', initial: false }), '/');
  });
});
