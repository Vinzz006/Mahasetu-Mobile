/**
 * Aadhaar Number Validation (Verhoeff Checksum Algorithm), Masking, and Hashing
 * In compliance with Aadhaar Act and DPDP Act 2023.
 */

// Dihedral group D5 multiplication table
const d: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// Permutation table
const p: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/**
 * Validates a number string using the Verhoeff algorithm.
 */
export function validateVerhoeff(numStr: string): boolean {
  if (!numStr || !/^\d+$/.test(numStr)) return false;
  let c = 0;
  const digits = numStr.split('').reverse().map(Number);
  for (let i = 0; i < digits.length; i++) {
    c = d[c][p[i % 8][digits[i]]];
  }
  return c === 0;
}

/**
 * Validates a 12-digit Indian Aadhaar number.
 * - Exactly 12 digits
 * - Cannot start with 0 or 1
 * - Must pass Verhoeff checksum
 */
export function validateAadhaar(aadhaar: string): { isValid: boolean; error?: string } {
  if (!aadhaar) {
    return { isValid: false, error: 'Aadhaar number is required.' };
  }
  const clean = aadhaar.replace(/[\s-]/g, '');
  if (!/^\d{12}$/.test(clean)) {
    return { isValid: false, error: 'Aadhaar number must be exactly 12 digits.' };
  }
  if (clean.startsWith('0') || clean.startsWith('1')) {
    return { isValid: false, error: 'Aadhaar number cannot start with 0 or 1.' };
  }
  if (!validateVerhoeff(clean)) {
    return { isValid: false, error: 'Invalid Aadhaar checksum (Verhoeff check failed).' };
  }
  return { isValid: true };
}

/**
 * Masks an Aadhaar number to display only XXXX-XXXX-1234.
 */
export function maskAadhaar(aadhaarOrRef?: string | null): string {
  if (!aadhaarOrRef) return 'XXXX-XXXX-XXXX';
  const clean = aadhaarOrRef.replace(/[\s-]/g, '');
  if (clean.length >= 4) {
    const last4 = clean.slice(-4);
    return `XXXX-XXXX-${last4}`;
  }
  return 'XXXX-XXXX-XXXX';
}
