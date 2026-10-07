import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { scanObjectForPiiLeaks, anonymizeUserData } from '../lib/dpdpScanner';
import { validateVerhoeffChecksum, maskAadhaarReference, findAadhaarLeaksInPayload } from '../lib/aadhaar';

describe('DPDP Act (2023) Privacy & Aadhaar Data Protection Audit Tests', () => {
  describe('1. Verhoeff Algorithm & Aadhaar Reference Masking', () => {
    it('1.1. Validates authentic Verhoeff checksums', () => {
      // 987654321012 has valid checksum 2
      assert.strictEqual(validateVerhoeffChecksum('987654321012'), true);
      assert.strictEqual(validateVerhoeffChecksum('987654321013'), false);
    });

    it('1.2. Rejects Aadhaar numbers with invalid length or non-digits', () => {
      assert.strictEqual(validateVerhoeffChecksum('12345'), false);
      assert.strictEqual(validateVerhoeffChecksum('98765432101A'), false);
    });

    it('1.3. Masks Aadhaar references to XXXX-XXXX-last4', () => {
      assert.strictEqual(maskAadhaarReference('987654321012'), 'XXXX-XXXX-1012');
      assert.strictEqual(maskAadhaarReference('XXXX-XXXX-1012'), 'XXXX-XXXX-1012');
    });
  });

  describe('2. Recursive Payload Leak Scanner', () => {
    it('2.1. Flags unmasked Aadhaar in deep nested JSON objects', () => {
      const payload = {
        applicant: {
          profile: {
            metadata: {
              customNote: 'Aadhaar copy received: 987654321012 on file',
            },
          },
        },
      };

      const result = scanObjectForPiiLeaks(payload);
      assert.strictEqual(result.hasLeaks, true);
      assert.strictEqual(result.leaks.length, 1);
      assert.strictEqual(result.leaks[0].leakType, 'RAW_AADHAAR');
    });

    it('2.2. Flags unmasked Aadhaar in array elements', () => {
      const payload = {
        documents: ['doc1.pdf', 'Contains Aadhaar 987654321012 in remarks'],
      };

      const result = scanObjectForPiiLeaks(payload);
      assert.strictEqual(result.hasLeaks, true);
      assert.strictEqual(result.leaks[0].leakType, 'RAW_AADHAAR');
    });

    it('2.3. Passes clean payload with masked Aadhaar references', () => {
      const cleanPayload = {
        identity: {
          aadhaarReference: 'XXXX-XXXX-1012',
          panCardNumber: 'ABCDE1234F',
        },
      };

      const result = scanObjectForPiiLeaks(cleanPayload);
      assert.strictEqual(result.hasLeaks, false);
      assert.strictEqual(result.leaks.length, 0);
    });
  });

  describe('3. Right to Erasure / Anonymization Transformation', () => {
    it('3.1. Generates clean, PII-free anonymized user record', () => {
      const uid = 'citizen_to_be_erased_12345';
      const anonymized = anonymizeUserData(uid);

      assert.strictEqual(anonymized.name, 'Anonymized Citizen');
      assert.strictEqual(anonymized.phoneNumber, null);
      assert.strictEqual(anonymized.isErased, true);
      assert.strictEqual(anonymized.status, 'ERASED');
      assert.strictEqual(anonymized.role, 'erased');
      assert.strictEqual(anonymized.isVerified, false);
      assert.ok(anonymized.erasedAt);
    });
  });
});
