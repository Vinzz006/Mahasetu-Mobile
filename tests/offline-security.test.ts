const store = new Map<string, string>();
(global as any).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  },
};

import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { offlineSecurityService } from '../services/offlineSecurityService';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Offline Persistence & Storage Security Tests', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('1. sanitizeOfflinePayload masks raw Aadhaar numbers before caching', () => {
    const rawData = {
      name: 'Ramesh',
      aadhaar: '987654321012',
      profile: {
        rawId: '987654321012',
      },
    };

    const sanitized = offlineSecurityService.sanitizeOfflinePayload(rawData);
    assert.strictEqual(sanitized.aadhaar, 'XXXX-XXXX-1012');
    assert.strictEqual(sanitized.profile.rawId, 'XXXX-XXXX-1012');
  });

  it('2. sanitizeOfflinePayload strips passwords, secrets, and auth tokens', () => {
    const sensitiveData = {
      username: 'citizen1',
      password: 'SuperSecretPassword123!',
      apiToken: 'secret_jwt_token',
      nested: {
        userSecret: 'confidential_key',
        allowedField: 'safe data',
      },
    };

    const sanitized = offlineSecurityService.sanitizeOfflinePayload(sensitiveData);
    assert.strictEqual((sanitized as any).password, undefined);
    assert.strictEqual((sanitized as any).apiToken, undefined);
    assert.strictEqual((sanitized as any).nested.userSecret, undefined);
    assert.strictEqual((sanitized as any).nested.allowedField, 'safe data');
  });

  it('3. User-isolated storage keys and TTL expiration enforcement', async () => {
    const userA = 'user_aaa';
    const userB = 'user_bbb';

    // Store for userA with very short TTL
    await offlineSecurityService.setSecureItem(userA, 'draft_form', { field: 'valueA' }, { ttlMs: 50 });

    // UserA can read within TTL
    const readA = await offlineSecurityService.getSecureItem(userA, 'draft_form');
    assert.deepStrictEqual(readA, { field: 'valueA' });

    // UserB cannot read UserA data
    const readB = await offlineSecurityService.getSecureItem(userB, 'draft_form');
    assert.strictEqual(readB, null);

    // After TTL expires, item is removed
    await new Promise((resolve) => setTimeout(resolve, 60));
    const expiredRead = await offlineSecurityService.getSecureItem(userA, 'draft_form');
    assert.strictEqual(expiredRead, null);
  });

  it('4. purgeUserData clears all stored items for target user without touching other users', async () => {
    const userA = 'user_alice';
    const userB = 'user_bob';

    await offlineSecurityService.setSecureItem(userA, 'data1', { a: 1 });
    await offlineSecurityService.setSecureItem(userA, 'data2', { a: 2 });
    await offlineSecurityService.setSecureItem(userB, 'data1', { b: 1 });

    // Purge userA
    await offlineSecurityService.purgeUserData(userA);

    assert.strictEqual(await offlineSecurityService.getSecureItem(userA, 'data1'), null);
    assert.strictEqual(await offlineSecurityService.getSecureItem(userA, 'data2'), null);
    assert.deepStrictEqual(await offlineSecurityService.getSecureItem(userB, 'data1'), { b: 1 });
  });
});
