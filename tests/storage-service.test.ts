import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { sanitizeFileName } from '../services/storageService';

describe('Storage Service File Sanitization Tests', () => {
  it('1. Strips path traversal sequences from file names', () => {
    const raw = '../../../etc/passwd.pdf';
    const sanitized = sanitizeFileName(raw);
    assert.strictEqual(sanitized, 'passwd.pdf');
    assert.strictEqual(sanitized.includes('/'), false);
    assert.strictEqual(sanitized.includes('\\'), false);
    assert.strictEqual(sanitized.includes('..'), false);
  });

  it('2. Strips Windows-style path separators', () => {
    const raw = 'C:\\Windows\\System32\\calc.pdf';
    const sanitized = sanitizeFileName(raw);
    assert.strictEqual(sanitized, 'calc.pdf');
    assert.strictEqual(sanitized.includes('\\'), false);
  });

  it('3. Replaces special and illegal characters with underscores', () => {
    const raw = 'my file @#$ name! (1).pdf';
    const sanitized = sanitizeFileName(raw);
    assert.strictEqual(sanitized, 'my_file_____name___1_.pdf');
    assert.strictEqual(/^[a-zA-Z0-9._-]+$/.test(sanitized), true);
  });

  it('4. Rejects disallowed extensions (.exe, .sh, .bat, .php)', () => {
    assert.throws(() => sanitizeFileName('malicious.exe'), /Disallowed file extension/);
    assert.throws(() => sanitizeFileName('script.sh'), /Disallowed file extension/);
    assert.throws(() => sanitizeFileName('shell.php'), /Disallowed file extension/);
  });

  it('5. Allows valid extensions (.pdf, .jpg, .jpeg, .png)', () => {
    assert.strictEqual(sanitizeFileName('document.pdf'), 'document.pdf');
    assert.strictEqual(sanitizeFileName('photo.jpg'), 'photo.jpg');
    assert.strictEqual(sanitizeFileName('photo.jpeg'), 'photo.jpeg');
    assert.strictEqual(sanitizeFileName('photo.png'), 'photo.png');
  });

  it('6. Truncates excessively long file names while preserving extension', () => {
    const longBase = 'a'.repeat(200);
    const sanitized = sanitizeFileName(`${longBase}.pdf`);
    assert.strictEqual(sanitized.length <= 100, true);
    assert.strictEqual(sanitized.endsWith('.pdf'), true);
  });
});
