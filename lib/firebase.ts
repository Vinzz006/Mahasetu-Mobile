import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  // @ts-ignore - Exported at runtime in React Native (@firebase/auth/dist/rn/index.js)
  getReactNativePersistence,
  browserLocalPersistence,
  Auth,
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../constants/config';

export const firebaseConfig = {
  apiKey: Config.FIREBASE_API_KEY,
  authDomain: Config.FIREBASE_AUTH_DOMAIN,
  projectId: Config.FIREBASE_PROJECT_ID,
  storageBucket: Config.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Config.FIREBASE_MESSAGING_SENDER_ID,
  appId: Config.FIREBASE_APP_ID,
  measurementId: Config.FIREBASE_MEASUREMENT_ID,
};

// Singleton Firebase App initialization: reuse existing instance if already initialized
export const app: FirebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

/**
 * Singleton Firebase Auth initialization.
 * Uses AsyncStorage persistence on React Native (iOS/Android) via getReactNativePersistence,
 * and browserLocalPersistence in Web environments.
 * Idempotently handles hot-reloads to prevent 'auth/already-initialized' errors.
 */
function getOrInitializeAuth(): Auth {
  try {
    // React Native environment (iOS / Android): use getReactNativePersistence with AsyncStorage
    if (typeof getReactNativePersistence === 'function') {
      try {
        return initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      } catch (initErr: any) {
        if (initErr?.code === 'auth/already-initialized' || initErr?.message?.includes('already has an instance')) {
          return getAuth(app);
        }
        throw initErr;
      }
    }

    // Web browser environment
    if (typeof window !== 'undefined') {
      try {
        return initializeAuth(app, {
          persistence: browserLocalPersistence,
        });
      } catch (initErr: any) {
        if (initErr?.code === 'auth/already-initialized' || initErr?.message?.includes('already has an instance')) {
          return getAuth(app);
        }
        return getAuth(app);
      }
    }

    // Node.js or fallback environment
    try {
      return getAuth(app);
    } catch {
      return initializeAuth(app);
    }
  } catch (err: any) {
    if (err?.code === 'auth/already-initialized' || err?.message?.includes('already has an instance')) {
      return getAuth(app);
    }
    console.error('Firebase Auth initialization error:', err);
    return getAuth(app);
  }
}

export const auth: Auth = getOrInitializeAuth();
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

/**
 * Recursively sanitizes Firestore write payloads to prevent `undefined` field errors.
 * Replaces `undefined` values with `null` for non-applicable / optional fields,
 * while preserving primitives, arrays, nested objects, and FieldValues (serverTimestamp, etc.).
 */
export function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  // Handle Date, serverTimestamp or Firestore FieldValues (they have _methodName or constructor other than Object)
  if (obj instanceof Date || (obj as any)?._methodName !== undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => (item === undefined ? null : sanitizeFirestorePayload(item))) as any;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      result[key] = null;
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      (value as any)?._methodName === undefined
    ) {
      result[key] = sanitizeFirestorePayload(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Assertion utility that validates no `undefined` values exist in a payload before Firestore commit.
 * Throws a descriptive error indicating the document path and offending field if any are found.
 */
export function assertNoUndefinedValues(payload: Record<string, any>, documentContext: string): void {
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) {
      throw new Error(
        `Firestore Write Error: Field "${key}" is undefined in document "${documentContext}". All optional fields must be null, not undefined.`
      );
    }
    if (value !== null && typeof value === 'object' && !(value instanceof Date) && (value as any)?._methodName === undefined) {
      assertNoUndefinedValues(value, `${documentContext}.${key}`);
    }
  }
}
