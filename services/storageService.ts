import { db, auth, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';

export const storageService = {
  /**
   * Upload an application supporting document (income certificate, caste cert, fee receipt)
   * Stored under: users/{uid}/applications/{appId}/documents/{docType}_{timestamp}.ext
   * Controlled access: only citizen owner and authorized verifiers can access.
   */
  async uploadApplicationDocument(
    applicationId: string,
    documentType: string,
    fileUri: string,
    fileName: string
  ): Promise<{ downloadUrl: string; storagePath: string }> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated with Firebase to upload documents.');
    }
    const uid = user.uid;
    const cleanDocType = documentType.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const storagePath = `users/${uid}/applications/${applicationId}/${cleanDocType}_${Date.now()}_${fileName}`;

    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();
      const storageRef = ref(storage, storagePath);

      const snapshot = await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      return { downloadUrl, storagePath };
    } catch (err: any) {
      console.error('[storageService] Document upload failed:', err);
      throw new Error(`Document upload to Firebase Storage failed: ${err.message || 'Network error'}`);
    }
  },
};
