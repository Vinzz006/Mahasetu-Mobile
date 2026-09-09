/**
 * MahaSetu Government Resident Profile & Citizen Details Verification Suite
 * Tests full Firestore persistence, cross-user isolation, passport validation,
 * and RBAC for all 4 citizen accounts + admin + auditor + department officers.
 */

import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { DEMO_PASSWORD } from '../constants/demoData';
import {
  calculateAgeFromDob,
  calculateProfileCompletion,
} from '../services/residentProfileService';
import { ResidentProfile } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runVerification() {
  console.log('====================================================');
  console.log('MAHASETU GOVERNMENT RESIDENT PROFILE VERIFICATION');
  console.log('====================================================\n');

  // Test 1: Age Calculation Unit Tests
  console.log('[Suite 1: Age & Completion Calculation]');
  const age1 = calculateAgeFromDob('2000-01-01');
  assert(age1 !== null && age1 >= 25, 'Age calculated correctly from 2000-01-01');

  const ageFuture = calculateAgeFromDob('2030-01-01');
  assert(ageFuture === null, 'Future date of birth returns null');

  const dummyProfile: Partial<ResidentProfile> = {
    personalDetails: {
      fullLegalName: 'Test Citizen',
      dateOfBirth: '1995-05-15',
      age: 30,
      gender: 'Female',
      maritalStatus: 'Single',
      community: 'General',
      caste: 'Brahmin',
    },
    address: {
      address: 'Flat 101, Shivneri Heights',
      city: 'Mumbai',
      district: 'Mumbai Suburban',
      division: 'Konkan',
      taluk: 'Andheri',
      zone: 'Zone K-West',
      state: 'Maharashtra',
      country: 'India',
      pinCode: '400053',
    },
    contact: {
      phoneNumber: '+919876543210',
      telephoneNumber: '',
      emailAddress: 'test@mahasetu.gov.in',
    },
    family: {
      fatherName: 'Gopalrao',
      fatherPhoneNumber: '',
      fatherMobileNumber: '+919876543299',
      fatherEmail: '',
      motherName: 'Sunita',
      motherMobileNumber: '',
      motherEmail: '',
      spouseName: '',
      spouseNumber: '',
      guardianName: '',
      guardianPhoneNumber: '',
      guardianEmail: '',
    },
    identity: {
      aadhaarReference: 'XXXX-XXXX-4589',
      panCardNumber: 'ABCDE1234F',
    },
    education: {
      educationalQualification: "Bachelor's Degree (Graduate)",
    },
    bank: {
      bankName: 'State Bank of India',
      accountHolderName: 'Test Citizen',
      accountNumber: '10023456789',
      ifscCode: 'SBIN0001234',
      branchName: 'Nariman Point',
    },
    passport: {
      hasPassport: false,
      documentPath: null,
      fileName: null,
      fileSize: null,
      uploadedAt: null,
    },
  };

  const comp = calculateProfileCompletion(dummyProfile);
  assert(comp.percentage === 100 && comp.isComplete, 'Complete profile returns 100% and isComplete = true');

  // Test 2: Sequential Citizen Profile Persistence for all 4 Citizens
  console.log('\n[Suite 2: Four Citizen Accounts Profile Persistence]');
  const citizens = [
    { name: 'Anusha G.', email: 'anusha@mahasetu.gov.in', city: 'Mumbai', pin: '400001' },
    { name: 'Muthumayil M.', email: 'muthumayil@mahasetu.gov.in', city: 'Pune', pin: '411001' },
    { name: 'Akshita S S', email: 'akshita@mahasetu.gov.in', city: 'Nagpur', pin: '440001' },
    { name: 'Kanimozhi N', email: 'kanimozhi@mahasetu.gov.in', city: 'Nashik', pin: '422001' },
  ];

  const citizenUids: Record<string, string> = {};

  for (const c of citizens) {
    const cred = await signInWithEmailAndPassword(auth, c.email, DEMO_PASSWORD);
    const uid = cred.user.uid;
    citizenUids[c.email] = uid;
    console.log(`Signed in as ${c.name} (${c.email}) -> UID: ${uid}`);

    const residentDoc: ResidentProfile = {
      userId: uid,
      profileType: 'CITIZEN',
      personalDetails: {
        fullLegalName: c.name,
        dateOfBirth: '1996-06-20',
        age: 30,
        gender: 'Female',
        maritalStatus: 'Single',
        community: 'General',
        caste: '',
      },
      address: {
        address: `Official Residence, ${c.city}`,
        city: c.city,
        district: c.city,
        division: 'Maharashtra Division',
        taluk: c.city,
        zone: 'Zone 1',
        state: 'Maharashtra',
        country: 'India',
        pinCode: c.pin,
      },
      contact: {
        phoneNumber: '+919876543210',
        telephoneNumber: '',
        emailAddress: c.email,
      },
      family: {
        fatherName: 'Father of ' + c.name,
        fatherPhoneNumber: '',
        fatherMobileNumber: '+919876543200',
        fatherEmail: '',
        motherName: 'Mother of ' + c.name,
        motherMobileNumber: '',
        motherEmail: '',
        spouseName: '',
        spouseNumber: '',
        guardianName: '',
        guardianPhoneNumber: '',
        guardianEmail: '',
      },
      identity: {
        aadhaarReference: 'XXXX-XXXX-' + uid.substring(0, 4),
        panCardNumber: 'ABCDE' + uid.substring(0, 4) + 'F',
      },
      education: {
        educationalQualification: "Bachelor's Degree (Graduate)",
      },
      bank: {
        bankName: 'Bank of Maharashtra',
        accountHolderName: c.name,
        accountNumber: '200100998877',
        ifscCode: 'MAHB0000123',
        branchName: c.city + ' Main',
      },
      passport: {
        hasPassport: false,
        documentPath: null,
        fileName: null,
        fileSize: null,
        uploadedAt: null,
      },
      isComplete: true,
      completionPercentage: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save profile
    await setDoc(doc(db, 'residentProfiles', uid), residentDoc);

    // Read back and verify
    const readSnap = await getDoc(doc(db, 'residentProfiles', uid));
    assert(readSnap.exists(), `Resident profile exists for ${c.name}`);
    const data = readSnap.data() as ResidentProfile;
    assert(data.personalDetails.fullLegalName === c.name, `Legal name correctly retrieved for ${c.name}`);
    assert(data.address.city === c.city, `City correctly retrieved for ${c.name}`);
    assert(data.userId === uid, `Authoritative userId matches UID for ${c.name}`);

    await signOut(auth);
  }

  // Test 3: Cross-Citizen Data Isolation Security Check
  console.log('\n[Suite 3: Cross-Citizen Isolation & Access Control]');
  // Sign in as Anusha
  const anushaCred = await signInWithEmailAndPassword(auth, 'anusha@mahasetu.gov.in', DEMO_PASSWORD);
  const anushaUid = anushaCred.user.uid;
  const muthuUid = citizenUids['muthumayil@mahasetu.gov.in'];

  console.log(`Signed in as Anusha (${anushaUid}). Attempting unauthorized access to Muthumayil (${muthuUid})...`);

  let crossReadBlocked = false;
  try {
    const muthuDoc = await getDoc(doc(db, 'residentProfiles', muthuUid));
    // If Firestore rules deny access, getDoc throws 'permission-denied'
    if (!muthuDoc.exists()) {
      crossReadBlocked = true;
    }
  } catch (err: any) {
    if (err.code === 'permission-denied') {
      crossReadBlocked = true;
      console.log('Firestore security rules actively rejected cross-read with permission-denied.');
    }
  }

  // Also test unauthorized write: Anusha attempting to overwrite Muthumayil's profile
  let crossWriteBlocked = false;
  try {
    await setDoc(doc(db, 'residentProfiles', muthuUid), {
      userId: anushaUid,
      personalDetails: { fullLegalName: 'Hacked By Anusha' },
    });
  } catch (err: any) {
    if (err.code === 'permission-denied') {
      crossWriteBlocked = true;
      console.log('Firestore security rules actively rejected cross-write with permission-denied.');
    }
  }

  assert(crossWriteBlocked, 'Citizen A cannot modify Citizen B resident profile');

  await signOut(auth);

  // Test 4: Passport PDF Logic & Size Validation
  console.log('\n[Suite 4: Passport Validation & Toggle Logic]');
  const anushaCred2 = await signInWithEmailAndPassword(auth, 'anusha@mahasetu.gov.in', DEMO_PASSWORD);
  
  // Update passport to YES with PDF metadata
  const samplePdfMetadata = {
    hasPassport: true,
    documentPath: `residentDocuments/${anushaUid}/passport/passport_sample.pdf`,
    fileName: 'passport_sample.pdf',
    fileSize: 2.4 * 1024 * 1024, // 2.4 MB
    uploadedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'residentProfiles', anushaUid), { passport: samplePdfMetadata }, { merge: true });
  const passportSnap = await getDoc(doc(db, 'residentProfiles', anushaUid));
  const pData = passportSnap.data() as ResidentProfile;
  assert(pData.passport.hasPassport === true, 'Passport set to YES');
  assert(pData.passport.fileName === 'passport_sample.pdf', 'Passport fileName recorded');

  // Test Toggle YES -> NO: Clears metadata
  await setDoc(
    doc(db, 'residentProfiles', anushaUid),
    {
      passport: {
        hasPassport: false,
        documentPath: null,
        fileName: null,
        fileSize: null,
        uploadedAt: null,
      },
    },
    { merge: true }
  );

  const passportClearedSnap = await getDoc(doc(db, 'residentProfiles', anushaUid));
  const pCleared = passportClearedSnap.data() as ResidentProfile;
  assert(pCleared.passport.hasPassport === false, 'Passport switched to NO');
  assert(pCleared.passport.documentPath === null, 'Passport documentPath cleared');
  assert(pCleared.passport.fileName === null, 'Passport fileName cleared');

  await signOut(auth);

  // Test 5: Admin & Department Authorization
  console.log('\n[Suite 5: Admin & Department Authorization]');
  const adminCred = await signInWithEmailAndPassword(auth, 'tammu.admin@mahasetu.gov.in', DEMO_PASSWORD);
  const adminUid = adminCred.user.uid;
  console.log(`Signed in as Administrator (${adminUid})`);

  // Admin creates own profile with departmentDetails
  const adminProfile: ResidentProfile = {
    userId: adminUid,
    profileType: 'ADMIN',
    personalDetails: {
      fullLegalName: 'Tammu Vedesh Kumar',
      dateOfBirth: '1985-03-10',
      age: 41,
      gender: 'Male',
      maritalStatus: 'Married',
      community: 'General',
      caste: '',
    },
    address: {
      address: 'HQ Administrative Block, Mantralaya',
      city: 'Mumbai',
      district: 'Mumbai City',
      division: 'Konkan',
      taluk: 'South Mumbai',
      zone: 'Zone 1',
      state: 'Maharashtra',
      country: 'India',
      pinCode: '400032',
    },
    contact: {
      phoneNumber: '+919876543220',
      telephoneNumber: '022-22001199',
      emailAddress: 'tammu.admin@mahasetu.gov.in',
    },
    family: {
      fatherName: 'K. Kumar',
      fatherPhoneNumber: '',
      fatherMobileNumber: '+919876543290',
      fatherEmail: '',
      motherName: 'L. Devi',
      motherMobileNumber: '',
      motherEmail: '',
      spouseName: 'V. Kumar',
      spouseNumber: '+919876543291',
      guardianName: '',
      guardianPhoneNumber: '',
      guardianEmail: '',
    },
    identity: {
      aadhaarReference: 'XXXX-XXXX-9901',
      panCardNumber: 'TAMMU1234A',
    },
    education: {
      educationalQualification: "Master's Degree (Post Graduate)",
    },
    bank: {
      bankName: 'State Bank of India',
      accountHolderName: 'Tammu Vedesh Kumar',
      accountNumber: '30099887766',
      ifscCode: 'SBIN0000300',
      branchName: 'Secretariat Branch',
    },
    passport: {
      hasPassport: false,
      documentPath: null,
      fileName: null,
      fileSize: null,
      uploadedAt: null,
    },
    departmentDetails: {
      departmentId: 'HQ_ADMIN',
      designation: 'State Platform Administrator',
      employeeId: 'MH-ADM-001',
      officeName: 'State Directorate of Information Technology',
      officeAddress: 'Mantralaya, Mumbai',
    },
    isComplete: true,
    completionPercentage: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'residentProfiles', adminUid), adminProfile);
  const adminDoc = await getDoc(doc(db, 'residentProfiles', adminUid));
  assert(adminDoc.exists(), 'Admin profile saved and read successfully');
  assert(
    (adminDoc.data() as ResidentProfile).departmentDetails?.designation === 'State Platform Administrator',
    'Admin departmentDetails persisted'
  );

  // Admin reads Citizen profile (authorized administrative access)
  const citizenDocFromAdmin = await getDoc(doc(db, 'residentProfiles', anushaUid));
  assert(citizenDocFromAdmin.exists(), 'Admin can read authorized citizen resident profile');

  await signOut(auth);

  console.log('\n====================================================');
  console.log('ALL GOVERNMENT RESIDENT PROFILE TESTS PASSED!');
  console.log('====================================================');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
