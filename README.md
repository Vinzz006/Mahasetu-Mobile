# MahaSetu Mobile Application

> **A secure government interoperability mobile platform that allows citizens to submit information once, provide consent, and track cross-department processing in real time.**

---

## 🏛️ Core Platform Architecture

```text
       CITIZEN
          ↓
     SUBMIT ONCE
          ↓
       CONSENT
          ↓
  SECURE DATA REUSE
          ↓
MULTI-DEPARTMENT VERIFICATION (5/5)
  [Dept A + Dept B + Dept C + Admin + Auditor]
          ↓
 REAL-TIME TRACKING
          ↓
ONE UNIFIED APPLICATION STATUS
```

The mobile application is a first-class client of the **MahaSetu Platform**, interfacing with:
* **Firebase Authentication** (Google Auth + Tokenized Custom Claims)
* **Cloud Firestore** (Single source of truth with real-time listeners)
* **Trusted Backend** (`http://localhost:8000`)
* **Twilio Verify v2 & Twilio Programmable Messaging** (Server-side OTP and SMS notification infrastructure)
* **Strict RBAC** with Department Isolation & Statutory Oversight

---

## 👥 Built-in Official Demo Accounts & Credentials

Sign in directly on the mobile app or web portal using the pre-configured demo credentials below:

**Demo Password for all accounts**: `MahaSetu@2026!`

| Role | Demo Name | Email Identifier | Password | Purpose / Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Citizen** | Priya Sharma | `citizen.priya@mahasetu.gov.in` | `MahaSetu@2026!` | Self-service, Submit Once, 5-party tracking, Consent management |
| **Citizen** | Rahul Verma | `citizen.rahul@mahasetu.gov.in` | `MahaSetu@2026!` | Higher education benefit applicant |
| **Citizen** | Sneha Patil | `citizen.sneha@mahasetu.gov.in` | `MahaSetu@2026!` | Livelihood assistance applicant |
| **Citizen** | Pooja Kulkarni | `citizen.pooja@mahasetu.gov.in` | `MahaSetu@2026!` | Social welfare applicant |
| **Dept Officer** | Ramesh Kumar | `officer.dept_a@mahasetu.gov.in` | `MahaSetu@2026!` | **DEPT_A** — Revenue & Civil Supplies certification |
| **Dept Officer** | Suresh Joshi | `officer.dept_b@mahasetu.gov.in` | `MahaSetu@2026!` | **DEPT_B** — Social Welfare & Inclusion certification |
| **Dept Officer** | Mahesh Deshmukh | `officer.dept_c@mahasetu.gov.in` | `MahaSetu@2026!` | **DEPT_C** — Labour & Employment Welfare certification |
| **Admin** | Anil Shinde | `admin.onboarding@mahasetu.gov.in` | `MahaSetu@2026!` | User onboarding approval, Citizen identity queue, 5/5 matrix |
| **Admin** | Vijay Patil | `admin.system@mahasetu.gov.in` | `MahaSetu@2026!` | System health, Twilio monitoring, Canonical exchanges |
| **Auditor** | Neha Deshpande | `auditor.compliance@mahasetu.gov.in` | `MahaSetu@2026!` | Independent compliance oversight, 5th verification gate |

---

## 🔒 Security & RBAC Enforcement

1. **New User Gating (`PENDING_APPROVAL`)**:
   * Any new Google Sign-in account is created with `role = 'pending'`, `status = 'PENDING_APPROVAL'`, `isActive = false`.
   * The user is automatically gated on the **Pending Approval screen** and cannot access any services or administrative tools.
   * State Administrator reviews the user and assigns one of: `Citizen`, `Department Officer` (with Department A/B/C assignment), or `Auditor`.
   * Standard Admin UI strictly blocks arbitrary self-assignment of the Admin role.
2. **5/5 Multi-Personnel Verification Rule**:
   * Every application requires independent certification from:
     1. Department A (`DEPT_A`)
     2. Department B (`DEPT_B`)
     3. Department C (`DEPT_C`)
     4. State Administrator (`ADMIN`)
     5. Compliance Auditor (`AUDITOR`)
   * An application only transitions to `APPLICATION_VERIFIED` when all 5 slots are approved.
   * If any verifier rejects, the application status becomes `REJECTED`.
3. **Department Isolation**:
   * Department A officers can ONLY modify `DEPT_A` verification records.
   * Department B officers can ONLY modify `DEPT_B` records.
   * Department C officers can ONLY modify `DEPT_C` records.
   * Scope is strictly derived from verified Firebase auth custom claims, never client request bodies.
4. **Citizen Self-Verification Gating**:
   * The citizen UI **never** exposes self-verification controls. Only State Administrators can certify citizen identity dossiers.
5. **Auditor Statutory Rule**:
   * Auditors have statutory power to review and verify/reject the 5th gate.
   * Auditors **cannot** assign user roles, mutate audit logs, or alter configuration.
6. **Twilio Server-Side Isolation**:
   * No Twilio secrets (`TWILIO_AUTH_TOKEN`, `TWILIO_API_SECRET`) are embedded in the mobile bundle.
   * All SMS and Verify requests pass through backend proxy endpoints.
   * Normalizes phone numbers to E.164 (`+91XXXXXXXXXX`).

---

## 📱 Mobile Folder Structure

```text
Mahasetu Mobile/
├── app/
│   ├── _layout.tsx                     # Global providers (Auth, Safe Area, Status Bar)
│   ├── index.tsx                       # Initial routing gateway based on role & status
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx                   # Google Sign-in & Quick Demo Switcher
│   ├── (pending)/
│   │   ├── _layout.tsx
│   │   └── index.tsx                   # Pending Admin Approval screen
│   ├── (citizen)/
│   │   ├── _layout.tsx                 # Citizen Tab Navigator
│   │   ├── (tabs)/
│   │   │   ├── index.tsx               # Citizen Home & Verification Progress
│   │   │   ├── services.tsx            # Service Catalogue
│   │   │   ├── applications.tsx        # My Applications List
│   │   │   ├── consent.tsx             # Data-Sharing Consents (Grant / Deny)
│   │   │   ├── notifications.tsx       # In-App & Twilio SMS status
│   │   │   └── profile.tsx             # Identity Profile & Verification Status
│   │   ├── apply/
│   │   │   └── [serviceId].tsx         # 5-Step "Submit Once" Application Wizard
│   │   └── application/
│   │       └── [id].tsx                # Real-time 5-party tracking timeline
│   ├── (department)/
│   │   ├── _layout.tsx                 # Department Tab Navigator
│   │   ├── (tabs)/
│   │   │   ├── index.tsx               # Verification Queue
│   │   │   ├── applications.tsx        # Department Applications overview
│   │   │   ├── notifications.tsx       # Department Alerts
│   │   │   └── profile.tsx             # Officer Credentials
│   │   └── review/
│   │       └── [id].tsx                # Isolated Department Review & Certification
│   ├── (admin)/
│   │   ├── _layout.tsx                 # Admin Tab Navigator
│   │   ├── (tabs)/
│   │   │   ├── index.tsx               # Admin Dashboard
│   │   │   ├── approvals.tsx           # Pending User Approvals (Assign Role & Dept)
│   │   │   ├── citizens.tsx            # Citizen Identity Verification Queue
│   │   │   ├── applications.tsx        # 5/5 Verification Matrix & Admin Verify Gate
│   │   │   ├── exchanges.tsx           # Canonical Data Exchanges Log
│   │   │   ├── integrations.tsx        # Twilio Status & System Health Monitoring
│   │   │   └── audit.tsx               # Immutable Audit Trail
│   │   └── user/
│   │       └── [uid].tsx               # Role Assignment Modal
│   └── (auditor)/
│       ├── _layout.tsx                 # Auditor Tab Navigator
│       ├── (tabs)/
│       │   ├── index.tsx               # Auditor Oversight Dashboard
│       │   ├── applications.tsx        # Compliance Applications Review
│       │   ├── verifications.tsx       # Verification History
│       │   ├── exchanges.tsx           # Canonical Exchange Oversight
│       │   └── audit.tsx               # Read-Only Audit Log
│       └── review/
│           └── [id].tsx                # Auditor Verification Gate (Slot 5 of 5)
├── components/
│   ├── common/                         # Header, StatCard, StatusBadge, EmptyState, etc.
│   ├── verification/                   # VerificationTimeline, VerificationMatrix
│   ├── consent/                        # ConsentCard (Transparency view)
│   └── forms/                          # FormInput
├── services/                           # api, auth, applications, verification, consent, twilio
├── store/                              # AuthContext with role state machine
├── constants/                          # theme, demoData, config
└── scripts/
    └── verify-workflow.ts              # Automated 29-assertion test suite
```

---

## 🚀 How to Run

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Verification & Security Tests
```bash
npx tsx scripts/verify-workflow.ts
```

### 3. Start Expo Dev Server
```bash
npx expo start
```

* Press `w` to open in Web Browser
* Press `a` to run on Android Emulator
* Press `i` to run on iOS Simulator
* Scan the QR code with **Expo Go** on physical mobile devices!
