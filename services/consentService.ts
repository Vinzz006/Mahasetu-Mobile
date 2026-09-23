import { db } from '../lib/firebase';
import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Consent, UserProfile } from '../types';
import { api } from './api';

export const consentService = {
  /**
   * Real-time listener for Citizen's data-sharing consent requests
   */
  subscribeToConsents(
    user: UserProfile,
    callback: (consents: Consent[]) => void,
    onError?: (err: string) => void
  ) {
    const cRef = collection(db, 'consents');
    let q = query(cRef);

    const roleUpper = String(user.role || '').toUpperCase();
    if (roleUpper === 'CITIZEN' || !user.role || roleUpper === 'PENDING') {
      q = query(cRef, where('citizenUid', '==', user.uid));
    }

    return onSnapshot(
      q,
      (snapshot) => {
        const list: Consent[] = [];
        snapshot.forEach((snap) => {
          const d = snap.data();
          list.push({
            id: snap.id,
            applicationId: d.applicationId || '',
            applicationNumber: d.applicationNumber || '',
            citizenUid: d.citizenUid || '',
            sourceDepartment: d.sourceDepartment || 'Department A',
            targetDepartment: d.targetDepartment || 'DEPT_B',
            targetDepartmentName: d.targetDepartmentName || 'Department B — Social Welfare',
            purpose: d.purpose || 'Eligibility Verification & Entitlement Check',
            sharedFields: d.sharedFields || ['Name', 'Mobile', 'City'],
            status: d.status || 'PENDING',
            grantedAt: d.grantedAt?.toDate?.()?.toISOString() || d.grantedAt,
            deniedAt: d.deniedAt?.toDate?.()?.toISOString() || d.deniedAt,
            expiresAt: d.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString(),
            createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          });
        });
        callback(list);
      },
      (error) => {
        console.warn('Consents realtime listener warning:', error.message);
        if (onError) onError(error.message);
        else callback([]);
      }
    );
  },

  /**
   * Citizen grants consent for departmental data exchange
   */
  async grantConsent(consentId: string): Promise<void> {
    try {
      await api.post(`/api/v1/consent/${consentId}/grant`);
    } catch {
      const cRef = doc(db, 'consents', consentId);
      await updateDoc(cRef, {
        status: 'GRANTED',
        grantedAt: serverTimestamp(),
      });
    }
  },

  /**
   * Citizen denies consent
   */
  async denyConsent(consentId: string): Promise<void> {
    try {
      await api.post(`/api/v1/consent/${consentId}/deny`);
    } catch {
      const cRef = doc(db, 'consents', consentId);
      await updateDoc(cRef, {
        status: 'DENIED',
        deniedAt: serverTimestamp(),
      });
    }
  },
};
