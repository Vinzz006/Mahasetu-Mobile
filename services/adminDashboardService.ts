import { db } from '../lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { Application, UserProfile, ApplicationVerification } from '../types';
import { SmsMetrics, twilioService } from './twilioService';
import { verificationService } from './verificationService';

export interface CitizenVerificationItem {
  uid: string;
  name: string;
  email: string;
  phone: string;
  aadhaarRef: string;
  city: string;
  district: string;
  isVerified: boolean;
  hasResidentProfile: boolean;
  completionPercentage?: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

export interface AdminDashboardMetrics {
  pendingUsersCount: number;
  pendingUsersSubtitle: string;
  citizenIdentityCount: number;
  citizenIdentitySubtitle: string;
  activeAppsCount: number;
  activeAppsSubtitle: string;
  fullyVerifiedAppsCount: number;
  inProgressAppsCount: number;
  smsSentToday: number;
  smsFailedToday: number;
  smsSubtitle: string;
}

/**
 * Dedicated Authoritative Data Service for MahaSetu Admin Control Center.
 * Enforces:
 * - 100% Real Firestore Data Only (Excludes isDemo === true records)
 * - Single Source of Truth shared with Approvals, Citizens, Applications, and Integrations tabs
 * - Transparent Error Handling (NEVER swallows database errors or masks them as zero)
 */
export const adminDashboardService = {
  /**
   * 1. PENDING USERS STREAM
   * Source: users collection where status in ['PENDING', 'PENDING_APPROVAL']
   * Strictly excludes demo personas (isDemo === true) and already approved/rejected users.
   */
  subscribeToPendingUsers(
    onUpdate: (users: UserProfile[]) => void,
    onError?: (errorMessage: string) => void
  ): () => void {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('status', 'in', ['PENDING', 'PENDING_APPROVAL']));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.isDemo) return; // Exclude demo seed records from production queue

          list.push({
            uid: docSnap.id,
            email: data.email || '',
            name: data.name || data.displayName || 'Applicant',
            role: data.role ?? null,
            departmentId: data.departmentId ?? null,
            status: 'PENDING',
            isActive: !!data.isActive,
            phone: data.phone || data.phoneNumber || '',
            city: data.city || '',
            district: data.district || '',
            state: data.state || '',
            pinCode: data.pinCode || '',
            aadhaarRef: data.aadhaarRef || '',
            isVerified: !!data.isVerified,
            isDemo: false,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
          });
        });
        onUpdate(list);
      },
      (err) => {
        console.error('[adminDashboardService] Pending users error:', err);
        if (onError) onError(`Unable to load pending users: ${err.message}`);
      }
    );
  },

  /**
   * 2. CITIZEN IDENTITY CERTIFICATION QUEUE STREAM
   * Source: Real citizens who have submitted a Government Resident Profile
   * for identity certification and are awaiting administrative verification.
   * Excludes demo personas and citizens who have not submitted a resident profile.
   */
  subscribeToCitizenIdentityQueue(
    onUpdate: (citizens: CitizenVerificationItem[]) => void,
    onError?: (errorMessage: string) => void
  ): () => void {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', 'in', ['CITIZEN', 'citizen']));

    return onSnapshot(
      q,
      (snapshot) => {
        const queue: CitizenVerificationItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.isDemo) return; // Exclude demo seed records

          // A citizen requires identity certification ONLY if they have submitted
          // their Government Resident Profile and are not yet verified.
          const hasProfile = !!data.hasResidentProfile || data.identityStatus === 'PENDING';
          const isVerified = !!data.isVerified;

          // Only include citizens awaiting identity certification
          if (hasProfile && !isVerified) {
            queue.push({
              uid: docSnap.id,
              name: data.name || data.displayName || 'Citizen',
              email: data.email || '',
              phone: data.phone || data.phoneNumber || 'N/A',
              aadhaarRef: data.aadhaarRef || 'XXXX-XXXX-0000',
              city: data.city || 'Maharashtra',
              district: data.district || 'Statewide',
              isVerified: false,
              hasResidentProfile: true,
              completionPercentage: data.profileCompletion,
              status: 'PENDING',
            });
          }
        });

        onUpdate(queue);
      },
      (err) => {
        console.error('[adminDashboardService] Citizen queue error:', err);
        if (onError) onError(`Unable to load citizen identity queue: ${err.message}`);
      }
    );
  },

  /**
   * 3. ACTIVE APPLICATIONS STREAM
   * Source: applications collection
   * Excludes terminal states (COMPLETED, REJECTED, CANCELLED) and demo seed applications.
   */
  subscribeToActiveApplications(
    onUpdate: (apps: Application[]) => void,
    onError?: (errorMessage: string) => void
  ): () => void {
    const appsRef = collection(db, 'applications');

    return onSnapshot(
      appsRef,
      (snapshot) => {
        const list: Application[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.isDemo) return; // Exclude demo seed applications

          // Filter out terminal states
          const status = data.status || 'APPLICATION_SUBMITTED';
          if (status === 'COMPLETED' || status === 'REJECTED' || status === 'CANCELLED') {
            return;
          }

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
            status,
            submissionDate: data.submissionDate || new Date().toISOString(),
            eligibilityData: data.eligibilityData || {},
            verificationSummary: data.verificationSummary || {
              totalRequired: 5,
              verifiedCount: 0,
              rejectedCount: 0,
              isFullyVerified: false,
            },
            verificationProgress: data.verificationProgress,
            isDemo: false,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
          });
        });

        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate(list);
      },
      (err) => {
        console.error('[adminDashboardService] Applications error:', err);
        if (onError) onError(`Unable to load active applications: ${err.message}`);
      }
    );
  },

  /**
   * 4. 5-PARTY VERIFICATION MATRIX STREAM
   * Source: applicationVerifications collection
   * Dynamically tracks per-application stage status: DEPARTMENT_A, B, C, ADMIN, AUDITOR.
   */
  subscribeToVerificationMatrix(
    onUpdate: (matrixMap: Record<string, Record<string, 'VERIFIED' | 'PENDING' | 'REJECTED'>>) => void,
    onError?: (errorMessage: string) => void
  ): () => void {
    const vRef = collection(db, 'applicationVerifications');

    return onSnapshot(
      vRef,
      (snapshot) => {
        const verifications: ApplicationVerification[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          if (data.isDemo) return; // Exclude demo records

          verifications.push({
            id: d.id,
            applicationId: data.applicationId || '',
            verifierKey: data.verifierKey || data.verifierRole,
            verifierName: data.verifierName || '',
            verifierRole: data.verifierRole || '',
            departmentId: data.departmentId || null,
            status: data.status || 'PENDING',
            comments: data.comments || null,
            verifiedAt: data.verifiedAt?.toDate?.()?.toISOString() || data.verifiedAt || null,
            rejectedAt: data.rejectedAt?.toDate?.()?.toISOString() || data.rejectedAt || null,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          });
        });

        const map = verificationService.buildVerificationMatrixMap(verifications);
        onUpdate(map);
      },
      (err) => {
        console.error('[adminDashboardService] Verification matrix error:', err);
        if (onError) onError(`Unable to load verification matrix: ${err.message}`);
      }
    );
  },

  /**
   * 5. TWILIO SMS TELEMETRY STREAM
   * Source: integrationLogs collection
   * Counts real SMS sent today and failed today.
   */
  subscribeToSmsMetrics(
    onUpdate: (metrics: SmsMetrics) => void,
    onError?: (errorMessage: string) => void
  ): () => void {
    return twilioService.subscribeToSmsMetrics(onUpdate, onError);
  },
};
