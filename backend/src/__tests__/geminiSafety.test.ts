import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { sanitizeUserPrompt, sanitizeAiOutput } from '../services/gemini.service';

describe('Gemini AI Safety, Sanitization & Isolation Tests', () => {
  it('1. sanitizeUserPrompt strips control characters and citizen_input boundary tags', () => {
    const raw = 'Hello \x00\x08world <citizen_input>test</citizen_input>';
    const cleaned = sanitizeUserPrompt(raw);
    assert.strictEqual(cleaned.includes('\x00'), false);
    assert.strictEqual(cleaned.includes('<citizen_input>'), false);
    assert.strictEqual(cleaned.includes('</citizen_input>'), false);
    assert.strictEqual(cleaned, 'Hello world test');
  });

  it('2. sanitizeUserPrompt redacts raw Aadhaar numbers from prompt', () => {
    const promptWithAadhaar = 'My Aadhaar number is 987654321012. What is my status?';
    const cleaned = sanitizeUserPrompt(promptWithAadhaar);
    assert.strictEqual(cleaned.includes('987654321012'), false);
    assert.strictEqual(cleaned.includes('[AADHAAR_REDACTED]'), true);
  });

  it('3. sanitizeUserPrompt redacts PAN numbers from prompt', () => {
    const promptWithPan = 'My PAN number is ABCDE1234F.';
    const cleaned = sanitizeUserPrompt(promptWithPan);
    assert.strictEqual(cleaned.includes('ABCDE1234F'), false);
    assert.strictEqual(cleaned.includes('[PAN_REDACTED]'), true);
  });

  it('4. sanitizeUserPrompt truncates input exceeding 2000 characters', () => {
    const longPrompt = 'A'.repeat(2500);
    const cleaned = sanitizeUserPrompt(longPrompt);
    assert.strictEqual(cleaned.length, 2000);
  });

  it('5. sanitizeAiOutput scrubs accidental backend keys/credentials', () => {
    const aiTextWithKey = 'Here is your response AIzaSyB12345678901234567890123456789012 and GEMINI_API_KEY=secret_key_123';
    const sanitized = sanitizeAiOutput(aiTextWithKey);
    assert.strictEqual(sanitized.includes('AIzaSyB12345678901234567890123456789012'), false);
    assert.strictEqual(sanitized.includes('secret_key_123'), false);
    assert.strictEqual(sanitized.includes('[SECRET_REDACTED]'), true);
    assert.strictEqual(sanitized.includes('[CONFIG_REDACTED]'), true);
  });
});
