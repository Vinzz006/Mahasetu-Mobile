import { validateAadhaar, maskAadhaar, containsRawAadhaarPattern } from './aadhaar';

export interface ValidationResult {
  valid: boolean;
  sanitized?: Record<string, any>;
  errors?: string[];
}

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'personalDetails',
  'address',
  'contact',
  'family',
  'identity',
  'education',
  'bank',
  'passport',
  'departmentDetails',
  // Note: userId, createdAt, updatedAt, certificationStatus, certifiedBy, certifiedAt, isVerified
  // from client will be ignored or rejected if non-standard keys are sent.
]);

const ALLOWED_KEYS: Record<string, Set<string>> = {
  personalDetails: new Set([
    'fullLegalName',
    'dateOfBirth',
    'gender',
    'maritalStatus',
    'community',
    'age',
    'fatherName',
    'motherName',
    'bloodGroup',
  ]),
  address: new Set([
    'address',
    'city',
    'district',
    'state',
    'pinCode',
  ]),
  contact: new Set([
    'phoneNumber',
    'emailAddress',
    'emergencyContact',
  ]),
  family: new Set([
    'fatherName',
    'motherName',
    'guardianName',
    'spouseName',
    'familyMembers',
  ]),
  identity: new Set([
    'aadhaarReference',
    'aadhaarLast4',
    'panCardNumber',
    'voterId',
    'rationCardNumber',
    'drivingLicenseNumber',
  ]),
  education: new Set([
    'educationalQualification',
    'institutionName',
    'yearOfPassing',
    'fieldOfStudy',
  ]),
  bank: new Set([
    'bankName',
    'accountHolderName',
    'accountNumber',
    'ifscCode',
    'branchName',
  ]),
  passport: new Set([
    'hasPassport',
    'passportNumber',
    'expiryDate',
    'documentPath',
    'fileName',
    'fileSize',
    'uploadedAt',
  ]),
};

export function validateResidentProfilePayload(rawPayload: any, authUid: string): ValidationResult {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return { valid: false, errors: ['Request body must be a valid JSON object.'] };
  }

  const errors: string[] = [];

  // Check top-level keys
  for (const key of Object.keys(rawPayload)) {
    // Ignored client fields that we discard safely
    if (['userId', 'createdAt', 'updatedAt', 'isComplete', 'completionPercentage', 'certificationStatus', 'certifiedBy', 'certifiedAt', 'isVerified'].includes(key)) {
      continue;
    }
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      errors.push(`Unknown or prohibited top-level field: "${key}"`);
    }
  }

  // Check for raw 12-digit Aadhaar pattern leaks across the entire payload EXCEPT identity.aadhaarReference
  const payloadToScan = JSON.parse(JSON.stringify(rawPayload));
  let incomingRawAadhaar: string | null = null;

  if (payloadToScan.identity?.aadhaarReference) {
    const rawRef = String(payloadToScan.identity.aadhaarReference).replace(/[\s-]/g, '');
    if (/^\d{12}$/.test(rawRef)) {
      incomingRawAadhaar = rawRef;
      // Temporarily replace with placeholder during recursive scan so it doesn't trip the scanner
      payloadToScan.identity.aadhaarReference = 'XXXX-XXXX-XXXX';
    }
  }

  const leakCheck = containsRawAadhaarPattern(payloadToScan);
  if (leakCheck.found) {
    errors.push(`Prohibited 12-digit Aadhaar number detected in unauthorized field: ${leakCheck.path || 'payload'}`);
  }

  const sanitized: Record<string, any> = {};

  // 1. personalDetails
  if (rawPayload.personalDetails) {
    if (typeof rawPayload.personalDetails !== 'object' || Array.isArray(rawPayload.personalDetails)) {
      errors.push('Field "personalDetails" must be an object.');
    } else {
      const p = rawPayload.personalDetails;
      for (const k of Object.keys(p)) {
        if (!ALLOWED_KEYS.personalDetails.has(k)) {
          errors.push(`Unknown field "personalDetails.${k}"`);
        }
      }
      sanitized.personalDetails = {};
      if (p.fullLegalName !== undefined) {
        if (typeof p.fullLegalName !== 'string' || p.fullLegalName.length > 100) {
          errors.push('"personalDetails.fullLegalName" must be a string up to 100 characters.');
        } else {
          sanitized.personalDetails.fullLegalName = p.fullLegalName.trim();
        }
      }
      if (p.dateOfBirth !== undefined) {
        if (typeof p.dateOfBirth !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.dateOfBirth)) {
          errors.push('"personalDetails.dateOfBirth" must be in YYYY-MM-DD format.');
        } else {
          const dobDate = new Date(p.dateOfBirth);
          if (isNaN(dobDate.getTime()) || dobDate > new Date()) {
            errors.push('"personalDetails.dateOfBirth" cannot be a future or invalid date.');
          } else {
            sanitized.personalDetails.dateOfBirth = p.dateOfBirth;
          }
        }
      }
      if (p.gender !== undefined) {
        const allowedGenders = ['MALE', 'FEMALE', 'OTHER', 'TRANSGENDER'];
        if (typeof p.gender !== 'string' || !allowedGenders.includes(p.gender.toUpperCase())) {
          errors.push(`"personalDetails.gender" must be one of ${allowedGenders.join(', ')}`);
        } else {
          sanitized.personalDetails.gender = p.gender.toUpperCase();
        }
      }
      if (p.maritalStatus !== undefined) {
        sanitized.personalDetails.maritalStatus = typeof p.maritalStatus === 'string' ? p.maritalStatus.substring(0, 50).trim() : null;
      }
      if (p.community !== undefined) {
        sanitized.personalDetails.community = typeof p.community === 'string' ? p.community.substring(0, 50).trim() : null;
      }
      if (p.age !== undefined) {
        const numAge = Number(p.age);
        if (isNaN(numAge) || numAge < 0 || numAge > 130) {
          errors.push('"personalDetails.age" must be a valid number between 0 and 130.');
        } else {
          sanitized.personalDetails.age = Math.floor(numAge);
        }
      }
      if (p.fatherName !== undefined) sanitized.personalDetails.fatherName = String(p.fatherName).substring(0, 100);
      if (p.motherName !== undefined) sanitized.personalDetails.motherName = String(p.motherName).substring(0, 100);
      if (p.bloodGroup !== undefined) sanitized.personalDetails.bloodGroup = String(p.bloodGroup).substring(0, 10);
    }
  }

  // 2. address
  if (rawPayload.address) {
    if (typeof rawPayload.address !== 'object' || Array.isArray(rawPayload.address)) {
      errors.push('Field "address" must be an object.');
    } else {
      const a = rawPayload.address;
      for (const k of Object.keys(a)) {
        if (!ALLOWED_KEYS.address.has(k)) {
          errors.push(`Unknown field "address.${k}"`);
        }
      }
      sanitized.address = {};
      if (a.address !== undefined) sanitized.address.address = typeof a.address === 'string' ? a.address.substring(0, 300).trim() : '';
      if (a.city !== undefined) sanitized.address.city = typeof a.city === 'string' ? a.city.substring(0, 100).trim() : '';
      if (a.district !== undefined) sanitized.address.district = typeof a.district === 'string' ? a.district.substring(0, 100).trim() : '';
      if (a.state !== undefined) sanitized.address.state = typeof a.state === 'string' ? a.state.substring(0, 100).trim() : '';
      if (a.pinCode !== undefined) {
        const pin = String(a.pinCode).trim();
        if (pin && !/^\d{6}$/.test(pin)) {
          errors.push('"address.pinCode" must be exactly 6 digits.');
        } else {
          sanitized.address.pinCode = pin;
        }
      }
    }
  }

  // 3. contact
  if (rawPayload.contact) {
    if (typeof rawPayload.contact !== 'object' || Array.isArray(rawPayload.contact)) {
      errors.push('Field "contact" must be an object.');
    } else {
      const c = rawPayload.contact;
      for (const k of Object.keys(c)) {
        if (!ALLOWED_KEYS.contact.has(k)) {
          errors.push(`Unknown field "contact.${k}"`);
        }
      }
      sanitized.contact = {};
      if (c.phoneNumber !== undefined) sanitized.contact.phoneNumber = String(c.phoneNumber).substring(0, 20).trim();
      if (c.emailAddress !== undefined) sanitized.contact.emailAddress = String(c.emailAddress).substring(0, 100).trim();
      if (c.emergencyContact !== undefined) sanitized.contact.emergencyContact = String(c.emergencyContact).substring(0, 100).trim();
    }
  }

  // 4. family
  if (rawPayload.family) {
    if (typeof rawPayload.family !== 'object' || Array.isArray(rawPayload.family)) {
      errors.push('Field "family" must be an object.');
    } else {
      const f = rawPayload.family;
      for (const k of Object.keys(f)) {
        if (!ALLOWED_KEYS.family.has(k)) {
          errors.push(`Unknown field "family.${k}"`);
        }
      }
      sanitized.family = {};
      if (f.fatherName !== undefined) sanitized.family.fatherName = String(f.fatherName).substring(0, 100).trim();
      if (f.motherName !== undefined) sanitized.family.motherName = String(f.motherName).substring(0, 100).trim();
      if (f.guardianName !== undefined) sanitized.family.guardianName = String(f.guardianName).substring(0, 100).trim();
      if (f.spouseName !== undefined) sanitized.family.spouseName = String(f.spouseName).substring(0, 100).trim();
      if (f.familyMembers !== undefined) {
        if (Array.isArray(f.familyMembers)) {
          sanitized.family.familyMembers = f.familyMembers.slice(0, 20).map((m: any) => ({
            name: typeof m?.name === 'string' ? m.name.substring(0, 100) : '',
            relation: typeof m?.relation === 'string' ? m.relation.substring(0, 50) : '',
            age: typeof m?.age === 'number' ? m.age : undefined,
          }));
        } else {
          errors.push('"family.familyMembers" must be an array.');
        }
      }
    }
  }

  // 5. identity
  if (rawPayload.identity) {
    if (typeof rawPayload.identity !== 'object' || Array.isArray(rawPayload.identity)) {
      errors.push('Field "identity" must be an object.');
    } else {
      const id = rawPayload.identity;
      for (const k of Object.keys(id)) {
        if (!ALLOWED_KEYS.identity.has(k)) {
          errors.push(`Unknown field "identity.${k}"`);
        }
      }
      sanitized.identity = {};

      // Handle Aadhaar verification and server-side mandatory masking
      if (incomingRawAadhaar) {
        const vRes = validateAadhaar(incomingRawAadhaar);
        if (!vRes.isValid) {
          errors.push(vRes.error || 'Invalid Aadhaar number checksum.');
        } else {
          sanitized.identity.aadhaarLast4 = incomingRawAadhaar.slice(-4);
          sanitized.identity.aadhaarReference = maskAadhaar(incomingRawAadhaar);
        }
      } else if (id.aadhaarReference) {
        const refStr = String(id.aadhaarReference).trim();
        sanitized.identity.aadhaarReference = maskAadhaar(refStr);
        if (id.aadhaarLast4) {
          sanitized.identity.aadhaarLast4 = String(id.aadhaarLast4).substring(0, 4);
        }
      }

      if (id.panCardNumber !== undefined) {
        const pan = String(id.panCardNumber).trim().toUpperCase();
        if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
          errors.push('Invalid PAN card format: must match 5 letters, 4 numbers, 1 letter.');
        } else {
          sanitized.identity.panCardNumber = pan;
        }
      }
      if (id.voterId !== undefined) sanitized.identity.voterId = String(id.voterId).substring(0, 50).trim();
      if (id.rationCardNumber !== undefined) sanitized.identity.rationCardNumber = String(id.rationCardNumber).substring(0, 50).trim();
      if (id.drivingLicenseNumber !== undefined) sanitized.identity.drivingLicenseNumber = String(id.drivingLicenseNumber).substring(0, 50).trim();
    }
  }

  // 6. education
  if (rawPayload.education) {
    if (typeof rawPayload.education !== 'object' || Array.isArray(rawPayload.education)) {
      errors.push('Field "education" must be an object.');
    } else {
      const e = rawPayload.education;
      for (const k of Object.keys(e)) {
        if (!ALLOWED_KEYS.education.has(k)) {
          errors.push(`Unknown field "education.${k}"`);
        }
      }
      sanitized.education = {};
      if (e.educationalQualification !== undefined) sanitized.education.educationalQualification = String(e.educationalQualification).substring(0, 100);
      if (e.institutionName !== undefined) sanitized.education.institutionName = String(e.institutionName).substring(0, 200);
      if (e.yearOfPassing !== undefined) sanitized.education.yearOfPassing = e.yearOfPassing;
      if (e.fieldOfStudy !== undefined) sanitized.education.fieldOfStudy = String(e.fieldOfStudy).substring(0, 100);
    }
  }

  // 7. bank
  if (rawPayload.bank) {
    if (typeof rawPayload.bank !== 'object' || Array.isArray(rawPayload.bank)) {
      errors.push('Field "bank" must be an object.');
    } else {
      const b = rawPayload.bank;
      for (const k of Object.keys(b)) {
        if (!ALLOWED_KEYS.bank.has(k)) {
          errors.push(`Unknown field "bank.${k}"`);
        }
      }
      sanitized.bank = {};
      if (b.bankName !== undefined) sanitized.bank.bankName = String(b.bankName).substring(0, 100).trim();
      if (b.accountHolderName !== undefined) sanitized.bank.accountHolderName = String(b.accountHolderName).substring(0, 100).trim();
      if (b.accountNumber !== undefined) sanitized.bank.accountNumber = String(b.accountNumber).substring(0, 30).trim();
      if (b.ifscCode !== undefined) {
        const ifsc = String(b.ifscCode).trim().toUpperCase();
        if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
          errors.push('Invalid IFSC code format.');
        } else {
          sanitized.bank.ifscCode = ifsc;
        }
      }
      if (b.branchName !== undefined) sanitized.bank.branchName = String(b.branchName).substring(0, 100).trim();
    }
  }

  // 8. passport
  if (rawPayload.passport) {
    if (typeof rawPayload.passport !== 'object' || Array.isArray(rawPayload.passport)) {
      errors.push('Field "passport" must be an object.');
    } else {
      const pass = rawPayload.passport;
      for (const k of Object.keys(pass)) {
        if (!ALLOWED_KEYS.passport.has(k)) {
          errors.push(`Unknown field "passport.${k}"`);
        }
      }
      sanitized.passport = {};
      if (pass.hasPassport !== undefined) sanitized.passport.hasPassport = Boolean(pass.hasPassport);
      if (pass.passportNumber !== undefined) sanitized.passport.passportNumber = String(pass.passportNumber).substring(0, 20).trim();
      if (pass.expiryDate !== undefined) sanitized.passport.expiryDate = String(pass.expiryDate).substring(0, 20).trim();
      if (pass.documentPath !== undefined) {
        if (pass.documentPath && typeof pass.documentPath === 'string') {
          if (!pass.documentPath.startsWith(`residentDocuments/${authUid}/passport/`)) {
            errors.push(`Invalid passport document path: must begin with residentDocuments/${authUid}/passport/`);
          } else {
            sanitized.passport.documentPath = pass.documentPath;
          }
        } else {
          sanitized.passport.documentPath = null;
        }
      }
      if (pass.fileName !== undefined) sanitized.passport.fileName = pass.fileName ? String(pass.fileName).substring(0, 200) : null;
      if (pass.fileSize !== undefined) sanitized.passport.fileSize = typeof pass.fileSize === 'number' ? pass.fileSize : null;
      if (pass.uploadedAt !== undefined) sanitized.passport.uploadedAt = pass.uploadedAt ? String(pass.uploadedAt) : null;
    }
  }

  // 9. departmentDetails
  if (rawPayload.departmentDetails) {
    if (typeof rawPayload.departmentDetails !== 'object' || Array.isArray(rawPayload.departmentDetails)) {
      errors.push('Field "departmentDetails" must be an object.');
    } else {
      sanitized.departmentDetails = {};
      for (const [k, v] of Object.entries(rawPayload.departmentDetails).slice(0, 50)) {
        if (/^[a-zA-Z0-9_.-]{1,50}$/.test(k)) {
          if (typeof v === 'string') sanitized.departmentDetails[k] = v.substring(0, 500);
          else if (typeof v === 'number' || typeof v === 'boolean') sanitized.departmentDetails[k] = v;
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, sanitized };
}
