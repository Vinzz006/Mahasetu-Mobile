declare const __DEV__: boolean | undefined;

import { auth, db, sanitizeFirestorePayload, assertNoUndefinedValues } from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
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
import { DEMO_USERS, DemoUser, DEMO_PASSWORD } from '../constants/demoData';
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
  /**
   * Validates password strength: at least 10 characters, uppercase, lowercase, digit, and special char.
   */
  validatePasswordStrength(password: string): { isValid: boolean; error?: string } {
    if (!password || password.length < 10) {
      return { isValid: false, error: 'Password must be at least 10 characters long.' };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one uppercase letter.' };
    }
    if (!/[a-z]/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one lowercase letter.' };
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one number.' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one special character.' };
    }
    return { isValid: true };
  },

  /**
   * Authentic Email & Password Registration via Firebase Auth
   * Starts with role=null and status='PENDING' until Admin approval
   */
  async signUpWithEmail(email: string, password: string, displayName: string): Promise<UserProfile> {
    const passCheck = this.validatePasswordStrength(password);
    if (!passCheck.isValid) {
      throw new Error(passCheck.error || 'Password does not meet complexity requirements.');
    }
    const cleanEmail = email.trim().toLowerCase();
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    try {
      await sendEmailVerification(result.user);
    } catch (verifyErr) {
      console.warn('sendEmailVerification failed or skipped:', verifyErr);
    }
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
   * Authenticate real Firebase Auth demo account and ensure Firestore profile exists.
   * NEVER fabricates request.auth.uid. Guarantees auth.currentUser != null.
   */
  async switchDemoAccount(demo: DemoUser): Promise<UserProfile> {
    const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
    if (!isDev || process.env.EXPO_PUBLIC_DEMO_MODE !== 'true') {
      throw new Error('Demo account switcher is strictly disabled in production builds.');
    }
    const password = DEMO_PASSWORD;
    if (!password) {
      throw new Error('Demo password is not configured. Please set EXPO_PUBLIC_DEMO_PASSWORD in .env.');
    }
    let firebaseUser: FirebaseUser | null = null;

    // 1. Authenticate with real Firebase Authentication
    try {
      const userCredential = await signInWithEmailAndPassword(auth, demo.email, password);
      firebaseUser = userCredential.user;
    } catch (authErr: any) {
      if (
        authErr.code === 'auth/user-not-found' ||
        authErr.code === 'auth/invalid-credential' ||
        authErr.code === 'auth/invalid-login-credentials'
      ) {
        // Create account if not present in Firebase Auth
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, demo.email, password);
          firebaseUser = userCredential.user;
        } catch (createErr: any) {
          if (createErr.code === 'auth/email-already-in-use') {
            const userCredential = await signInWithEmailAndPassword(auth, demo.email, password);
            firebaseUser = userCredential.user;
          } else {
            throw createErr;
          }
        }
      } else {
        throw authErr;
      }
    }

    if (!firebaseUser) {
      throw new Error(`Failed to authenticate demo user ${demo.email} in Firebase Auth`);
    }

    const realUid = firebaseUser.uid;

    // 2. Ensure Firestore users/{realUid} is seeded with canonical role and APPROVED status
    const userDocRef = doc(db, 'users', realUid);
    const existingDoc = await getDoc(userDocRef);

    // Map role to canonical Firestore role
    let canonicalRole: UserRole = 'CITIZEN';
    const rawRole = String(demo.role || '').toLowerCase();
    if (rawRole === 'citizen') {
      canonicalRole = 'CITIZEN';
    } else if (rawRole === 'admin') {
      canonicalRole = 'ADMIN';
    } else if (rawRole === 'auditor') {
      canonicalRole = 'AUDITOR';
    } else if (
      rawRole === 'department_a' ||
      (rawRole === 'department_officer' && demo.departmentId === 'DEPT_A')
    ) {
      canonicalRole = 'DEPARTMENT_A';
    } else if (
      rawRole === 'department_b' ||
      (rawRole === 'department_officer' && demo.departmentId === 'DEPT_B')
    ) {
      canonicalRole = 'DEPARTMENT_B';
    } else if (
      rawRole === 'department_c' ||
      (rawRole === 'department_officer' && demo.departmentId === 'DEPT_C')
    ) {
      canonicalRole = 'DEPARTMENT_C';
    } else {
      canonicalRole = (demo.role as unknown as UserRole) || 'CITIZEN';
    }

    const canonicalDeptId =
      canonicalRole === 'DEPARTMENT_A'
        ? 'DEPT_A'
        : canonicalRole === 'DEPARTMENT_B'
        ? 'DEPT_B'
        : canonicalRole === 'DEPARTMENT_C'
        ? 'DEPT_C'
        : demo.departmentId || null;

    let profile: UserProfile;

    if (existingDoc.exists()) {
      const data = existingDoc.data();
      profile = {
        uid: realUid,
        email: data.email || demo.email,
        name: data.name || demo.name,
        role: (data.role as UserRole) || canonicalRole,
        departmentId: (data.departmentId as DepartmentId) ?? canonicalDeptId,
        status: (data.status as AccountStatus) || 'APPROVED',
        isActive: true,
        phone: data.phone || demo.phone,
        city: data.city || demo.city,
        district: data.district || demo.district,
        state: data.state || demo.state,
        pinCode: data.pinCode || demo.pinCode,
        aadhaarRef: data.aadhaarRef || demo.aadhaarRef,
        isVerified: !!data.isVerified || !!demo.isVerified,
        verifiedAt: data.verifiedAt?.toDate?.()?.toISOString() || data.verifiedAt || new Date().toISOString(),
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Ensure profile in Firestore has APPROVED status and canonical role
      if (data.status !== 'APPROVED' || !data.role) {
        const updatePayload = sanitizeFirestorePayload({
          role: canonicalRole,
          status: 'APPROVED',
          isActive: true,
          departmentId: canonicalDeptId,
          updatedAt: serverTimestamp(),
        });
        assertNoUndefinedValues(updatePayload, `users/${realUid}`);
        await setDoc(userDocRef, updatePayload, { merge: true });
        profile.role = canonicalRole;
        profile.status = 'APPROVED';
      }
    } else {
      profile = {
        uid: realUid,
        email: demo.email,
        name: demo.name,
        role: canonicalRole,
        departmentId: canonicalDeptId,
        status: 'APPROVED',
        isActive: true,
        phone: demo.phone,
        city: demo.city,
        district: demo.district,
        state: demo.state,
        pinCode: demo.pinCode,
        aadhaarRef: demo.aadhaarRef,
        isVerified: !!demo.isVerified,
        verifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const payload = sanitizeFirestorePayload({
        ...profile,
        verifiedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      assertNoUndefinedValues(payload, `users/${realUid}`);
      await setDoc(userDocRef, payload);
    }

    // 3. Verify that auth.currentUser matches profile.uid
    if (!auth.currentUser || auth.currentUser.uid !== realUid) {
      throw new Error(`Authentication session mismatch: expected ${realUid}, got ${auth.currentUser?.uid}`);
    }

    return profile;
  },

  /**
   * Admin approves a pending user and assigns role
   * Calls: POST /api/v1/admin/user-approvals/:uid/approve
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

    await api.post(`/api/v1/admin/user-approvals/${targetUid}/approve`, {
      role: assignedRole,
      departmentId: cleanDeptId,
    });

    // Refresh claims if currently signed in user was modified
    if (auth.currentUser?.uid === targetUid) {
      await auth.currentUser.getIdToken(true);
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
    await api.post(`/api/v1/admin/user-approvals/${targetUid}/reject`, { reason });

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
    await api.post(`/api/v1/admin/citizens/${targetUid}/verify`, { verified });

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
