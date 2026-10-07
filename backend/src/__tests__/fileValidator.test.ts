import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { validateFileMagicBytes } from '../lib/fileSecurityValidator';

describe('File Security & Binary Magic Byte Validator Tests', () => {
  it('1. Validates authentic PDF binary stream', () => {
    const validPdfBuffer = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const result = validateFileMagicBytes(validPdfBuffer, 'application/pdf');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.detectedType, 'pdf');
  });

  it('2. Validates authentic PNG binary stream', () => {
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const result = validateFileMagicBytes(validPngBuffer, 'image/png');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.detectedType, 'png');
  });

  it('3. Validates authentic JPEG binary stream', () => {
    const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const result = validateFileMagicBytes(validJpegBuffer, 'image/jpeg');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.detectedType, 'jpeg');
  });

  it('4. Rejects file with declared PDF but containing plain text / script', () => {
    const fakePdfBuffer = Buffer.from('Hello world this is just a plain text file pretending to be a pdf');
    const result = validateFileMagicBytes(fakePdfBuffer, 'application/pdf');
    assert.strictEqual(result.isValid, false);
    assert.ok(result.error?.includes('Prohibited or unrecognized'));
  });

  it('5. Rejects polyglot file containing PDF magic bytes followed by embedded HTML/JavaScript payload', () => {
    const polyglotBuffer = Buffer.from('%PDF-1.4\n<html><script>alert("xss")</script></html>');
    const result = validateFileMagicBytes(polyglotBuffer, 'application/pdf');
    assert.strictEqual(result.isValid, false);
    assert.ok(result.error?.includes('Dangerous script pattern detected'));
  });

  it('6. Rejects buffer exceeding 10 MB statutory size limit', () => {
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
    const result = validateFileMagicBytes(oversizedBuffer);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.error?.includes('exceeds statutory size limit'));
  });
});
