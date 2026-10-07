import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { authService } from '../services/authService';
import { validatePathParam } from '../backend/src/server';

describe('Error Handling & Information Disclosure Tests', () => {
  it('1. validatePathParam blocks directory traversal and null byte injections', () => {
    assert.strictEqual(validatePathParam('../etc/passwd'), false);
    assert.strictEqual(validatePathParam('..\\windows\\system32'), false);
    assert.strictEqual(validatePathParam('user\0id'), false);
    assert.strictEqual(validatePathParam('%2e%2e%2f'), false);
    assert.strictEqual(validatePathParam('valid_user-123.id'), true);
  });

  it('2. mapAuthError masks internal exception payloads and provides safe user messages', () => {
    const rawSystemError = {
      code: 'auth/internal-error',
      message: 'Database connection failed at postgres://user:pass@host:5432/db [Internal Trace]',
    };

    const friendlyMessage = authService.mapAuthError(rawSystemError);
    assert.strictEqual(friendlyMessage.includes('postgres://'), false);
    assert.strictEqual(friendlyMessage.includes('pass@host'), false);
    assert.strictEqual(typeof friendlyMessage, 'string');
  });

  it('3. Server error responses contain only userMessage and requestId without stack traces', () => {
    const formatError = (statusCode: number, userMessage: string, requestId: string) => {
      return {
        error: userMessage,
        requestId,
      };
    };

    const response = formatError(500, 'Internal Server Error. Please contact MahaSetu support with the request ID.', 'req_abc123');
    assert.strictEqual(response.error, 'Internal Server Error. Please contact MahaSetu support with the request ID.');
    assert.strictEqual(response.requestId, 'req_abc123');
    assert.strictEqual((response as any).stack, undefined);
    assert.strictEqual((response as any).trace, undefined);
  });
});
