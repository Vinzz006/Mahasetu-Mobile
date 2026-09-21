import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
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
        });
      } else {
        initializeApp({
          credential: applicationDefault(),
          projectId,
        });
      }
    } catch (err: any) {
      console.warn('[FirebaseAdmin] Service account parse warning, falling back to applicationDefault:', err.message);
      initializeApp({
        credential: applicationDefault(),
        projectId,
      });
    }
  } else {
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
export { FieldValue, Timestamp };
