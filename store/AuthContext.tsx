import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/authService';
import { UserProfile, UserRole } from '../types';
import { DemoUser } from '../constants/demoData';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { auth } from '../lib/firebase';

export type AuthState =
  | 'Loading'
  | 'Authenticated'
  | 'Unauthenticated'
  | 'Pending approval'
  | 'Approved'
  | 'Suspended';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  authState: AuthState;
  isPendingApproval: boolean;
  isSuspended: boolean;
  signInWithEmail: (email: string, password: string) => Promise<UserProfile>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<UserProfile>;
  loginAsDemoUser: (demo: DemoUser) => Promise<UserProfile>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  routeUserByRole: (profile: UserProfile) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authState, setAuthState] = useState<AuthState>('Loading');

  const deriveAuthState = (profile: UserProfile | null): AuthState => {
    if (!profile) return 'Unauthenticated';
    if (profile.status === 'SUSPENDED') return 'Suspended';
    if (
      profile.status === 'PENDING' ||
      profile.status === 'REJECTED' ||
      profile.role === 'pending' ||
      !profile.role
    ) {
      return 'Pending approval';
    }
    if (profile.status === 'APPROVED') return 'Approved';
    return 'Authenticated';
  };

  useEffect(() => {
    const unsubAuth = authService.subscribeToAuth(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        setAuthState('Unauthenticated');
        return;
      }

      try {
        setAuthState('Loading');
        let profile = await authService.getUserProfile(firebaseUser.uid);
        if (!profile) {
          profile = await authService.initializeNewUserRecord(firebaseUser);
        }
        setUser(profile);
        setAuthState(deriveAuthState(profile));
      } catch (err) {
        console.warn('Error loading user profile:', err);
        setAuthState('Unauthenticated');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubAuth();
  }, []);

  // Listen to Firestore real-time updates for the authenticated user
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = authService.subscribeToUserProfile(user.uid, (updatedProfile) => {
      if (updatedProfile) {
        setUser(updatedProfile);
        setAuthState(deriveAuthState(updatedProfile));
        if (updatedProfile.status === 'APPROVED' && updatedProfile.role && updatedProfile.role !== 'pending') {
          // Refresh token claims immediately upon approval
          authService.refreshIdToken().then(() => {
            routeUserByRole(updatedProfile);
          });
        }
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const routeUserByRole = async (profile: UserProfile) => {
    let effectiveRole: string | null = profile.role || null;
    let effectiveStatus: string | null = profile.status || null;

    // Read authoritative role strictly from verified custom token claims
    if (auth.currentUser && !profile.uid.startsWith('demo-')) {
      try {
        const tokenResult = await auth.currentUser.getIdTokenResult(true);
        if (tokenResult.claims.role) {
          effectiveRole = tokenResult.claims.role as string;
        }
        if (tokenResult.claims.status) {
          effectiveStatus = tokenResult.claims.status as string;
        }
      } catch (err) {
        console.warn('[AuthContext] Error reading claims for routing:', err);
      }
    }

    if (effectiveStatus === 'SUSPENDED') {
      Alert.alert(
        'Account Suspended',
        'Your MahaSetu account has been suspended by an administrator. Please contact official administrative support.'
      );
      router.replace('/(auth)/login');
      return;
    }

    if (effectiveStatus === 'REJECTED') {
      Alert.alert(
        'Registration Rejected',
        'Your registration was reviewed and rejected. Please contact an administrator for more information.'
      );
      router.replace('/(auth)/login');
      return;
    }

    if (
      effectiveStatus === 'PENDING' ||
      effectiveRole === 'pending' ||
      !effectiveRole
    ) {
      router.replace('/(pending)');
      return;
    }

    const role = String(effectiveRole).toUpperCase();
    switch (role) {
      case 'CITIZEN':
        router.replace('/(citizen)/(tabs)');
        break;
      case 'DEPARTMENT_A':
      case 'DEPARTMENT_B':
      case 'DEPARTMENT_C':
      case 'DEPARTMENT_OFFICER':
        router.replace('/(department)/(tabs)');
        break;
      case 'ADMIN':
        router.replace('/(admin)/(tabs)');
        break;
      case 'AUDITOR':
        router.replace('/(auditor)/(tabs)');
        break;
      default:
        router.replace('/(pending)');
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<UserProfile> => {
    setLoading(true);
    setAuthState('Loading');
    try {
      const profile = await authService.signInWithEmail(email, password);
      setUser(profile);
      const state = deriveAuthState(profile);
      setAuthState(state);
      routeUserByRole(profile);
      return profile;
    } catch (e: any) {
      console.warn('Email sign-in error:', e?.message || e);
      setAuthState('Unauthenticated');
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemoUser = async (demo: DemoUser): Promise<UserProfile> => {
    setLoading(true);
    setAuthState('Loading');
    try {
      const profile = await authService.switchDemoAccount(demo);
      setUser(profile);
      const state = deriveAuthState(profile);
      setAuthState(state);
      await routeUserByRole(profile);
      return profile;
    } catch (e: any) {
      console.warn('Demo login error:', e?.message || e);
      setAuthState('Unauthenticated');
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName: string
  ): Promise<UserProfile> => {
    setLoading(true);
    setAuthState('Loading');
    try {
      const profile = await authService.signUpWithEmail(email, password, displayName);
      setUser(profile);
      const state = deriveAuthState(profile);
      setAuthState(state);
      routeUserByRole(profile);
      return profile;
    } catch (e: any) {
      console.warn('Email sign-up error:', e?.message || e);
      setAuthState('Unauthenticated');
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    await authService.sendPasswordReset(email);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setAuthState('Unauthenticated');
    router.replace('/(auth)/login');
  };

  const refreshProfile = async () => {
    if (user?.uid) {
      await authService.refreshIdToken();
      const fresh = await authService.getUserProfile(user.uid);
      if (fresh) {
        setUser(fresh);
        setAuthState(deriveAuthState(fresh));
        if (fresh.status === 'APPROVED' && fresh.role && fresh.role !== 'pending') {
          routeUserByRole(fresh);
        }
      }
    }
  };

  const isPendingApproval = authState === 'Pending approval';
  const isSuspended = authState === 'Suspended';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authState,
        isPendingApproval,
        isSuspended,
        signInWithEmail,
        signUpWithEmail,
        loginAsDemoUser,
        sendPasswordReset,
        logout,
        refreshProfile,
        routeUserByRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useCurrentUser = (): UserProfile | null => {
  const { user } = useAuth();
  return user;
};

export const useRole = (): UserRole | undefined => {
  const { user } = useAuth();
  return user?.role;
};

export const useRequireRole = (allowedRoles: UserRole[]): { isAuthorized: boolean; loading: boolean } => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    const currentRole = user.role ? String(user.role).toUpperCase() : '';
    const isAllowed = allowedRoles.some((r) => {
      if (!r) return false;
      const target = String(r).toUpperCase();
      return (
        target === currentRole ||
        (target === 'DEPARTMENT_OFFICER' && ['DEPARTMENT_A', 'DEPARTMENT_B', 'DEPARTMENT_C'].includes(currentRole))
      );
    });

    if (!isAllowed) {
      console.warn(`Unauthorized role access attempt: ${user.role}. Allowed:`, allowedRoles);
      router.replace('/(auth)/login');
    }
  }, [user, loading, allowedRoles]);

  const isAuthorized =
    !loading &&
    !!user &&
    allowedRoles.some((r) => {
      if (!r || !user.role) return false;
      const currentRole = String(user.role).toUpperCase();
      const target = String(r).toUpperCase();
      return (
        target === currentRole ||
        (target === 'DEPARTMENT_OFFICER' && ['DEPARTMENT_A', 'DEPARTMENT_B', 'DEPARTMENT_C'].includes(currentRole))
      );
    });

  return { isAuthorized, loading };
};
