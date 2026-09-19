import { auth, db, sanitizeFirestorePayload, assertNoUndefinedValues } from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { UserProfile, UserRole, DepartmentId, AccountStatus } from '../types';
import { auditService } from './auditService';
import { api } from './api';

export const authService = {
  /**
   * Observe Firebase Auth changes and fetch user document
   */
  subscribeToAuth(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Fetch user profile document once from Firestore
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDocRef = doc(db, 'users', uid);
      const snapshot = await getDoc(userDocRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        const rawStatus = data.status as string;
        const normalizedStatus: AccountStatus = rawStatus === 'PENDING_APPROVAL' ? 'PENDING' : ((rawStatus as AccountStatus) || 'PENDING');
        return {
          uid,
          email: data.email || '',
          name: data.name || data.displayName || '',
          role: (data.role as UserRole) ?? null,
          departmentId: (data.departmentId as DepartmentId) ?? null,
          status: normalizedStatus,
          isActive: !!data.isActive,
          phone: data.phone,
          city: data.city,
          district: data.district,
          state: data.state,
          pinCode: data.pinCode,
          aadhaarRef: data.aadhaarRef,
          isVerified: !!data.isVerified,
          verifiedAt: data.verifiedAt?.toDate?.()?.toISOString() || data.verifiedAt || null,
          verifiedBy: data.verifiedBy || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        };
      }
    } catch (e) {
      console.warn('getUserProfile error:', e);
    }
    return null;
  },

  /**
   * Listen to real-time updates for a user profile in Firestore
   */
  subscribeToUserProfile(uid: string, callback: (profile: UserProfile | null) => void) {
    const userDocRef = doc(db, 'users', uid);
    return onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const rawStatus = data.status as string;
          const normalizedStatus: AccountStatus = rawStatus === 'PENDING_APPROVAL' ? 'PENDING' : ((rawStatus as AccountStatus) || 'PENDING');
          callback({
            uid,
            email: data.email || '',
            name: data.name || data.displayName || '',
            role: (data.role as UserRole) ?? null,
            departmentId: (data.departmentId as DepartmentId) ?? null,
            status: normalizedStatus,
            isActive: !!data.isActive,
            phone: data.phone,
            city: data.city,
            district: data.district,
            state: data.state,
            pinCode: data.pinCode,
            aadhaarRef: data.aadhaarRef,
            isVerified: !!data.isVerified,
            verifiedAt: data.verifiedAt?.toDate?.()?.toISOString() || data.verifiedAt || null,
            verifiedBy: data.verifiedBy || null,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          });
        } else {
          callback(null);
        }
      },
      (error) => {
        console.warn('UserProfile realtime listener warning:', error.message);
      }
    );
  },

  /**
   * Authentic Email & Password Sign In via Firebase Auth
   */
  async signInWithEmail(email: string, password: string): Promise<UserProfile> {
    const cleanEmail = email.trim().toLowerCase();
    const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
    let profile = await this.getUserProfile(result.user.uid);
    if (!profile) {
      profile = await this.initializeNewUserRecord(result.user);
    }
    return profile;
  },

  /**
   * Authentic Email & Password Registration via Firebase Auth
   * Starts with role=null and status='PENDING' until Admin approval
   */
  async signUpWithEmail(email: string, password: string, displayName: string): Promise<UserProfile> {
    const cleanEmail = email.trim().toLowerCase();
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const profile = await this.initializeNewUserRecord(result.user, displayName.trim());
    return profile;
  },

  /**
   * Send Password Reset Email via Firebase Auth
   */
  async sendPasswordReset(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    await sendPasswordResetEmail(auth, cleanEmail);
  },

  /**
   * Helper to map Firebase Auth error codes to user-friendly messages
   */
  mapAuthError(err: any): string {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-login-credentials':
        return 'Invalid email address or password. Please check your credentials and try again.';
      case 'auth/email-already-in-use':
        return 'This email address is already registered. Please sign in or use Forgot Password.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/missing-password':
        return 'Please enter your password.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact an administrator.';
      case 'auth/too-many-requests':
        return 'Access temporarily disabled due to multiple failed login attempts. Try again later or reset password.';
      case 'permission-denied':
        return 'Permission denied. Please verify your connection and permissions.';
      default:
        return err?.message || 'An unexpected authentication error occurred. Please try again.';
    }
  },

  /**
   * Register or initialize a new user profile record in Firestore
   * Starts with role=null and status='PENDING' until Admin approval
   */
  async initializeNewUserRecord(user: FirebaseUser, defaultName?: string): Promise<UserProfile> {
    const userDocRef = doc(db, 'users', user.uid);
    const existing = await getDoc(userDocRef);

    if (existing.exists()) {
      const data = existing.data();
      const rawStatus = data.status as string;
      const normalizedStatus: AccountStatus = rawStatus === 'PENDING_APPROVAL' ? 'PENDING' : ((rawStatus as AccountStatus) || 'PENDING');
      return {
        uid: user.uid,
        email: data.email || user.email || '',
        name: data.name || data.displayName || defaultName || user.displayName || 'Applicant',
        displayName: data.displayName || data.name || defaultName || user.displayName || 'Applicant',
        role: (data.role as UserRole) ?? null,
        departmentId: (data.departmentId as DepartmentId) ?? null,
        status: normalizedStatus,
        isActive: !!data.isActive,
        phone: data.phoneNumber || data.phone || user.phoneNumber || undefined,
        phoneNumber: data.phoneNumber || data.phone || user.phoneNumber || undefined,
        city: data.city,
        district: data.district,
        state: data.state,
        pinCode: data.pinCode,
        aadhaarRef: data.aadhaarRef,
        isVerified: !!data.isVerified,
        verifiedAt: data.verifiedAt?.toDate?.()?.toISOString() || data.verifiedAt || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    }

    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: defaultName || user.displayName || user.email?.split('@')[0] || 'Applicant',
      name: defaultName || user.displayName || user.email?.split('@')[0] || 'Applicant',
      phoneNumber: user.phoneNumber || undefined,
      phone: user.phoneNumber || undefined,
      role: null,
      departmentId: null,
      status: 'PENDING',
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const payload = sanitizeFirestorePayload({
      ...newProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    assertNoUndefinedValues(payload, `users/${user.uid}`);

    try {
      await setDoc(userDocRef, payload);
    } catch {
      try {
        await api.post('/api/v1/users/register', newProfile);
      } catch (err) {
        console.warn('User registration backend fallback warning:', err);
      }
    }

    return newProfile;
  },

  /**
   * Listen to all pending registrations for Admin approval queue
   */
  subscribeToPendingUsers(
    callback: (users: UserProfile[]) => void,
    onError?: (err: string) => void
  ) {
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
            role: (data.role as UserRole) ?? null,
            departmentId: data.departmentId ?? null,
            status: 'PENDING',
            isActive: !!data.isActive,
            phone: data.phone || '',
            city: data.city || '',
            district: data.district || '',
            state: data.state || '',
            pinCode: data.pinCode || '',
            aadhaarRef: data.aadhaarRef || '',
            isVerified: !!data.isVerified,
            isDemo: !!data.isDemo,
            recordType: data.recordType || 'PRODUCTION',
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
          });
        });
        callback(list);
      },
      (error) => {
        console.warn('Pending users realtime listener warning:', error.message);
        if (onError) onError(error.message);
        else callback([]);
      }
    );
  },

  /**
   * Listen to all citizens for Admin citizen verification queue
   */
  subscribeToCitizens(
    callback: (citizens: UserProfile[]) => void,
    onError?: (err: string) => void
  ) {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', 'in', ['CITIZEN', 'citizen']));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            uid: docSnap.id,
            email: data.email || '',
            name: data.name || data.displayName || 'Citizen',
            role: 'CITIZEN',
            departmentId: null,
            status: data.status === 'PENDING_APPROVAL' ? 'PENDING' : ((data.status as AccountStatus) || 'APPROVED'),
            isActive: !!data.isActive,
            phone: data.phone || '',
            city: data.city || '',
            district: data.district || '',
            state: data.state || '',
            pinCode: data.pinCode || '',
            aadhaarRef: data.aadhaarRef || '',
            isVerified: !!data.isVerified,
            verifiedAt: data.verifiedAt?.toDate?.()?.toISOString() || data.verifiedAt || null,
            isDemo: !!data.isDemo,
            recordType: data.recordType || (data.isDemo ? 'DEMO' : 'PRODUCTION'),
            hasResidentProfile: !!data.hasResidentProfile,
            identityStatus: data.identityStatus || (data.isVerified ? 'VERIFIED' : (data.hasResidentProfile ? 'PENDING' : undefined)),
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
          });
        });
        callback(list);
      },
      (error) => {
        console.warn('Citizens realtime listener warning:', error.message);
        if (onError) onError(error.message);
        else callback([]);
      }
    );
  },

  /**
   * Admin approves a pending user and assigns role
   * Calls: POST /api/v1/admin/user-approvals/:uid/approve or updates Firestore directly
   */
  async approvePendingUser(
    targetUid: string,
    assignedRole: UserRole,
    departmentId?: DepartmentId | string | null
  ): Promise<void> {
    const isDeptOfficer =
      assignedRole === 'DEPARTMENT_A' ||
      assignedRole === 'DEPARTMENT_B' ||
      assignedRole === 'DEPARTMENT_C' ||
      assignedRole === 'department_officer';

    const cleanDeptId = isDeptOfficer ? (departmentId || null) : null;

    try {
      await api.post(`/api/v1/admin/user-approvals/${targetUid}/approve`, {
        role: assignedRole,
        departmentId: cleanDeptId,
      });
    } catch (backendError) {
      console.warn('Backend approval endpoint failed, updating Firestore directly:', backendError);
      const userRef = doc(db, 'users', targetUid);
      const updateData = sanitizeFirestorePayload({
        role: assignedRole,
        departmentId: cleanDeptId,
        status: 'APPROVED',
        isActive: true,
        updatedAt: serverTimestamp(),
      });
      assertNoUndefinedValues(updateData, `users/${targetUid}`);
      await setDoc(userRef, updateData, { merge: true });
    }

    // Append to immutable audit log
    await auditService.logAction({
      actorUid: auth.currentUser?.uid || 'admin',
      actorName: auth.currentUser?.displayName || 'Administrator',
      actorRole: 'ADMIN',
      action: 'USER_APPROVED',
      targetType: 'USER',
      targetId: targetUid,
      details: `Approved user ${targetUid} with role ${assignedRole}${cleanDeptId ? ` in ${cleanDeptId}` : ''}.`,
    });
  },

  /**
   * Admin rejects a pending user
   */
  async rejectPendingUser(targetUid: string, reason?: string): Promise<void> {
    try {
      await api.post(`/api/v1/admin/user-approvals/${targetUid}/reject`, { reason });
    } catch {
      const userRef = doc(db, 'users', targetUid);
      const updateData = sanitizeFirestorePayload({
        status: 'REJECTED',
        isActive: false,
        rejectionReason: reason || 'Application rejected by administrator',
        updatedAt: serverTimestamp(),
      });
      assertNoUndefinedValues(updateData, `users/${targetUid}`);
      await setDoc(userRef, updateData, { merge: true });
    }

    // Append to immutable audit log
    await auditService.logAction({
      actorUid: auth.currentUser?.uid || 'admin',
      actorName: auth.currentUser?.displayName || 'Administrator',
      actorRole: 'ADMIN',
      action: 'USER_REJECTED',
      targetType: 'USER',
      targetId: targetUid,
      details: `Rejected registration for user ${targetUid}. Reason: ${reason || 'Application rejected by administrator'}.`,
    });
  },

  /**
   * Admin verifies citizen identity status
   */
  async verifyCitizenIdentity(targetUid: string, verified: boolean): Promise<void> {
    try {
      await api.post(`/api/v1/admin/citizens/${targetUid}/verify`, { verified });
    } catch {
      const userRef = doc(db, 'users', targetUid);
      const updateData = sanitizeFirestorePayload({
        isVerified: verified,
        identityStatus: verified ? 'VERIFIED' : 'REJECTED',
        verifiedAt: serverTimestamp(),
        verifiedBy: auth.currentUser?.uid || 'admin',
        updatedAt: serverTimestamp(),
      });
      assertNoUndefinedValues(updateData, `users/${targetUid}`);
      await setDoc(userRef, updateData, { merge: true });

      // Also update residentProfiles if present
      try {
        const rpRef = doc(db, 'residentProfiles', targetUid);
        const rpSnap = await getDoc(rpRef);
        if (rpSnap.exists()) {
          const rpUpdate = sanitizeFirestorePayload({
            certificationStatus: verified ? 'VERIFIED' : 'REJECTED',
            certifiedAt: serverTimestamp(),
            certifiedBy: auth.currentUser?.uid || 'admin',
            updatedAt: serverTimestamp(),
          });
          assertNoUndefinedValues(rpUpdate, `residentProfiles/${targetUid}`);
          await setDoc(rpRef, rpUpdate, { merge: true });
        }
      } catch (rpErr: any) {
        console.warn('residentProfiles update warning during certification:', rpErr.message);
      }
    }

    // Append to immutable audit log
    await auditService.logAction({
      actorUid: auth.currentUser?.uid || 'admin',
      actorName: auth.currentUser?.displayName || 'Administrator',
      actorRole: 'ADMIN',
      action: verified ? 'CITIZEN_IDENTITY_VERIFIED' : 'CITIZEN_IDENTITY_REJECTED',
      targetType: 'USER',
      targetId: targetUid,
      details: verified
        ? `Certified citizen identity for cross-department data reuse.`
        : `Rejected citizen identity verification.`,
    });
  },

  /**
   * Refresh ID token to pick up new custom claims
   */
  async refreshIdToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken(true);
    }
    return null;
  },

  /**
   * Sign out
   */
  async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('SignOut error:', e);
    }
  },
};
