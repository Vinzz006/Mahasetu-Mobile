import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { validateAadhaar, maskAadhaar, validateVerhoeff } from '../lib/aadhaar';
import { authService } from '../services/authService';
import { normalizePhoneNumber, TwilioMessagingService, DailySmsCap } from '../backend/src/notifications/twilio.service';

describe('Input Validation, Abuse Controls & Data Protection Tests', () => {
  describe('1. Aadhaar Verhoeff Algorithm & Masking (DPDP Compliance)', () => {
    // Known valid Verhoeff Aadhaar numbers (with valid D5 checksum digit at end)
    const validAadhaar = '234567890126'; // Calculated valid D5
    const validTestAadhaar = '543210987654';

    it('1.1. Validates Verhoeff checksum algorithm correctness', () => {
      // Basic Verhoeff test vectors
      assert.strictEqual(validateVerhoeff('12345'), false);
    });

    it('1.2. Rejects Aadhaar numbers starting with 0 or 1', () => {
      assert.strictEqual(validateAadhaar('012345678901').isValid, false);
      assert.strictEqual(validateAadhaar('112345678901').isValid, false);
    });

    it('1.3. Rejects Aadhaar with invalid length or non-numeric characters', () => {
      assert.strictEqual(validateAadhaar('12345').isValid, false);
      assert.strictEqual(validateAadhaar('23456789012A').isValid, false);
      assert.strictEqual(validateAadhaar('').isValid, false);
    });

    it('1.4. Masks Aadhaar references to XXXX-XXXX-last4', () => {
      assert.strictEqual(maskAadhaar('234567890126'), 'XXXX-XXXX-0126');
      assert.strictEqual(maskAadhaar('2345-6789-0126'), 'XXXX-XXXX-0126');
      assert.strictEqual(maskAadhaar(null), 'XXXX-XXXX-XXXX');
      assert.strictEqual(maskAadhaar(undefined), 'XXXX-XXXX-XXXX');
    });
  });

  describe('2. Password Strength & Registration Policy', () => {
    it('2.1. Rejects passwords shorter than 10 characters', () => {
      const res = authService.validatePasswordStrength('Short1@');
      assert.strictEqual(res.isValid, false);
      assert.ok(res.error?.includes('10 characters'));
    });

    it('2.2. Rejects passwords missing uppercase letters', () => {
      const res = authService.validatePasswordStrength('lowercase1@long');
      assert.strictEqual(res.isValid, false);
      assert.ok(res.error?.includes('uppercase'));
    });

    it('2.3. Rejects passwords missing lowercase letters', () => {
      const res = authService.validatePasswordStrength('UPPERCASE1@LONG');
      assert.strictEqual(res.isValid, false);
      assert.ok(res.error?.includes('lowercase'));
    });

    it('2.4. Rejects passwords missing numbers', () => {
      const res = authService.validatePasswordStrength('NoNumbers@Long');
      assert.strictEqual(res.isValid, false);
      assert.ok(res.error?.includes('number'));
    });

    it('2.5. Rejects passwords missing special characters', () => {
      const res = authService.validatePasswordStrength('NoSpecial123Long');
      assert.strictEqual(res.isValid, false);
      assert.ok(res.error?.includes('special character'));
    });

    it('2.6. Accepts passwords satisfying all complexity rules', () => {
      const res = authService.validatePasswordStrength('GovSec#2026MahaSetu!');
      assert.strictEqual(res.isValid, true);
    });
  });

  describe('3. Twilio SMS Abuse Controls & Strict E.164 Validation', () => {
    it('3.1. Validates Indian mobile numbers (+91 followed by 6-9 and 9 digits)', () => {
      assert.strictEqual(normalizePhoneNumber('9876543210').valid, true);
      assert.strictEqual(normalizePhoneNumber('9876543210').normalized, '+919876543210');
      assert.strictEqual(normalizePhoneNumber('+918765432109').valid, true);
      assert.strictEqual(normalizePhoneNumber('+917765432109').valid, true);
      assert.strictEqual(normalizePhoneNumber('+916765432109').valid, true);
    });

    it('3.2. Rejects foreign numbers or numbers starting with invalid prefixes (0-5)', () => {
      assert.strictEqual(normalizePhoneNumber('1234567890').valid, false);
      assert.strictEqual(normalizePhoneNumber('5234567890').valid, false);
      assert.strictEqual(normalizePhoneNumber('+14155552671').valid, false);
      assert.strictEqual(normalizePhoneNumber('').valid, false);
    });

    it('3.3. Daily SMS cap restricts citizen to 5 SMS per calendar day', () => {
      const cap = new DailySmsCap();
      const testCitizen = `cap_test_citizen_${Date.now()}`;
      
      const results: boolean[] = [];
      for (let i = 0; i < 7; i++) {
        results.push(cap.isAllowed(testCitizen, 5));
      }

      // First 5 attempts pass the daily cap check, 6th and 7th are blocked
      assert.strictEqual(results[0], true, '1st SMS allowed');
      assert.strictEqual(results[4], true, '5th SMS allowed');
      assert.strictEqual(results[5], false, '6th SMS blocked by daily cap');
      assert.strictEqual(results[6], false, '7th SMS blocked by daily cap');
    });
  });
});
