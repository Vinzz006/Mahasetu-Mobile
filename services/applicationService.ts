import { db, sanitizeFirestorePayload, assertNoUndefinedValues } from '../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { Application, ApplicationVerification, UserProfile } from '../types';
import { api } from './api';

/**
 * Resolves real verifier UIDs from Firestore users collection or canonical personas
 */
async function fetchVerifierUids(): Promise<Record<string, { uid: string; name: string }>> {
  const result: Record<string, { uid: string; name: string }> = {};

  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('role', 'in', [
        'department_officer',
        'admin',
        'auditor',
        'DEPARTMENT_A',
        'DEPARTMENT_B',
        'DEPARTMENT_C',
        'ADMIN',
        'AUDITOR',
      ])
    );
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const roleUpper = String(data.role || '').toUpperCase();
      if (
        roleUpper === 'DEPARTMENT_A' ||
        (roleUpper === 'DEPARTMENT_OFFICER' && (data.departmentId === 'DEPT_A' || data.departmentId === 'DEPARTMENT_A'))
      ) {
        result.DEPARTMENT_A = { uid: docSnap.id, name: data.name || 'Department Officer A' };
      } else if (
        roleUpper === 'DEPARTMENT_B' ||
        (roleUpper === 'DEPARTMENT_OFFICER' && (data.departmentId === 'DEPT_B' || data.departmentId === 'DEPARTMENT_B'))
      ) {
        result.DEPARTMENT_B = { uid: docSnap.id, name: data.name || 'Department Officer B' };
      } else if (
        roleUpper === 'DEPARTMENT_C' ||
        (roleUpper === 'DEPARTMENT_OFFICER' && (data.departmentId === 'DEPT_C' || data.departmentId === 'DEPARTMENT_C'))
      ) {
        result.DEPARTMENT_C = { uid: docSnap.id, name: data.name || 'Department Officer C' };
      } else if (roleUpper === 'ADMIN') {
        result.ADMIN = { uid: docSnap.id, name: data.name || 'Administrator' };
      } else if (roleUpper === 'AUDITOR') {
        result.AUDITOR = { uid: docSnap.id, name: data.name || 'Auditor' };
      }
    });
  } catch (err) {
    console.warn('Verifier users lookup info (using active personas):', err);
  }

  return result;
}

export const applicationService = {
  /**
   * Submit an application via the trusted backend or Firestore transaction
   * Atomically creates application and exactly 5 verification records:
   * 1. DEPARTMENT_A (departmentId = "DEPARTMENT_A")
   * 2. DEPARTMENT_B (departmentId = "DEPARTMENT_B")
   * 3. DEPARTMENT_C (departmentId = "DEPARTMENT_C")
   * 4. ADMIN        (departmentId = null)
   * 5. AUDITOR      (departmentId = null)
   */
  async submitApplication(
    serviceId: string,
    serviceTitle: string,
    serviceCode: string,
    citizen: UserProfile,
    eligibilityData: Record<string, any>
  ): Promise<Application> {
    const appNumber = `MS-${Math.floor(10000 + Math.random() * 90000)}`;
    const applicationId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newApp: Application = {
      id: applicationId,
      applicationNumber: appNumber,
      serviceId,
      serviceTitle,
      serviceCode,
      citizenId: citizen.uid,
      citizenUid: citizen.uid,
      citizenName: citizen.name,
      citizenPhone: citizen.phone || '+919876543210',
      citizenEmail: citizen.email,
      citizenAddress: `${citizen.city || 'Mumbai'}, Maharashtra - ${citizen.pinCode || '400001'}`,
      citizenCity: citizen.city || 'Mumbai',
      status: 'APPLICATION_SUBMITTED',
      submissionDate: new Date().toISOString(),
      eligibilityData: eligibilityData || {},
      verificationSummary: {
        totalRequired: 5,
        verifiedCount: 0,
        rejectedCount: 0,
        isFullyVerified: false,
      },
      verificationProgress: {
        completed: 0,
        required: 5,
      },
      finalCompletionSmsSent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Submit via trusted backend API (server initializes 5-slot verification atomically)
    try {
      const response = await api.post<Application>('/api/v1/applications', newApp);
      return response;
    } catch (apiErr: any) {
      console.error('[applicationService] Backend submission failed:', apiErr);
      throw new Error(apiErr.message || 'Application submission failed. Please ensure the MahaSetu backend is active.');
    }
  },


  /**
   * Listen to applications realtime based on role
   */
  subscribeToApplications(
    user: UserProfile,
    callback: (apps: Application[]) => void,
    onError?: (err: string) => void
  ) {
    const appsRef = collection(db, 'applications');
    let q = query(appsRef);

    const roleUpper = String(user.role || '').toUpperCase();
    if (roleUpper === 'CITIZEN' || !user.role || roleUpper === 'PENDING') {
      // Citizen only sees their own applications
      q = query(appsRef, where('citizenUid', '==', user.uid));
    }

    return onSnapshot(
      q,
      (snapshot) => {
        const list: Application[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            applicationNumber: data.applicationNumber || docSnap.id,
            serviceId: data.serviceId || '',
            serviceTitle: data.serviceTitle || 'Government Service',
            serviceCode: data.serviceCode || '',
            citizenUid: data.citizenUid || '',
            citizenName: data.citizenName || 'Citizen',
            citizenPhone: data.citizenPhone || '',
            citizenEmail: data.citizenEmail || '',
            citizenAddress: data.citizenAddress || '',
            citizenCity: data.citizenCity || '',
            status: data.status || 'APPLICATION_SUBMITTED',
            submissionDate: data.submissionDate || new Date().toISOString(),
            eligibilityData: data.eligibilityData || {},
            verificationSummary: data.verificationSummary || {
              totalRequired: 5,
              verifiedCount: 0,
              rejectedCount: 0,
              isFullyVerified: false,
            },
            rejectionReason: data.rejectionReason,
            rejectedBy: data.rejectedBy,
            rejectedAt: data.rejectedAt,
            completedAt: data.completedAt,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          });
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(list);
      },
      (error) => {
        console.warn('Applications realtime listener warning:', error.message);
        if (onError) onError(error.message);
        else callback([]);
      }
    );
  },

  /**
   * Listen to single application realtime
   */
  subscribeToApplication(applicationId: string, callback: (app: Application | null) => void, onError?: (err: string) => void) {
    const docRef = doc(db, 'applications', applicationId);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          callback({
            id: docSnap.id,
            applicationNumber: data.applicationNumber || docSnap.id,
            serviceId: data.serviceId || '',
            serviceTitle: data.serviceTitle || 'Government Service',
            serviceCode: data.serviceCode || '',
            citizenUid: data.citizenUid || '',
            citizenName: data.citizenName || 'Citizen',
            citizenPhone: data.citizenPhone || '',
            citizenEmail: data.citizenEmail || '',
            citizenAddress: data.citizenAddress || '',
            citizenCity: data.citizenCity || '',
            status: data.status || 'APPLICATION_SUBMITTED',
            submissionDate: data.submissionDate || new Date().toISOString(),
            eligibilityData: data.eligibilityData || {},
            verificationSummary: data.verificationSummary || {
              totalRequired: 5,
              verifiedCount: 0,
              rejectedCount: 0,
              isFullyVerified: false,
            },
            rejectionReason: data.rejectionReason,
            rejectedBy: data.rejectedBy,
            rejectedAt: data.rejectedAt,
            completedAt: data.completedAt,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          });
        } else {
          callback(null);
        }
      },
      (error) => {
        console.warn('Application detail listener warning:', error.message);
        if (onError) onError(error.message);
        else callback(null);
      }
    );
  },

  /**
   * Listen to the verification records for an application
   */
  subscribeToVerifications(
    applicationId: string,
    callback: (verifications: ApplicationVerification[]) => void,
    onError?: (err: string) => void
  ) {
    const vRef = collection(db, 'applicationVerifications');
    const q = query(vRef, where('applicationId', '==', applicationId));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: ApplicationVerification[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            applicationId: data.applicationId,
            verifierKey: data.verifierKey || data.verifierRole,
            verifierId: data.verifierId || data.verifierUserId,
            verifierName: data.verifierName || data.verifierKey,
            verifierRole: data.verifierRole,
            departmentId: data.departmentId ?? null,
            verifierUserId: data.verifierUserId || data.verifierId || null,
            status: data.status || 'PENDING',
            comments: data.comments ?? null,
            verifiedAt: data.verifiedAt?.toDate?.()?.toISOString() || data.verifiedAt || null,
            rejectedAt: data.rejectedAt?.toDate?.()?.toISOString() || data.rejectedAt || null,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          });
        });

        // Consistent ordering: DEPT_A / DEPARTMENT_A, DEPT_B / DEPARTMENT_B, DEPT_C / DEPARTMENT_C, ADMIN, AUDITOR
        const orderMap: Record<string, number> = {
          DEPARTMENT_A: 1,
          DEPT_A: 1,
          DEPARTMENT_B: 2,
          DEPT_B: 2,
          DEPARTMENT_C: 3,
          DEPT_C: 3,
          ADMIN: 4,
          AUDITOR: 5,
        };
        list.sort((a, b) => (orderMap[a.verifierKey] || 99) - (orderMap[b.verifierKey] || 99));

        callback(list);
      },
      (error) => {
        console.warn('Verifications listener warning:', error.message);
        if (onError) onError(error.message);
        else callback([]);
      }
    );
  },
};
