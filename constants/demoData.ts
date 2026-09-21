// demoData.ts — Official Demo Accounts & Government Service Catalog

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: 'citizen' | 'department_officer' | 'admin' | 'auditor';
  departmentId?: 'DEPT_A' | 'DEPT_B' | 'DEPT_C' | null;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
}

// Demo credentials must only be loaded from environment variables in local development
export const DEMO_PASSWORD = process.env.EXPO_PUBLIC_DEMO_PASSWORD || '';

export const DEMO_USERS: DemoUser[] = [
  {
    id: 'demo-priya',
    name: 'Priya Sharma',
    email: 'citizen.priya@mahasetu.gov.in',
    role: 'citizen',
    departmentId: null,
    status: 'APPROVED',
  },
  {
    id: 'demo-rahul',
    name: 'Rahul Verma',
    email: 'citizen.rahul@mahasetu.gov.in',
    role: 'citizen',
    departmentId: null,
    status: 'APPROVED',
  },
  {
    id: 'demo-sneha',
    name: 'Sneha Patil',
    email: 'citizen.sneha@mahasetu.gov.in',
    role: 'citizen',
    departmentId: null,
    status: 'APPROVED',
  },
  {
    id: 'demo-pooja',
    name: 'Pooja Kulkarni',
    email: 'citizen.pooja@mahasetu.gov.in',
    role: 'citizen',
    departmentId: null,
    status: 'APPROVED',
  },
  {
    id: 'demo-ramesh',
    name: 'Ramesh Kumar',
    email: 'officer.dept_a@mahasetu.gov.in',
    role: 'department_officer',
    departmentId: 'DEPT_A',
    status: 'APPROVED',
  },
  {
    id: 'demo-suresh',
    name: 'Suresh Joshi',
    email: 'officer.dept_b@mahasetu.gov.in',
    role: 'department_officer',
    departmentId: 'DEPT_B',
    status: 'APPROVED',
  },
  {
    id: 'demo-mahesh',
    name: 'Mahesh Deshmukh',
    email: 'officer.dept_c@mahasetu.gov.in',
    role: 'department_officer',
    departmentId: 'DEPT_C',
    status: 'APPROVED',
  },
  {
    id: 'demo-anil',
    name: 'Anil Shinde',
    email: 'admin.onboarding@mahasetu.gov.in',
    role: 'admin',
    departmentId: null,
    status: 'APPROVED',
  },
  {
    id: 'demo-vijay',
    name: 'Vijay Patil',
    email: 'admin.system@mahasetu.gov.in',
    role: 'admin',
    departmentId: null,
    status: 'APPROVED',
  },
  {
    id: 'demo-neha',
    name: 'Neha Deshpande',
    email: 'auditor.compliance@mahasetu.gov.in',
    role: 'auditor',
    departmentId: null,
    status: 'APPROVED',
  },
];

export interface GovernmentService {
  id: string;
  code: string;
  title: string;
  category: string;
  description: string;
  eligibility: string[];
  departmentsInvolved: Array<{ id: 'DEPT_A' | 'DEPT_B' | 'DEPT_C'; name: string; role: string }>;
  estimatedDays: number;
  reusableFields: string[];
  additionalRequiredFields: string[];
  icon: string;
}

export const GOVERNMENT_SERVICES: GovernmentService[] = [
  {
    id: 'srv-001',
    code: 'ICB-2026',
    title: 'Integrated Citizen Benefit',
    category: 'Direct Benefit Transfer',
    description: 'Unified welfare disbursement across Revenue, Social Justice, and Labour welfare schemes with automated cross-verification.',
    eligibility: [
      'Resident of Maharashtra State',
      'Annual household income below ₹2,50,000',
      'Valid Aadhaar linked bank account',
    ],
    departmentsInvolved: [
      { id: 'DEPT_A', name: 'Revenue & Civil Supplies', role: 'Income & Domicile Certification' },
      { id: 'DEPT_B', name: 'Social Welfare', role: 'Category & Entitlement Verification' },
      { id: 'DEPT_C', name: 'Labour & Employment', role: 'Employment & DB Status Check' },
    ],
    estimatedDays: 3,
    reusableFields: ['Full Legal Name', 'Aadhaar Reference', 'Mobile Number', 'Permanent Address', 'City / District'],
    additionalRequiredFields: ['Annual Family Income', 'Bank Account Number', 'IFSC Code', 'Occupation Category'],
    icon: 'card-account-details-outline',
  },
  {
    id: 'srv-002',
    code: 'EDU-2026',
    title: 'Education Support Scheme',
    category: 'Higher Education & Scholarship',
    description: 'Financial aid and merit-cum-means scholarship for professional and technical degrees.',
    eligibility: [
      'Enrolled in approved higher education institution in Maharashtra',
      'Minimum 60% marks in qualifying examination',
    ],
    departmentsInvolved: [
      { id: 'DEPT_A', name: 'Revenue & Civil Supplies', role: 'Income & Residence' },
      { id: 'DEPT_B', name: 'Social Welfare', role: 'Scholarship Eligibility' },
    ],
    estimatedDays: 4,
    reusableFields: ['Full Legal Name', 'Aadhaar Reference', 'Mobile Number', 'Address'],
    additionalRequiredFields: ['Institution Name', 'Course Enrolled', 'Previous Year Marks %', 'Fee Receipt Number'],
    icon: 'school-outline',
  },
  {
    id: 'srv-003',
    code: 'EMP-2026',
    title: 'Employment Assistance & Skill Allowance',
    category: 'Livelihood & Skills',
    description: 'Stipend and job placement assistance for certified vocational trainees and apprentices.',
    eligibility: [
      'Age between 18 and 35 years',
      'Registered on Maharashtra Skill Portal',
      'Currently seeking formal employment',
    ],
    departmentsInvolved: [
      { id: 'DEPT_B', name: 'Social Welfare', role: 'Stipend Verification' },
      { id: 'DEPT_C', name: 'Labour & Employment', role: 'Skill Registry Check' },
    ],
    estimatedDays: 5,
    reusableFields: ['Full Legal Name', 'Mobile Number', 'Address', 'Aadhaar Reference'],
    additionalRequiredFields: ['Highest Qualification', 'Skill Certification ID', 'Preferred Industry'],
    icon: 'briefcase-outline',
  },
  {
    id: 'srv-004',
    code: 'SWB-2026',
    title: 'Social Welfare Pension & Care Benefit',
    category: 'Social Security',
    description: 'Monthly social security allowance for senior citizens, persons with disability, and single parents.',
    eligibility: [
      'Senior citizens (age 60+) or certified disability >= 40%',
      'Resident of Maharashtra for min. 5 years',
    ],
    departmentsInvolved: [
      { id: 'DEPT_A', name: 'Revenue & Civil Supplies', role: 'Age & Residence Verification' },
      { id: 'DEPT_C', name: 'Labour Welfare Board', role: 'Pension Eligibility Registry' },
    ],
    estimatedDays: 3,
    reusableFields: ['Full Legal Name', 'Date of Birth', 'Aadhaar Reference', 'Address', 'Mobile Number'],
    additionalRequiredFields: ['Disability Certificate (if applicable)', 'Bank Details'],
    icon: 'hand-heart-outline',
  },
];
