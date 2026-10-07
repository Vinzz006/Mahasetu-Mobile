import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { authService } from '../services/authService';

describe('Session Management & Token Lifecycle Tests', () => {
  it('1. validatePasswordStrength enforces government-grade security requirements', () => {
    // Too short
    assert.strictEqual(authService.validatePasswordStrength('Short1!').isValid, false);

    // Missing uppercase
    assert.strictEqual(authService.validatePasswordStrength('lowercase123!').isValid, false);

    // Missing lowercase
    assert.strictEqual(authService.validatePasswordStrength('UPPERCASE123!').isValid, false);

    // Missing number
    assert.strictEqual(authService.validatePasswordStrength('NoNumbersHere!').isValid, false);

    // Missing special character
    assert.strictEqual(authService.validatePasswordStrength('NoSpecialChar123').isValid, false);

    // Valid compliant password
    assert.strictEqual(authService.validatePasswordStrength('ValidSecurePass123!').isValid, true);
  });

  it('2. reauthenticate throws descriptive error when no active user session exists', async () => {
    await assert.rejects(
      async () => {
        await authService.reauthenticate('SomePassword123!');
      },
      {
        message: /No authenticated user session found/i,
      }
    );
  });

  it('3. mapAuthError maps Firebase error codes to safe user-friendly guidance', () => {
    const invalidCredMsg = authService.mapAuthError({ code: 'auth/invalid-credential' });
    assert.match(invalidCredMsg, /Invalid email address or password/i);

    const rateLimitMsg = authService.mapAuthError({ code: 'auth/too-many-requests' });
    assert.match(rateLimitMsg, /temporarily disabled due to multiple failed login attempts/i);

    const disabledMsg = authService.mapAuthError({ code: 'auth/user-disabled' });
    assert.match(disabledMsg, /account has been disabled/i);
  });
});
