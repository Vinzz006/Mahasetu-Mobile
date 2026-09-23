# MahaSetu Mobile Application

> **A secure government interoperability mobile platform that allows citizens to submit information once, provide consent, and track cross-department processing in real time.**

---

## 📋 SIH 2026 Judge & Reproducibility Guide

### Environment

* **Node.js:** `22` LTS (Strictly locked in `.nvmrc`; compatible with `>=20.0.0 <25.0.0`)
* **npm:** `>=9.0.0` (Verified on npm 11; locked via `package-lock.json` v3)
* **Expo SDK:** `52.0.49` (`expo: ~52.0.37` in `package.json`)
* **React Native:** `0.76.9`
* **React:** `18.3.1`
* **Package Manager:** `npm` (Use `npm ci` for exact deterministic reproduction)

### Quick Setup for Judges

#### 1. Environment Activation
```bash
# Optional: Load the locked Node.js version if using nvm
nvm use
```

#### 2. Deterministic Installation
```bash
# IMPORTANT: Do not run 'npm install' if reproducibility is required.
# Use 'npm ci' to reproduce the exact dependency tree from package-lock.json:
npm ci
```

#### 3. Environment Configuration
Copy the template configuration file:
```bash
cp .env.example .env
```
Then configure the environment variables in `.env`.

##### Configuration Layers:
* **Mobile / Client Configuration (`EXPO_PUBLIC_*`):**
  * Firebase Client API credentials (`API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID`)
  * `EXPO_PUBLIC_API_BASE_URL`: Reachable MahaSetu backend URL (`http://localhost:8000` for web/local, `http://10.0.2.2:8000` for Android emulator)
  * `EXPO_PUBLIC_DEMO_MODE=true` (for local development/testing)
* **Backend Server Configuration:**
  * `HOST=127.0.0.1` and `PORT=8000`
  * `CORS_ALLOWED_ORIGINS=http://localhost:8081,http://127.0.0.1:8081`
  * `FIREBASE_SERVICE_ACCOUNT_JSON`: Path to service account or raw JSON credentials
* **External Service Secrets (Server-Side Backend ONLY):**
  * `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`
  * `GEMINI_API_KEY`: Google Gemini AI assistant key (never bundled into mobile client)

---

## 🚀 Running the Platform

The MahaSetu architecture consists of the **Mobile Client** and the **Trusted Node.js Backend**.

### Step 1: Start the Trusted Backend (Choose Option A or Option B)

#### Option A: Direct Node.js Process (Recommended for quick evaluation)
```bash
npm run backend
```
The server will bind to `http://127.0.0.1:8000` with claims-based authorization, rate limiting, and zero-leak credential isolation active.

#### Option B: Dockerized Backend (Isolated Container)
```bash
# Starts the backend in a standalone Node 22 Alpine container:
docker compose up --build backend
```
*Note: External services (Firebase, Twilio, Gemini) are contacted securely over outbound HTTPS.*

---

### Step 2: Start the Expo Mobile Application

```bash
npx expo start
```

### Supported Demo & Evaluation Paths:
* **Expo Go (Physical Device):** Install **Expo Go (SDK 52)** on Android or iOS, and scan the terminal QR code.
* **Web Browser Preview:** Press `w` in the terminal to launch Metro in your browser.
* **Android Emulator:** Press `a` in the terminal (requires Android Studio emulator running with API 33+).
* **Option B — Prebuilt Standalone APK:** 
  The project is pre-configured with package `gov.mahasetu.mobile` in `app.json`. To generate a standalone Android APK using EAS Build:
  ```bash
  npx eas-cli build --platform android --profile preview
  ```

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
* **Firebase Authentication:** Google Auth + Cryptographically signed token custom claims (`role`, `departmentId`, `status`)
* **Cloud Firestore:** Single source of truth with real-time listeners, strict RBAC, and client-side write lockdown
* **Trusted Backend (`http://localhost:8000`):** Server-side application submission, 5/5 atomic verification pipeline, and proxy endpoints
* **Twilio Programmable Messaging:** Server-side SMS notification infrastructure for statutory citizen alerts (E.164 normalized)
* **Google Gemini AI Assistant:** Backend-isolated `@google/genai` assistant with prompt boundary isolation and citizen-specific context scoping

---

## 👥 Official Demo Personas (Development & Local Emulator Only)

> **Security Note:** Demo persona quick-switching is strictly disabled in production releases (`__DEV__ === false`) and requires `EXPO_PUBLIC_DEMO_MODE=true`. Demo passwords are never hardcoded or stored in the repository.

To populate demo personas in your local Firebase Emulator for development:

```bash
# 1. Set development password in your local .env
EXPO_PUBLIC_DEMO_PASSWORD=your_secure_dev_password

# 2. Run seed script against local Firebase Emulator
npx tsx scripts/seed-firebase-project.ts
```

| Role | Name | Identifier | Purpose / Scope |
| :--- | :--- | :--- | :--- |
| **Citizen** | Anusha G. | `anusha@mahasetu.gov.in` | Self-service, Submit Once, 5-party tracking, Consent management |
| **Citizen** | Muthumayil M. | `muthumayil@mahasetu.gov.in` | Higher education benefit applicant |
| **Citizen** | Akshita S S | `akshita@mahasetu.gov.in` | Livelihood assistance applicant |
| **Citizen** | Kanimozhi N | `kanimozhi@mahasetu.gov.in` | Social welfare applicant |
| **Dept Officer** | Vinesh S | `vinesh.dept_a@mahasetu.gov.in` | **DEPT_A** — Revenue & Civil Supplies certification |
| **Dept Officer** | Sai Sharavan G | `sai.dept_b@mahasetu.gov.in` | **DEPT_B** — Social Welfare & Inclusion certification |
| **Dept Officer** | Omesh Kaarthik S U | `omesh.dept_c@mahasetu.gov.in` | **DEPT_C** — Labour & Employment Welfare certification |
| **Admin** | Tammu Vedesh Kumar | `tammu.admin@mahasetu.gov.in` | User onboarding approval, Citizen identity queue, 5/5 matrix |
| **Admin** | Shanmugam K | `shanmugam.admin@mahasetu.gov.in` | System health, Twilio monitoring, Canonical exchanges |
| **Auditor** | Tanushri S | `tanushri.auditor@mahasetu.gov.in` | Independent compliance oversight, 5th verification gate |

---

## 🔒 Security & RBAC Enforcement

1. **New User Gating (`PENDING_APPROVAL`):**
   * Any new account sign-in is created with `role = 'pending'`, `status = 'PENDING_APPROVAL'`, `isActive = false`.
   * The user is automatically gated on the **Pending Approval screen** and cannot access any services.
   * State Administrator reviews the user and assigns appropriate roles via server-signed custom claims.
2. **5/5 Multi-Personnel Verification Rule:**
   * Every application requires independent certification from:
     1. Department A (`DEPT_A` — Revenue & Civil Supplies)
     2. Department B (`DEPT_B` — Social Welfare & Inclusion)
     3. Department C (`DEPT_C` — Labour & Employment Welfare)
     4. State Administrator (`ADMIN`)
     5. Compliance Auditor (`AUDITOR`)
   * An application only transitions to `APPLICATION_VERIFIED` when all 5 slots are approved.
3. **Department Isolation:**
   * Officers can ONLY review and certify records scoped to their verified `token.departmentId`.
4. **Backend-Enforced Writes:**
   * Direct client-side creation or tampering with `/applications` and `/applicationVerifications` is denied by Firestore security rules (`allow write: if false`). All mutations pass through the trusted backend Admin SDK.
5. **Twilio & Gemini Credential Isolation:**
   * Zero server secrets (`TWILIO_AUTH_TOKEN`, `GEMINI_API_KEY`, Firebase service account keys) are packaged into the mobile bundle.
6. **DPDP Act & PII Masking:**
   * Aadhaar numbers are validated using the Verhoeff algorithm and stored exclusively in masked format (`XXXX-XXXX-1234`).
   * Phone numbers are strictly normalized to Indian E.164 format (`+91XXXXXXXXXX`).

---

## 🧪 Automated Verification & Test Suites

To verify codebase integrity, security assertions, and hermetic tests:

```bash
# 1. Full TypeScript compilation check (0 errors)
npx tsc --noEmit

# 2. Hermetic backend security & privilege suite (12 tests)
npm run test:backend

# 3. Hermetic client security, input validation & storage sanitization (30 tests)
node -r ts-node/register --test tests/audit-logger-appcheck.test.ts tests/config-security.test.ts tests/demo-security.test.ts tests/input-validation.test.ts tests/storage-service.test.ts

# 4. Deterministic package verification
npm ci --dry-run
```

---

## 📱 Mobile Folder Structure

```text
Mahasetu Mobile/
├── app/
│   ├── _layout.tsx                     # Global providers (Auth, Safe Area, Status Bar)
│   ├── index.tsx                       # Initial routing gateway based on role & status
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx                   # Google / Email Sign-in & Gated Demo Switcher
│   ├── (pending)/
│   │   ├── _layout.tsx
│   │   └── index.tsx                   # Pending Admin Approval screen
│   ├── (citizen)/
│   │   ├── _layout.tsx                 # Citizen Tab Navigator
│   │   ├── (tabs)/
│   │   │   ├── index.tsx               # Citizen Home & Verification Progress
│   │   │   ├── services.tsx            # Service Catalogue
│   │   │   ├── applications.tsx        # My Applications List (Real-time)
│   │   │   ├── consent.tsx             # Granular Data Consents (Grant / Deny)
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
├── backend/
│   ├── Dockerfile                      # Node 22 Alpine production container
│   ├── .dockerignore                   # Exclude client bundle, secrets, logs
│   └── src/
│       ├── server.ts                   # MahaSetu Trusted Backend API Server
│       ├── lib/                        # Firebase Admin SDK, App Check, Logger
│       ├── notifications/              # Twilio Programmable Messaging service
│       └── services/                   # Gemini AI Assistant (@google/genai)
├── components/                         # Header, StatCard, StatusBadge, EmptyState, etc.
├── services/                           # api, auth, applications, verification, consent, twilio
├── store/                              # AuthContext with role state machine
├── constants/                          # theme, demoData, config
└── tests/                              # Hermetic unit test suites
```
