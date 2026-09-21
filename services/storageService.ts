import { auth, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

/**
 * Sanitizes a client-provided file name to prevent path traversal and injection.
 * Strips path separators, limits length, and validates file extension.
 */
export function sanitizeFileName(rawFileName: string): string {
  // Strip any directory traversal or path characters
  let clean = rawFileName.replace(/^.*[\\\/]/, '').trim();
  // Strip characters outside safe alphanumeric set
  clean = clean.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Truncate length
  if (clean.length > 100) {
    const extIdx = clean.lastIndexOf('.');
    const ext = extIdx !== -1 ? clean.slice(extIdx) : '';
    clean = clean.slice(0, 100 - ext.length) + ext;
  }
  const ext = clean.lastIndexOf('.') !== -1 ? clean.slice(clean.lastIndexOf('.')).toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Disallowed file extension "${ext}". Allowed: .pdf, .jpg, .jpeg, .png`);
  }
  return clean;
}

export const storageService = {
  /**
   * Upload an application supporting document (income certificate, caste cert, fee receipt)
   * Stored under: users/{uid}/applications/{appId}/{docType}_{timestamp}_{sanitizedFileName}
   * Controlled access: only citizen owner and authorized verifiers can access.
   */
  async uploadApplicationDocument(
    applicationId: string,
    documentType: string,
    fileUri: string,
    rawFileName: string
  ): Promise<{ downloadUrl: string; storagePath: string; fileName: string; fileSize: number }> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated with Firebase to upload documents.');
    }
    const uid = user.uid;
    const safeFileName = sanitizeFileName(rawFileName);
    const cleanDocType = documentType.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 50);
    const storagePath = `users/${uid}/applications/${applicationId}/${cleanDocType}_${Date.now()}_${safeFileName}`;

    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();

      // Enforce file size on client
      if (blob.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`File size ${(blob.size / (1024 * 1024)).toFixed(2)} MB exceeds maximum limit of 10 MB.`);
      }

      // Enforce MIME type
      const mimeType = blob.type || 'application/octet-stream';
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new Error(`Invalid file type "${mimeType}". Allowed types: application/pdf, image/jpeg, image/png.`);
      }

      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, blob, {
        contentType: mimeType,
        customMetadata: {
          uploadedBy: uid,
          applicationId,
          documentType: cleanDocType,
        },
      });

      const downloadUrl = await getDownloadURL(snapshot.ref);

      return {
        downloadUrl,
        storagePath,
        fileName: safeFileName,
        fileSize: blob.size,
      };
    } catch (err: any) {
      console.error('[storageService] Document upload failed:', err);
      throw new Error(err.message || 'Document upload to Firebase Storage failed.');
    }
  },
};
