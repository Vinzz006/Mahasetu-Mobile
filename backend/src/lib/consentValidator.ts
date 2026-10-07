/**
 * Consent Enforcement and Officer Document Access Control Validator
 * DPDP Act 2023 & Citizen Privacy Protection
 */

export interface ConsentVerificationParams {
  db: FirebaseFirestore.Firestore;
  citizenUid: string;
  departmentId: string;
  officerRole: string;
  officerUid: string;
  applicationId?: string;
}

export interface ConsentVerificationResult {
  allowed: boolean;
  consentId?: string;
  reason?: string;
  isAuditOverride?: boolean;
}

function normalizeDept(dept: string): string {
  const upper = (dept || '').toUpperCase().trim();
  if (upper === 'DEPT_A' || upper === 'DEPARTMENT_A') return 'DEPARTMENT_A';
  if (upper === 'DEPT_B' || upper === 'DEPARTMENT_B') return 'DEPARTMENT_B';
  if (upper === 'DEPT_C' || upper === 'DEPARTMENT_C') return 'DEPARTMENT_C';
  return upper;
}

/**
 * Verifies if an officer has active citizen consent to access citizen documents/records.
 */
export async function verifyOfficerConsent(
  params: ConsentVerificationParams
): Promise<ConsentVerificationResult> {
  const { db, citizenUid, departmentId, officerRole, officerUid, applicationId } = params;
  const roleUpper = (officerRole || '').toUpperCase();

  // 1. Admin & Auditor statutory oversight override
  if (roleUpper === 'ADMIN' || roleUpper === 'AUDITOR') {
    return {
      allowed: true,
      isAuditOverride: true,
      reason: `Statutory oversight access granted to ${roleUpper}`,
    };
  }

  // 2. Normalize officer department
  const officerDeptNorm = normalizeDept(departmentId || officerRole);
  if (!officerDeptNorm.startsWith('DEPARTMENT_')) {
    return {
      allowed: false,
      reason: `Invalid or unassigned officer department: ${departmentId}`,
    };
  }

  // 3. Query consents collection for active GRANTED consent for this citizen
  try {
    const consentsRef = db.collection('consents');
    const snapshot = await consentsRef
      .where('citizenUid', '==', citizenUid)
      .where('status', '==', 'GRANTED')
      .get();

    if (snapshot.empty) {
      return {
        allowed: false,
        reason: 'No active GRANTED consent found for citizen.',
      };
    }

    const now = Date.now();
    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Check department match
      const targetNorm = normalizeDept(data.targetDepartment || data.targetDepartmentCode || '');
      const sourceNorm = normalizeDept(data.sourceDepartment || '');

      const isDeptMatch =
        targetNorm === officerDeptNorm ||
        sourceNorm === officerDeptNorm ||
        data.departmentId === officerDeptNorm ||
        data.departmentId === departmentId;

      if (!isDeptMatch) {
        continue;
      }

      // Check application scope if present in both
      if (applicationId && data.applicationId && data.applicationId !== applicationId) {
        continue;
      }

      // Check expiration
      if (data.expiresAt) {
        const expTime = new Date(data.expiresAt).getTime();
        if (!isNaN(expTime) && expTime <= now) {
          return {
            allowed: false,
            consentId: doc.id,
            reason: 'Citizen consent has expired.',
          };
        }
      }

      // Valid, non-expired, matching consent found
      return {
        allowed: true,
        consentId: doc.id,
        reason: 'Active citizen consent verified successfully.',
      };
    }

    return {
      allowed: false,
      reason: `No active citizen consent grants access to ${officerDeptNorm}.`,
    };
  } catch (err: any) {
    // Fail closed on error
    return {
      allowed: false,
      reason: `Consent verification failed due to internal error: ${err.message}`,
    };
  }
}
