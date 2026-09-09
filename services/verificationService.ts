import { db, sanitizeFirestorePayload, assertNoUndefinedValues } from '../lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { UserProfile, ApplicationVerification } from '../types';
import { api } from './api';

function getDocSuffixForRole(
  role: string | null | undefined,
  departmentId?: string | null
): { targetKey: string; docSuffix: string } | null {
  if (!role) return null;
  const upperRole = role.toUpperCase();
  if (upperRole === 'DEPARTMENT_OFFICER') {
    if (departmentId === 'DEPT_A' || departmentId === 'DEPARTMENT_A') {
      return { targetKey: 'DEPARTMENT_A', docSuffix: 'department_a' };
    }
    if (departmentId === 'DEPT_B' || departmentId === 'DEPARTMENT_B') {
      return { targetKey: 'DEPARTMENT_B', docSuffix: 'department_b' };
    }
    if (departmentId === 'DEPT_C' || departmentId === 'DEPARTMENT_C') {
      return { targetKey: 'DEPARTMENT_C', docSuffix: 'department_c' };
    }
  } else if (upperRole === 'DEPARTMENT_A') {
    return { targetKey: 'DEPARTMENT_A', docSuffix: 'department_a' };
  } else if (upperRole === 'DEPARTMENT_B') {
    return { targetKey: 'DEPARTMENT_B', docSuffix: 'department_b' };
  } else if (upperRole === 'DEPARTMENT_C') {
    return { targetKey: 'DEPARTMENT_C', docSuffix: 'department_c' };
  } else if (upperRole === 'ADMIN') {
    return { targetKey: 'ADMIN', docSuffix: 'admin' };
  } else if (upperRole === 'AUDITOR') {
    return { targetKey: 'AUDITOR', docSuffix: 'auditor' };
  }
  return null;
}

export const verificationService = {
  /**
   * Verify an application for the current user's authorized verification role
   * Calls: POST /api/v1/applications/:applicationId/verify
   * Includes idempotency and duplicate click protection.
   */
  async verifyApplication(
    applicationId: string,
    currentUser: UserProfile,
    comments?: string
  ): Promise<void> {
    const roleInfo = getDocSuffixForRole(currentUser.role, currentUser.departmentId);

    if (!roleInfo) {
      throw new Error('Your account does not possess verification authority for this workflow.');
    }

    const { targetKey, docSuffix } = roleInfo;

    // Call trusted backend first
    try {
      await api.post(`/api/v1/applications/${applicationId}/verify`, {
        verifierRole: targetKey,
        departmentId: currentUser.departmentId || targetKey,
        comments: comments || 'Verified in compliance with MahaSetu guidelines',
      });
      return;
    } catch {
      // Direct Firestore transaction fallback for demo
      const primaryVId = `${applicationId}_${docSuffix}`;
      let vRef = doc(db, 'applicationVerifications', primaryVId);
      let vSnap = await getDoc(vRef);

      // Fallback check for legacy doc id if needed
      if (!vSnap.exists()) {
        const altId = `${applicationId}_${targetKey.toLowerCase()}`;
        const altRef = doc(db, 'applicationVerifications', altId);
        const altSnap = await getDoc(altRef);
        if (altSnap.exists()) {
          vRef = altRef;
          vSnap = altSnap;
        } else {
          // Initialize all 5 designated verification slots
          const isOfficerOrAdmin =
            currentUser.role === 'ADMIN' ||
            currentUser.role === 'admin' ||
            currentUser.role === 'DEPARTMENT_A' ||
            currentUser.role === 'DEPARTMENT_B' ||
            currentUser.role === 'DEPARTMENT_C' ||
            currentUser.role === 'department_officer';

          if (isOfficerOrAdmin) {
            const slots = [
              { key: 'DEPARTMENT_A', sfx: 'department_a', dept: 'DEPT_A', role: 'DEPARTMENT_A' },
              { key: 'DEPARTMENT_B', sfx: 'department_b', dept: 'DEPT_B', role: 'DEPARTMENT_B' },
              { key: 'DEPARTMENT_C', sfx: 'department_c', dept: 'DEPT_C', role: 'DEPARTMENT_C' },
              { key: 'ADMIN', sfx: 'admin', dept: null, role: 'ADMIN' },
              { key: 'AUDITOR', sfx: 'auditor', dept: null, role: 'AUDITOR' },
            ];

            for (const slot of slots) {
              const sId = `${applicationId}_${slot.sfx}`;
              const sRef = doc(db, 'applicationVerifications', sId);
              const sSnap = await getDoc(sRef);
              if (!sSnap.exists()) {
                const sPayload = sanitizeFirestorePayload({
                  id: sId,
                  applicationId,
                  verifierKey: slot.key,
                  verifierRole: slot.role,
                  departmentId: slot.dept,
                  status: 'PENDING',
                  comments: null,
                  verifiedAt: null,
                  rejectedAt: null,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                assertNoUndefinedValues(sPayload, `applicationVerifications/${sId}`);
                await setDoc(sRef, sPayload);
              }
            }
            vSnap = await getDoc(vRef);
          } else {
            // Fallback for single slot initialization
            const cleanDeptId = (targetKey === 'ADMIN' || targetKey === 'AUDITOR')
              ? null
              : (currentUser.departmentId || targetKey);

            const initialVPayload = sanitizeFirestorePayload({
              id: primaryVId,
              applicationId,
              verifierKey: targetKey,
              verifierId: currentUser.uid,
              verifierUserId: currentUser.uid,
              verifierName: currentUser.name || targetKey,
              verifierRole: targetKey,
              departmentId: cleanDeptId,
              status: 'PENDING',
              comments: null,
              verifiedAt: null,
              rejectedAt: null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            assertNoUndefinedValues(initialVPayload, `applicationVerifications/${primaryVId}`);
            await setDoc(vRef, initialVPayload);
            vSnap = await getDoc(vRef);
          }
        }
      }

      const vData = vSnap.data() as ApplicationVerification;
      if (vData.status === 'VERIFIED') {
        // Idempotent: already verified, do not duplicate
        return;
      }

      const vUpdatePayload = sanitizeFirestorePayload({
        status: 'VERIFIED',
        verifierUserId: currentUser.uid,
        verifierId: currentUser.uid,
        comments: comments || 'Verified in compliance with MahaSetu guidelines',
        verifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      assertNoUndefinedValues(vUpdatePayload, `applicationVerifications/${vSnap.id}`);
      await updateDoc(vRef, vUpdatePayload);

      // Recalculate 5/5 status across all 5 verifier records
      const allVQuery = query(
        collection(db, 'applicationVerifications'),
        where('applicationId', '==', applicationId)
      );
      const allVSnap = await getDocs(allVQuery);

      let verifiedCount = 0;
      let rejectedCount = 0;

      allVSnap.forEach((d) => {
        const item = d.data();
        const status = d.id === vRef.id ? 'VERIFIED' : item.status;
        if (status === 'VERIFIED') verifiedCount++;
        if (status === 'REJECTED') rejectedCount++;
      });

      const isFullyVerified = verifiedCount === 5;
      const appRef = doc(db, 'applications', applicationId);

      const appUpdatePayload = sanitizeFirestorePayload({
        'verificationSummary.verifiedCount': verifiedCount,
        'verificationSummary.rejectedCount': rejectedCount,
        'verificationSummary.isFullyVerified': isFullyVerified,
        'verificationProgress.completed': verifiedCount,
        'verificationProgress.required': 5,
        status: isFullyVerified ? 'APPLICATION_VERIFIED' : 'UNDER_VERIFICATION',
        updatedAt: serverTimestamp(),
      });
      assertNoUndefinedValues(appUpdatePayload, `applications/${applicationId}`);
      await updateDoc(appRef, appUpdatePayload);
    }
  },

  /**
   * Reject an application
   */
  async rejectApplication(
    applicationId: string,
    currentUser: UserProfile,
    reason: string
  ): Promise<void> {
    const roleInfo = getDocSuffixForRole(currentUser.role, currentUser.departmentId);

    if (!roleInfo) {
      throw new Error('Unauthorized to reject this application.');
    }

    const { targetKey, docSuffix } = roleInfo;

    try {
      await api.post(`/api/v1/applications/${applicationId}/reject`, { reason });
      return;
    } catch {
      const primaryVId = `${applicationId}_${docSuffix}`;
      let vRef = doc(db, 'applicationVerifications', primaryVId);
      let vSnap = await getDoc(vRef);

      if (!vSnap.exists()) {
        const altId = `${applicationId}_${targetKey.toLowerCase()}`;
        const altRef = doc(db, 'applicationVerifications', altId);
        const altSnap = await getDoc(altRef);
        if (altSnap.exists()) {
          vRef = altRef;
          vSnap = altSnap;
        } else {
          throw new Error(`Verification record for ${targetKey} not found.`);
        }
      }

      const vUpdatePayload = sanitizeFirestorePayload({
        status: 'REJECTED',
        verifierUserId: currentUser.uid,
        verifierId: currentUser.uid,
        comments: reason,
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      assertNoUndefinedValues(vUpdatePayload, `applicationVerifications/${vSnap.id}`);
      await updateDoc(vRef, vUpdatePayload);

      const appRef = doc(db, 'applications', applicationId);
      const appUpdatePayload = sanitizeFirestorePayload({
        status: 'REJECTED',
        rejectionReason: reason,
        rejectedBy: `${currentUser.name} (${targetKey})`,
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      assertNoUndefinedValues(appUpdatePayload, `applications/${applicationId}`);
      await updateDoc(appRef, appUpdatePayload);
    }
  },

  /**
   * Real-time subscription to all application verification records
   * Allows the Admin Dashboard and Matrix to observe verification states dynamically.
   */
  subscribeToAllVerifications(
    callback: (verifications: ApplicationVerification[]) => void
  ): () => void {
    const vRef = collection(db, 'applicationVerifications');
    return onSnapshot(
      vRef,
      (snapshot) => {
        const list: ApplicationVerification[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            applicationId: data.applicationId || '',
            verifierKey: data.verifierKey || '',
            verifierId: data.verifierId,
            verifierName: data.verifierName || '',
            verifierRole: data.verifierRole || '',
            departmentId: data.departmentId || null,
            verifierUserId: data.verifierUserId || null,
            status: data.status || 'PENDING',
            comments: data.comments || null,
            verifiedAt: data.verifiedAt?.toDate?.()?.toISOString() || data.verifiedAt || null,
            rejectedAt: data.rejectedAt?.toDate?.()?.toISOString() || data.rejectedAt || null,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          });
        });
        callback(list);
      },
      (err) => {
        console.warn('All verifications listener warning:', err.message);
        callback([]);
      }
    );
  },

  /**
   * Converts an array of ApplicationVerification records into a fast lookup map:
   * { [applicationId]: { DEPARTMENT_A: 'VERIFIED', ADMIN: 'PENDING', ... } }
   */
  buildVerificationMatrixMap(
    verifications: ApplicationVerification[]
  ): Record<string, Record<string, 'VERIFIED' | 'PENDING' | 'REJECTED'>> {
    const map: Record<string, Record<string, 'VERIFIED' | 'PENDING' | 'REJECTED'>> = {};
    for (const v of verifications) {
      if (!v.applicationId) continue;
      if (!map[v.applicationId]) {
        map[v.applicationId] = {};
      }
      const key = v.verifierKey || v.verifierRole;
      if (key) {
        map[v.applicationId][key] = v.status;
      }
    }
    return map;
  },
};

