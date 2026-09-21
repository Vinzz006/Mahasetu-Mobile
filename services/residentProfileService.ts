import { db, auth, storage } from '../lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import { ResidentProfile, UserProfile } from '../types';
import { api } from './api';
import { validateAadhaar, maskAadhaar } from '../lib/aadhaar';

/**
 * Calculates accurate age from a Date of Birth string (YYYY-MM-DD).
 * Returns null if invalid or in the future.
 */
export function calculateAgeFromDob(dobString: string): number | null {
  if (!dobString || !dobString.trim()) return null;
  const parts = dobString.trim().split('-');
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const birthDate = new Date(year, month, day);
  const today = new Date();

  if (birthDate > today) return null; // Date of birth cannot be in the future

  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

/**
 * Computes profile completion percentage and human-readable missing fields.
 */
export function calculateProfileCompletion(profile: Partial<ResidentProfile>): {
  percentage: number;
  isComplete: boolean;
  missingFields: string[];
} {
  const missing: string[] = [];

  // Required Fields
  const p = profile.personalDetails;
  if (!p?.fullLegalName?.trim()) missing.push('Full Legal Name');
  if (!p?.dateOfBirth?.trim()) missing.push('Date of Birth');
  if (!p?.gender) missing.push('Gender');
  if (!p?.maritalStatus) missing.push('Marital Status');
  if (!p?.community) missing.push('Community');

  const addr = profile.address;
  if (!addr?.address?.trim()) missing.push('Residential Address');
  if (!addr?.city?.trim()) missing.push('City');
  if (!addr?.district?.trim()) missing.push('District');
  if (!addr?.state?.trim()) missing.push('State');
  if (!addr?.pinCode?.trim()) missing.push('PIN Code');

  const c = profile.contact;
  if (!c?.phoneNumber?.trim()) missing.push('Phone Number');
  if (!c?.emailAddress?.trim()) missing.push('Email Address');

  const f = profile.family;
  const hasParentOrGuardian =
    f?.fatherName?.trim() || f?.motherName?.trim() || f?.guardianName?.trim();
  if (!hasParentOrGuardian) missing.push('Parent / Guardian Name');

  const id = profile.identity;
  if (!id?.aadhaarReference?.trim()) missing.push('Aadhaar Reference');
  if (!id?.panCardNumber?.trim()) missing.push('PAN Card Number');

  const edu = profile.education;
  if (!edu?.educationalQualification?.trim()) missing.push('Educational Qualification');

  const b = profile.bank;
  if (!b?.bankName?.trim()) missing.push('Bank Name');
  if (!b?.accountHolderName?.trim()) missing.push('Account Holder Name');
  if (!b?.accountNumber?.trim()) missing.push('Bank Account Number');
  if (!b?.ifscCode?.trim()) missing.push('IFSC Code');

  const pass = profile.passport;
  if (pass?.hasPassport && !pass.documentPath) {
    missing.push('Passport Document PDF');
  }

  const totalChecks = 19;
  const filledCount = Math.max(0, totalChecks - missing.length);
  const percentage = Math.round((filledCount / totalChecks) * 100);
  const isComplete = missing.length === 0;

  return { percentage, isComplete, missingFields: missing };
}

/**
 * Creates an empty/default structured ResidentProfile template,
 * pre-populating available identity data from the authenticated UserProfile.
 */
export function createDefaultProfileTemplate(
  uid: string,
  userDefaults?: Partial<UserProfile> | null
): ResidentProfile {
  return {
    userId: uid,
    profileType: (userDefaults?.role || 'CITIZEN').toUpperCase(),

    personalDetails: {
      fullLegalName: userDefaults?.name || userDefaults?.displayName || '',
      dateOfBirth: '',
      age: null,
      gender: '',
      maritalStatus: '',
      community: '',
      caste: '',
    },

    address: {
      address: '',
      city: userDefaults?.city || '',
      district: userDefaults?.district || '',
      division: '',
      taluk: '',
      zone: '',
      state: userDefaults?.state || 'Maharashtra',
      country: 'India',
      pinCode: userDefaults?.pinCode || '',
    },

    contact: {
      phoneNumber: userDefaults?.phone || userDefaults?.phoneNumber || '',
      telephoneNumber: '',
      emailAddress: userDefaults?.email || '',
    },

    family: {
      fatherName: '',
      fatherPhoneNumber: '',
      fatherMobileNumber: '',
      fatherEmail: '',
      motherName: '',
      motherMobileNumber: '',
      motherEmail: '',
      spouseName: '',
      spouseNumber: '',
      guardianName: '',
      guardianPhoneNumber: '',
      guardianEmail: '',
    },

    identity: {
      aadhaarReference: userDefaults?.aadhaarRef || '',
      panCardNumber: '',
    },

    education: {
      educationalQualification: '',
    },

    bank: {
      bankName: '',
      accountHolderName: userDefaults?.name || '',
      accountNumber: '',
      ifscCode: '',
      branchName: '',
    },

    passport: {
      hasPassport: false,
      documentPath: null,
      fileName: null,
      fileSize: null,
      uploadedAt: null,
    },

    departmentDetails: userDefaults?.departmentId
      ? {
          departmentId: String(userDefaults.departmentId),
          designation: userDefaults.role === 'admin' ? 'State Platform Administrator' : 'Verification Officer',
          employeeId: '',
          officeName: '',
          officeAddress: '',
        }
      : undefined,

    isComplete: false,
    completionPercentage: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const residentProfileService = {
  /**
   * Retrieves a ResidentProfile for a specific UID from Firestore.
   */
  async getResidentProfile(uid: string): Promise<ResidentProfile | null> {
    if (!uid) return null;
    try {
      const snap = await getDoc(doc(db, 'residentProfiles', uid));
      if (snap.exists()) {
        return snap.data() as ResidentProfile;
      }
    } catch (err: any) {
      console.warn('[residentProfileService] getResidentProfile client warning, trying API:', err.message);
    }

    try {
      const resp = await api.get<ResidentProfile>('/api/v1/resident-profile');
      if (resp && resp.userId === uid) {
        return resp;
      }
    } catch {
      // Return null if not found
    }
    return null;
  },

  /**
   * Subscribes to real-time updates for a ResidentProfile.
   */
  subscribeToResidentProfile(
    uid: string,
    onUpdate: (profile: ResidentProfile | null) => void
  ): () => void {
    if (!uid) {
      onUpdate(null);
      return () => {};
    }

    const docRef = doc(db, 'residentProfiles', uid);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate(snapshot.data() as ResidentProfile);
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.warn('[residentProfileService] subscribe warning:', error.message);
        onUpdate(null);
      }
    );
  },

  /**
   * Saves or updates a resident profile in Firestore.
   * Enforces that the authenticated user is the document owner.
   */
  async saveResidentProfile(
    profileData: Partial<ResidentProfile> & { userId: string }
  ): Promise<ResidentProfile> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated to save a resident profile.');
    }

    // Ownership check
    if (currentUser.uid !== profileData.userId) {
      throw new Error('Access denied: Cannot modify another user resident profile.');
    }

    // Auto-calculate age if DOB is present
    if (profileData.personalDetails?.dateOfBirth) {
      profileData.personalDetails.age = calculateAgeFromDob(
        profileData.personalDetails.dateOfBirth
      );
    }

    // Format PAN uppercase
    if (profileData.identity?.panCardNumber) {
      profileData.identity.panCardNumber = profileData.identity.panCardNumber.trim().toUpperCase();
    }

    // Aadhaar Verhoeff validation and masking (DPDP & Aadhaar Act compliance)
    if (profileData.identity?.aadhaarReference) {
      const rawAadhaar = profileData.identity.aadhaarReference.replace(/[\s-]/g, '');
      if (/^\d{12}$/.test(rawAadhaar)) {
        const validation = validateAadhaar(rawAadhaar);
        if (!validation.isValid) {
          throw new Error(validation.error || 'Invalid Aadhaar number format or checksum.');
        }
        profileData.identity.aadhaarLast4 = rawAadhaar.slice(-4);
        profileData.identity.aadhaarReference = maskAadhaar(rawAadhaar);
      } else if (!rawAadhaar.startsWith('XXXX-XXXX-') && !rawAadhaar.startsWith('XXXXXXXX')) {
        // If not a 12-digit number and not already masked, validate
        if (rawAadhaar.length === 12) {
          const validation = validateAadhaar(rawAadhaar);
          if (!validation.isValid) {
            throw new Error(validation.error || 'Invalid Aadhaar number.');
          }
        }
      }
    }

    // Calculate completion metrics
    const { percentage, isComplete } = calculateProfileCompletion(profileData);
    profileData.completionPercentage = percentage;
    profileData.isComplete = isComplete;
    if (profileData.certificationStatus !== 'VERIFIED') {
      profileData.certificationStatus = 'PENDING';
    }
    profileData.updatedAt = new Date().toISOString();

    const docRef = doc(db, 'residentProfiles', profileData.userId);

    // Clean payload of any undefined values
    const cleaned = JSON.parse(JSON.stringify(profileData));

    try {
      await setDoc(docRef, cleaned, { merge: true });

      // Synchronize flag to users collection so queries are efficient
      try {
        const uRef = doc(db, 'users', profileData.userId);
        await setDoc(
          uRef,
          {
            hasResidentProfile: true,
            identityStatus: profileData.certificationStatus || 'PENDING',
            profileCompletion: percentage,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (uErr: any) {
        console.warn('[residentProfileService] users sync warning:', uErr.message);
      }

      return cleaned as ResidentProfile;
    } catch (firestoreErr: any) {
      console.warn('[residentProfileService] Direct Firestore write failed, saving via backend API:', firestoreErr.message);
      const apiResp = await api.post<{ success: boolean; profile: ResidentProfile }>(
        '/api/v1/resident-profile',
        cleaned
      );
      if (apiResp && apiResp.profile) {
        return apiResp.profile;
      }
      return cleaned as ResidentProfile;
    }
  },

  /**
   * Uploads a Passport PDF to Firebase Storage under residentDocuments/{uid}/passport/{fileName}.
   * Validates that the file is PDF and <= 10 MB (10 * 1024 * 1024 bytes).
   */
  async uploadPassportDocument(
    fileUri: string,
    rawFileName: string,
    fileSize: number
  ): Promise<{ storagePath: string; fileName: string; fileSize: number; uploadedAt: string }> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated with Firebase to upload passport documents.');
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB in bytes
    if (fileSize > MAX_SIZE) {
      throw new Error('Passport document must be a PDF file smaller than 10 MB.');
    }

    const cleanName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!cleanName.toLowerCase().endsWith('.pdf')) {
      throw new Error('Passport document must be a PDF file smaller than 10 MB.');
    }

    const uid = currentUser.uid;
    const storagePath = `residentDocuments/${uid}/passport/${Date.now()}_${cleanName}`;

    const response = await fetch(fileUri);
    const blob = await response.blob();

    if (blob.size > MAX_SIZE) {
      throw new Error('Passport document must be a PDF file smaller than 10 MB.');
    }

    const storageReference = ref(storage, storagePath);
    await uploadBytes(storageReference, blob, {
      contentType: 'application/pdf',
      customMetadata: {
        userId: uid,
        documentType: 'passport',
      },
    });

    const uploadedAt = new Date().toISOString();
    return {
      storagePath,
      fileName: cleanName,
      fileSize: blob.size || fileSize,
      uploadedAt,
    };
  },

  /**
   * Deletes an existing passport document from Firebase Storage.
   */
  async deletePassportDocument(storagePath: string): Promise<void> {
    if (storagePath) {
      try {
        const storageReference = ref(storage, storagePath);
        await deleteObject(storageReference);
      } catch (err: any) {
        // If file doesn't exist or already removed, continue silently
        console.warn('[residentProfileService] deletePassport storage warning:', err.message);
      }
    }

    try {
      await api.delete('/api/v1/resident-profile/passport');
    } catch (apiErr: any) {
      console.warn('[residentProfileService] deletePassport API warning:', apiErr.message);
    }
  },
};
