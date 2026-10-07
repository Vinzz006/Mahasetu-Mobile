/**
 * File Security & Binary Magic Byte Validator
 * Prevents disguised executables, HTML/XSS polyglots, and mime spoofing.
 */

export interface FileValidationResult {
  isValid: boolean;
  detectedType?: 'pdf' | 'png' | 'jpeg';
  error?: string;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Validates file buffer against statutory allowed MIME types and binary signatures.
 */
export function validateFileMagicBytes(
  buffer: Buffer,
  declaredType?: string
): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: 'Empty file buffer received.' };
  }

  if (buffer.length > MAX_FILE_BYTES) {
    return { isValid: false, error: 'File exceeds statutory size limit of 10 MB.' };
  }

  // Check PDF signature: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  const isPdf =
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d;

  // Check PNG signature: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  // Check JPEG signature: 0xFF 0xD8 0xFF
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  let detectedType: 'pdf' | 'png' | 'jpeg' | undefined;
  if (isPdf) detectedType = 'pdf';
  else if (isPng) detectedType = 'png';
  else if (isJpeg) detectedType = 'jpeg';

  if (!detectedType) {
    return {
      isValid: false,
      error: 'Prohibited or unrecognized file format: only authentic PDF, PNG, and JPEG documents are permitted.',
    };
  }

  // Scan initial bytes for dangerous HTML / script vectors (e.g. polyglot attack disguised with magic bytes)
  const headerPreview = buffer.slice(0, Math.min(buffer.length, 2048)).toString('utf8').toLowerCase();
  const dangerousPatterns = ['<script', '<html', 'javascript:', 'onload=', 'onerror=', '<?php', '#!/bin/'];
  for (const pattern of dangerousPatterns) {
    if (headerPreview.includes(pattern)) {
      return {
        isValid: false,
        error: `Dangerous script pattern detected in file header: "${pattern}"`,
      };
    }
  }

  // If declaredType is passed, verify alignment
  if (declaredType) {
    const cleanDeclared = declaredType.toLowerCase().replace(/^(application|image)\//, '');
    if (cleanDeclared === 'jpg') {
      if (detectedType !== 'jpeg') {
        return {
          isValid: false,
          detectedType,
          error: `Declared format "${declaredType}" does not match binary signature of "${detectedType}".`,
        };
      }
    } else if (cleanDeclared !== detectedType) {
      return {
        isValid: false,
        detectedType,
        error: `Declared format "${declaredType}" does not match binary signature of "${detectedType}".`,
      };
    }
  }

  return { isValid: true, detectedType };
}
