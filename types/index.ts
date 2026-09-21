export type UserRole =
  | 'CITIZEN'
  | 'DEPARTMENT_A'
  | 'DEPARTMENT_B'
  | 'DEPARTMENT_C'
  | 'ADMIN'
  | 'AUDITOR'
  | 'citizen'
  | 'department_officer'
  | 'admin'
  | 'auditor'
  | 'pending'
  | null;

export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type DepartmentId =
  | 'DEPT_A'
  | 'DEPT_B'
  | 'DEPT_C'
  | 'DEPARTMENT_A'
  | 'DEPARTMENT_B'
  | 'DEPARTMENT_C';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  name: string;
  role: UserRole;
  departmentId: DepartmentId | string | null;
  status: AccountStatus;
  isActive?: boolean;
  phone?: string;
  phoneNumber?: string;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pinCode?: string | null;
  aadhaarRef?: string | null;
  isVerified?: boolean;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  photoURL?: string | null;
  isDemo?: boolean;
  recordType?: 'PRODUCTION' | 'DEMO';
  hasResidentProfile?: boolean;
  identityStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  profileCompletion?: number;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus =
  | 'DRAFT'
  | 'APPLICATION_SUBMITTED'
  | 'SUBMITTED'
  | 'IN_PROGRESS'
  | 'UNDER_VERIFICATION'
  | 'APPLICATION_VERIFIED'
  | 'VERIFIED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type VerifierRole = 'department_officer' | 'admin' | 'auditor';

export type VerifierRoleKey =
  | 'DEPT_A'
  | 'DEPT_B'
  | 'DEPT_C'
  | 'DEPARTMENT_A'
  | 'DEPARTMENT_B'
  | 'DEPARTMENT_C'
  | 'ADMIN'
  | 'AUDITOR';

export interface ApplicationVerification {
  id: string;
  applicationId: string;
  verifierKey: VerifierRoleKey;
  verifierId?: string;
  verifierName: string;
  verifierRole: VerifierRole | 'DEPARTMENT_A' | 'DEPARTMENT_B' | 'DEPARTMENT_C' | 'ADMIN' | 'AUDITOR';
  departmentId: DepartmentId | string | null;
  verifierUserId?: string | null;
  status: VerificationStatus;
  comments?: string | null;
  verifiedAt?: string | null;
  rejectedAt?: string | null;
  isDemo?: boolean;
  recordType?: 'PRODUCTION' | 'DEMO';
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  applicationNumber: string; // e.g. MS-10001
  citizenId?: string;
  serviceId: string;
  serviceTitle: string;
  serviceCode: string;
  citizenUid: string;
  citizenName: string;
  citizenPhone: string;
  citizenEmail: string;
  citizenAddress: string;
  citizenCity: string;
  citizenSnapshot?: {
    displayName: string;
    email: string;
  };
  status: ApplicationStatus;
  submissionDate: string;
  eligibilityData: Record<string, any>;
  verificationSummary: {
    totalRequired: number; // 5
    verifiedCount: number; // e.g. 4
    rejectedCount: number;
    isFullyVerified: boolean; // 5 / 5
  };
  verificationProgress?: {
    completed: number;
    required: number;
  };
  finalCompletionSmsSent?: boolean;
  rejectionReason?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  completedAt?: string | null;
  isDemo?: boolean;
  recordType?: 'PRODUCTION' | 'DEMO';
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentItem {
  id: string;
  name: string;
  code: 'DEPARTMENT_A' | 'DEPARTMENT_B' | 'DEPARTMENT_C';
  active: boolean;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  active: boolean;
  requiredDepartments: string[];
}


export type ConsentStatus = 'PENDING' | 'GRANTED' | 'DENIED' | 'REVOKED' | 'EXPIRED';

export interface Consent {
  id: string;
  applicationId: string;
  applicationNumber: string;
  citizenUid: string;
  sourceDepartment: string;
  targetDepartment: DepartmentId | 'DEPT_A' | 'DEPT_B' | 'DEPT_C';
  targetDepartmentName: string;
  purpose: string;
  sharedFields: string[];
  status: ConsentStatus;
  grantedAt?: string;
  deniedAt?: string;
  expiresAt: string;
  createdAt: string;
}

export interface CanonicalDataExchange {
  id: string;
  exchangeId: string;
  applicationId: string;
  applicationNumber: string;
  sourceDepartment: DepartmentId | 'DEPT_A' | 'CITIZEN';
  targetDepartment: DepartmentId;
  consentId: string;
  purpose: string;
  fields: string[];
  canonicalSchema: string;
  transformationVersion: string;
  sourceSchema: string;
  targetSchema: string;
  status: 'SUCCESS' | 'FAILED' | 'IN_TRANSIT';
  timestamp: string;
}

export type NotificationChannel = 'IN_APP' | 'SMS' | 'PUSH';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

export type ApplicationEventType =
  | 'APPLICATION_SUBMITTED'
  | 'DEPARTMENT_A_VERIFIED'
  | 'DEPARTMENT_B_VERIFIED'
  | 'DEPARTMENT_C_VERIFIED'
  | 'ADMIN_VERIFIED'
  | 'AUDITOR_VERIFIED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'APPLICATION_REQUIRES_ACTION';

export interface NotificationItem {
  id: string;
  userId: string;
  applicationId?: string;
  applicationNumber?: string;
  type: ApplicationEventType | 'CONSENT_REQUEST' | 'VERIFICATION_UPDATE' | 'APPLICATION_COMPLETED' | 'ADMIN_APPROVAL';
  title: string;
  message: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  smsStatus?: NotificationStatus;
  twilioMessageSid?: string;
  read: boolean;
  createdAt: string;
  sentAt?: string;
}

export interface AuditLogItem {
  id: string;
  actorUid: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetType: 'APPLICATION' | 'USER' | 'CONSENT' | 'VERIFICATION' | 'SYSTEM';
  targetId: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}

export interface TwilioHealthStatus {
  enabled: boolean;
  connected: boolean;
  verifyServiceConfigured?: boolean;
  messagingServiceConfigured: boolean;
  smsSentToday: number;
  smsFailedToday: number;
  recentLogs: Array<{
    id: string;
    recipient: string;
    applicationNumber?: string;
    messageType: string;
    status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SKIPPED';
    timestamp: string;
    twilioSid?: string;
    errorReason?: string;
  }>;
}

// ==========================================
// GOVERNMENT RESIDENT PROFILE (CITIZEN DETAILS)
// ==========================================

export interface PersonalDetails {
  fullLegalName: string;
  dateOfBirth: string; // Format: YYYY-MM-DD
  age: number | null;
  gender: 'Male' | 'Female' | 'Other' | '';
  maritalStatus: 'Single' | 'Married' | 'Divorced' | 'Widowed' | '';
  community: 'General' | 'OBC' | 'SC' | 'ST' | 'Minorities' | string;
  caste: string;
}

export interface ResidentAddress {
  address: string;
  city: string;
  district: string;
  division: string;
  taluk: string;
  zone: string;
  state: string;
  country: string;
  pinCode: string;
}

export interface ResidentContact {
  phoneNumber: string;
  telephoneNumber: string;
  emailAddress: string;
}

export interface ResidentFamily {
  fatherName: string;
  fatherPhoneNumber: string;
  fatherMobileNumber: string;
  fatherEmail: string;
  motherName: string;
  motherMobileNumber: string;
  motherEmail: string;
  spouseName: string;
  spouseNumber: string;
  guardianName: string;
  guardianPhoneNumber: string;
  guardianEmail: string;
}

export interface ResidentIdentity {
  aadhaarReference: string;
  aadhaarHash?: string;
  aadhaarLast4?: string;
  panCardNumber: string;
}

export interface ResidentEducation {
  educationalQualification: string;
}

export interface ResidentBank {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
}

export interface ResidentPassport {
  hasPassport: boolean;
  documentPath: string | null;
  fileName: string | null;
  fileSize: number | null; // In bytes
  uploadedAt: string | null;
}

export interface DepartmentDetails {
  departmentId: string;
  designation: string;
  employeeId: string;
  officeName: string;
  officeAddress: string;
}

export interface ResidentProfile {
  userId: string;
  profileType: 'CITIZEN' | 'DEPARTMENT_A' | 'DEPARTMENT_B' | 'DEPARTMENT_C' | 'ADMIN' | 'AUDITOR' | string;

  personalDetails: PersonalDetails;
  address: ResidentAddress;
  contact: ResidentContact;
  family: ResidentFamily;
  identity: ResidentIdentity;
  education: ResidentEducation;
  bank: ResidentBank;
  passport: ResidentPassport;
  departmentDetails?: DepartmentDetails;

  isComplete: boolean;
  completionPercentage: number;
  certificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  certifiedAt?: string | null;
  certifiedBy?: string | null;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

