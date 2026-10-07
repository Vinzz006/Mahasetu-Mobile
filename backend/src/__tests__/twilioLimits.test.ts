import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  normalizePhoneNumber,
  maskPhoneNumber,
  DailySmsCap,
} from '../notifications/twilio.service';

describe('Twilio E.164 & Daily Limit Abuse Protection Tests', () => {
  let cap: DailySmsCap;

  beforeEach(() => {
    cap = new DailySmsCap();
  });

  it('1. Validates Indian mobile numbers (+916XXXXXXXXX to +919XXXXXXXXX)', () => {
    const valid1 = normalizePhoneNumber('+919876543210');
    assert.strictEqual(valid1.valid, true);
    assert.strictEqual(valid1.normalized, '+919876543210');

    const valid2 = normalizePhoneNumber('9876543210');
    assert.strictEqual(valid2.valid, true);
    assert.strictEqual(valid2.normalized, '+919876543210');

    const valid3 = normalizePhoneNumber('+917000000000');
    assert.strictEqual(valid3.valid, true);
    assert.strictEqual(valid3.normalized, '+917000000000');
  });

  it('2. Rejects foreign or malformed mobile numbers', () => {
    const res1 = normalizePhoneNumber('+14155552671');
    assert.strictEqual(res1.valid, false);

    const res2 = normalizePhoneNumber('+915123456789'); // Prefix 5 is invalid
    assert.strictEqual(res2.valid, false);

    const res3 = normalizePhoneNumber('+910123456789'); // Prefix 0 is invalid
    assert.strictEqual(res3.valid, false);

    const res4 = normalizePhoneNumber('12345');
    assert.strictEqual(res4.valid, false);
  });

  it('3. Masks phone numbers correctly for zero-PII audit compliance', () => {
    const masked = maskPhoneNumber('+919876543210');
    assert.strictEqual(masked.startsWith('+9198'), true);
    assert.strictEqual(masked.endsWith('10'), true);
    assert.strictEqual(masked.includes('765432'), false);
  });

  it('4. Daily SMS cap restricts transactions to 5 SMS per calendar day', () => {
    const id = 'citizen_sms_test_uid';
    assert.strictEqual(cap.isAllowed(id, 5), true); // 1
    assert.strictEqual(cap.isAllowed(id, 5), true); // 2
    assert.strictEqual(cap.isAllowed(id, 5), true); // 3
    assert.strictEqual(cap.isAllowed(id, 5), true); // 4
    assert.strictEqual(cap.isAllowed(id, 5), true); // 5
    assert.strictEqual(cap.isAllowed(id, 5), false); // 6th rejected
  });
});
