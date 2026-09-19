import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { config } from '../constants/config';
import { app, auth, db, sanitizeFirestorePayload, assertNoUndefinedValues } from '../lib/firebase';

const DEFAULT_PASSWORD = 'MahaSetu@2026!';

interface PersonaSeed {
  email: string;
  name: string;
  role: 'CITIZEN' | 'DEPARTMENT_A' | 'DEPARTMENT_B' | 'DEPARTMENT_C' | 'ADMIN' | 'AUDITOR' | null;
  departmentId: string | null;
  status: 'PENDING' | 'APPROVED';
  isActive: boolean;
  phone: string;
  city: string;
  district: string;
  state: string;
  pinCode: string;
  aadhaarRef: string;
  isVerified: boolean;
}

const PERSONAS: PersonaSeed[] = [
  // 1-4 Citizens
  {
    email: 'citizen.priya@mahasetu.gov.in',
    name: 'Priya Sharma',
    role: 'CITIZEN',
    departmentId: null,
    status: 'APPROVED',
    isActive: true,
    phone: '+919876543210',
    city: 'Mumbai',
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    pinCode: '400001',
    aadhaarRef: 'XXXX-XXXX-4589',
    isVerified: true,
  },
  {
    email: 'citizen.rahul@mahasetu.gov.in',
    name: 'Rahul Verma',
    role: 'CITIZEN',
    departmentId: null,
    status: 'APPROVED',
    isActive: true,
    phone: '+919876543211',
    city: 'Pune',
    district: 'Pune',
    state: 'Maharashtra',
    pinCode: '411001',
    aadhaarRef: 'XXXX-XXXX-8821',
    isVerified: true,
  },
  {
    email: 'citizen.sneha@mahasetu.gov.in',
    name: 'Sneha Patil',
    role: 'CITIZEN',
    departmentId: null,
    status: 'APPROVED',
    isActive: true,
    phone: '+919876543212',
    city: 'Nagpur',
    district: 'Nagpur',
    state: 'Maharashtra',
    pinCode: '440001',
    aadhaarRef: 'XXXX-XXXX-3342',
    isVerified: false,
  },
  {
    email: 'citizen.pooja@mahasetu.gov.in',
    name: 'Pooja Kulkarni',
    role: 'CITIZEN',
    departmentId: null,
    status: 'APPROVED',
    isActive: true,
    phone: '+919876543213',
    city: 'Nashik',
    district: 'Nashik',
    state: 'Maharashtra',
    pinCode: '422001',
    aadhaarRef: 'XXXX-XXXX-7719',
    isVerified: false,
  },

  // 5-7 Department Officers
  {
    email: 'officer.dept_a@mahasetu.gov.in',
    name: 'Ramesh Kumar',
    role: 'DEPARTMENT_A',
    departmentId: 'DEPT_A',
    status: 'APPROVED',
    isActive: true,
    phone: '+919876543214',
    city: 'Mumbai',
    district: 'Mumbai City',
    state: 'Maharashtra',
    pinCode: '400032',
    aadhaarRef: 'XXXX-XXXX-1123',
    isVerified: true,
  },
  {
    email: 'officer.dept_b@mahasetu.gov.in',
    name: 'Suresh Joshi',
    role: 'DEPARTMENT_B',
    departmentId: 'DEPT_B',
    status: 'APPROVED',
    isActive: true,
    phone: '+919876543215',
    city: 'Pune',
    district: 'Pune',
    state: 'Maharashtra',
    pinCode: '411002',
    aadhaarRef: 'XXXX-XXXX-2234',
    isVerified: true,
  },
  {
    email: 'officer.dept_c@mahasetu.gov.in',
    name: 'Mahesh Deshmukh',
    role: 'DEPARTMENT_C',
    departmentId: 'DEPT_C',
    status: 'APPROVED',
    isActive: true,
    phone: '+919876543216',
    city: 'Thane',
    district: 'Thane',
    state: 'Maharashtra',
    pinCode: '400601',
    aadhaarRef: 'XXXX-XXXX-3345',
    isVerified: true,
  },

  // 8-9 Administrators
  {
    email: 'admin.onboarding@mahasetu.gov.in',
    name: 'Anil Shinde',
    role: 'ADMIN',
    departmentId: null,
    status: 'APPROVED',
    isActive: true,
    phone: '+919876543217',
    city: 'Mumbai',
    district: 'Mantralaya',
    state: 'Maharashtra',
    pinCode: '400032',
    aadhaarRef: 'XXXX-XXXX-4456',
    isVerified: true,
  },
  {
    email: 'admin.system@mahasetu.gov.in',
    name: 'Vijay Patil',
    role: 'ADMIN',
    departmentId: null,
    status: 'APPROVED',
    isActive: true,
    phone: '+919876543218',
    city: 'Mumbai',
    district: 'Mantralaya',
    state: 'Maharashtra',
    pinCode: '400032',
    aadhaarRef: 'XXXX-XXXX-5567',
    isVerified: true,
  },

  // 10 Auditor
  {
    email: 'auditor.compliance@mahasetu.gov.in',
    name: 'Neha Deshpande',
    role: 'AUDITOR',
    departmentId: null,
    status: 'APPROVED',
    isActive: true,
    phone: '+919876543219',
    city: 'Mumbai',
    district: 'Bandra Kurla Complex',
    state: 'Maharashtra',
    pinCode: '400051',
    aadhaarRef: 'XXXX-XXXX-6678',
    isVerified: true,
  },

  // 11 Pending applicant (to test pending approval flow)
  {
    email: 'applicant.test@mahasetu.gov.in',
    name: 'Ramesh Patil',
    role: null,
    departmentId: null,
    status: 'PENDING',
    isActive: false,
    phone: '+919876500111',
    city: 'Solapur',
    district: 'Solapur',
    state: 'Maharashtra',
    pinCode: '413001',
    aadhaarRef: 'XXXX-XXXX-9901',
    isVerified: false,
  },
];

async function seedPersonas() {
  console.log('--- Phase 1: Ensuring all 10 Official Firebase Auth Accounts Exist ---');

  const uids: Record<string, string> = {};

  for (const persona of PERSONAS) {
    let uid = '';
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, persona.email, DEFAULT_PASSWORD);
      uid = userCredential.user.uid;
      console.log(`[AUTH CREATED] ${persona.name} (${persona.email}) -> UID: ${uid}`);
    } catch (authErr: any) {
      if (authErr.code === 'auth/email-already-in-use') {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, persona.email, DEFAULT_PASSWORD);
          uid = userCredential.user.uid;
          console.log(`[AUTH EXISTS] ${persona.name} (${persona.email}) -> Logged in UID: ${uid}`);
        } catch (signInErr: any) {
          console.warn(`[AUTH WARN] Could not sign in existing ${persona.email}: ${signInErr.message}`);
          uid = `uid_${persona.email.split('@')[0]}`;
        }
      } else {
        console.warn(`[AUTH ERR] Error for ${persona.email}: ${authErr.message}`);
        uid = `uid_${persona.email.split('@')[0]}`;
      }
    }
    uids[persona.email] = uid;
  }

  console.log('\n--- Phase 2: Authenticating as Administrator to Write Firestore Documents ---');
  const adminCred = await signInWithEmailAndPassword(auth, 'admin.onboarding@mahasetu.gov.in', DEFAULT_PASSWORD);
  console.log(`[ADMIN AUTH ACTIVE] Anil Shinde (${adminCred.user.uid})`);

  for (const persona of PERSONAS) {
    const uid = uids[persona.email];
    if (!uid) continue;

    const userDocRef = doc(db, 'users', uid);
    const userPayload = sanitizeFirestorePayload({
      uid,
      email: persona.email,
      name: persona.name,
      displayName: persona.name,
      role: persona.role,
      departmentId: persona.departmentId,
      status: persona.status,
      isActive: persona.isActive,
      phone: persona.phone,
      phoneNumber: persona.phone,
      city: persona.city,
      district: persona.district,
      state: persona.state,
      pinCode: persona.pinCode,
      aadhaarRef: persona.aadhaarRef,
      isVerified: persona.isVerified,
      verifiedAt: persona.isVerified ? new Date().toISOString() : null,
      verifiedBy: persona.isVerified ? 'admin_state_gov' : null,
      isDemo: persona.role === 'CITIZEN' || persona.email.startsWith('applicant.test'),
      recordType: (persona.role === 'CITIZEN' || persona.email.startsWith('applicant.test')) ? 'DEMO' : 'PRODUCTION',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    assertNoUndefinedValues(userPayload, `users/${uid}`);

    try {
      await setDoc(userDocRef, userPayload, { merge: true });
      console.log(`[FIRESTORE SAVED] users/${uid} (${persona.name} as ${persona.role || 'PENDING'})`);
    } catch (fsErr: any) {
      console.warn(`[FIRESTORE ERR] users/${uid}: ${fsErr.message}`);
    }
  }
}

async function seedDepartmentsAndServices() {
  console.log('\n--- Seeding Departments Registry & Services Catalogue ---');

  const departments = [
    {
      id: 'DEPARTMENT_A',
      name: 'Revenue & Civil Supplies Department',
      code: 'DEPARTMENT_A',
      active: true,
      description: 'Land records, income certification, and ration entitlements.',
    },
    {
      id: 'DEPARTMENT_B',
      name: 'Social Welfare & Inclusion Department',
      code: 'DEPARTMENT_B',
      active: true,
      description: 'Scholarships, pensions, caste certificates, and inclusion grants.',
    },
    {
      id: 'DEPARTMENT_C',
      name: 'Labour & Employment Welfare Department',
      code: 'DEPARTMENT_C',
      active: true,
      description: 'Unorganized worker registrations, artisan benefits, and skill grants.',
    },
  ];

  for (const dept of departments) {
    const deptRef = doc(db, 'departments', dept.id);
    const deptPayload = sanitizeFirestorePayload({
      ...dept,
      updatedAt: serverTimestamp(),
    });
    assertNoUndefinedValues(deptPayload, `departments/${dept.id}`);
    try {
      await setDoc(deptRef, deptPayload, { merge: true });
      console.log(`[DEPT SAVED] ${dept.name} (${dept.id})`);
    } catch (e: any) {
      console.warn(`[DEPT WARN] ${dept.id}: ${e.message}`);
    }
  }

  const services = [
    {
      id: 'icb-2026',
      name: 'Integrated Citizen Benefit Scheme (ICB-2026)',
      code: 'ICB-2026',
      description: 'Cross-departmental financial assistance requiring 5-party validation.',
      active: true,
      requiredDepartments: ['DEPARTMENT_A', 'DEPARTMENT_B', 'DEPARTMENT_C'],
    },
    {
      id: 'faw-2026',
      name: 'Farmers Agriculture & Welfare Grant',
      code: 'FAW-2026',
      description: 'Direct benefit transfer for agricultural equipment and crop insurance.',
      active: true,
      requiredDepartments: ['DEPARTMENT_A', 'DEPARTMENT_B'],
    },
    {
      id: 'sme-2026',
      name: 'Small Business & Artisan Subsidy',
      code: 'SME-2026',
      description: 'Seed capital subsidy and working equipment support for artisans.',
      active: true,
      requiredDepartments: ['DEPARTMENT_B', 'DEPARTMENT_C'],
    },
  ];

  for (const srv of services) {
    const srvRef = doc(db, 'services', srv.id);
    const srvPayload = sanitizeFirestorePayload({
      ...srv,
      updatedAt: serverTimestamp(),
    });
    assertNoUndefinedValues(srvPayload, `services/${srv.id}`);
    try {
      await setDoc(srvRef, srvPayload, { merge: true });
      console.log(`[SERVICE SAVED] ${srv.name}`);
    } catch (e: any) {
      console.warn(`[SERVICE WARN] ${srv.id}: ${e.message}`);
    }
  }

  // Seed initial system audit log
  const auditId = 'audit_system_init';
  const auditRef = doc(db, 'auditLogs', auditId);
  const auditPayload = sanitizeFirestorePayload({
    id: auditId,
    actorUid: 'system',
    actorName: 'MahaSetu Platform Seed Engine',
    actorRole: 'SYSTEM',
    action: 'SYSTEM_INITIALIZED',
    targetType: 'SYSTEM',
    targetId: config.firebase.projectId,
    details: 'Official 10 personas, departments registry, and service catalog initialized on dedicated mobile database.',
    ipAddress: '127.0.0.1',
    timestamp: serverTimestamp(),
  });
  assertNoUndefinedValues(auditPayload, `auditLogs/${auditId}`);
  try {
    await setDoc(auditRef, auditPayload, { merge: true });
    console.log(`[AUDIT SAVED] Initial statutory audit record established.`);
  } catch (e: any) {
    console.warn(`[AUDIT WARN] ${e.message}`);
  }
}

async function main() {
  console.log('========================================================');
  console.log(` MAHASETU MOBILE FIREBASE SEED ENGINE: ${config.firebase.projectId}`);
  console.log('========================================================\n');

  try {
    await seedPersonas();
    await seedDepartmentsAndServices();
    console.log('\n✓ Database seeding successfully finished!');
    process.exit(0);
  } catch (err: any) {
    console.error('\n✗ Seeding encountered an error:', err);
    process.exit(1);
  }
}

main();
