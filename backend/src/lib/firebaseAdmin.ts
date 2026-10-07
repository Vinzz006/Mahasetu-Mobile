import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp, Transaction, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAppCheck } from 'firebase-admin/app-check';
import { getStorage } from 'firebase-admin/storage';
import * as fs from 'fs';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'mahasetu-mobile-app';
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountEnv) {
    try {
      let serviceAccount: any;
      if (serviceAccountEnv.trim().startsWith('{')) {
        serviceAccount = JSON.parse(serviceAccountEnv);
      } else if (fs.existsSync(serviceAccountEnv.trim())) {
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountEnv.trim(), 'utf8'));
      }
      if (serviceAccount) {
        initializeApp({
          credential: cert(serviceAccount),
          projectId,
          storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
        });
      } else {
        initializeApp({
          credential: applicationDefault(),
          projectId,
          storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
        });
      }
    } catch (err: any) {
      console.warn('[FirebaseAdmin] Service account parse warning, falling back to applicationDefault:', err.message);
      initializeApp({
        credential: applicationDefault(),
        projectId,
        storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
      });
    }
  } else {
    initializeApp({
      credential: applicationDefault(),
      projectId,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    });
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
export const adminAppCheck = getAppCheck();
export const adminStorage = getStorage();
export { FieldValue, Timestamp, Transaction, QueryDocumentSnapshot };

