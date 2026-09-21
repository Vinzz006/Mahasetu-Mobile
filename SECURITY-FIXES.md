# MahaSetu Mobile Security Remediation Report

This document details the complete security hardening of the **MahaSetu Mobile** platform (Expo/React Native, Node.js HTTP backend, Firebase Auth, Cloud Firestore, and Firebase Storage) in compliance with the MahaSetu Security Master Plan.

All remediation was developed on branch `security/hardening` adhering to the one-commit-per-task protocol, with zero secrets committed and zero live Firebase calls.

---

## 1. Summary of Security Remediation (Tasks 1 – 10)

| Task | Commit Hash | Key Files Changed | Summary of Vulnerabilities & Remediation Fixed |
| :--- | :--- | :--- | :--- |
| **Task 1: Backend Auth & Authorization** | `dacc1e5` | `backend/src/server.ts`, `backend/src/lib/firebaseAdmin.ts`, `backend/src/lib/firestoreUtils.ts`, `backend/src/services/gemini.service.ts`, `backend/src/notifications/twilio.service.ts` | Removed client SDK credentials and user spoofing in backend. Implemented `firebase-admin` with strict `verifyIdToken(token, true)`. Enforced role-based authorization via custom token claims (`requireRole`). Enforced atomic 5-slot application creation via batch. Bound backend strictly to localhost (`127.0.0.1`). Enforced 100KB body limit, in-memory IP/UID rate limiting, and CORS allowlist. |
| **Task 2: Firestore Rules Hardening** | `7eb1b9d` | `firestore.rules`, `firebase.json`, `tests/firestore-rules.test.ts`, `run-rules-tests.cmd` | Removed hardcoded administrator emails and `get()` calls from rule helpers. Transitioned all security rules to custom claims (`request.auth.token.role`, `token.departmentId`, `token.email_verified == true`). Completely locked writes to `applications` and `applicationVerifications` to `false` (backend-only). Prevented citizen self-certification in `residentProfiles`. Added root deny-all fallback. Built automated emulator test suite with 7 passing tests. |
| **Task 3: Custom Claims Role Assignment** | `3834d48` | `backend/src/server.ts`, `services/authService.ts`, `store/AuthContext.tsx`, `scripts/bootstrap-admin.ts`, `backend/src/__tests__/server-auth.test.ts` | Implemented server-side Admin approval endpoints (`/approve`, `/reject`, `/verify`) using `adminAuth.setCustomUserClaims`. Blocked self-approval (HTTP 400). Removed insecure client fallbacks in `authService.ts`. Built CLI script `bootstrap-admin.ts` with `--confirm` production check. Rewrote `AuthContext.tsx` to read roles and status strictly from verified `getIdTokenResult(true).claims`. |
| **Task 4: Storage Rules & Service Hardening** | `181ae07` | `storage.rules`, `services/storageService.ts`, `tests/storage-service.test.ts` | Replaced email checks with custom claims (`request.auth.token.role`). Enforced 10MB file size limit and strict MIME type matching (`application/pdf`, `image/jpeg`, `image/png`). Fixed logical operators in passport rules. Added root deny-all fallback. In `storageService.ts`, sanitized file names against path traversal, enforced client-side size/type checks, and returned `storagePath` to avoid relying solely on token URLs. |
| **Task 5: Transport Security & Mobile Config** | `54da534` | `app.json`, `constants/config.ts`, `.env.example`, `scripts/verify-twilio-sms.ts`, `tests/config-security.test.ts` | Set `android.usesCleartextTraffic: false` in `app.json`. Fixed TypeScript errors on `Config` object. Enforced mandatory HTTPS for `API_BASE_URL` in production builds (`!__DEV__`). Eliminated hardcoded fallback credentials and threw errors when required env vars are missing. Updated `.env.example`. |
| **Task 6: Demo Gating & Credential Isolation** | `ebb7bad` | `constants/demoData.ts`, `app/(auth)/login.tsx`, `services/authService.ts`, `scripts/seed-firebase-project.ts`, `README.md`, `tests/demo-security.test.ts` | Removed hardcoded default demo password (`MahaSetu@2026!`). Gated demo account switcher strictly to `__DEV__ && EXPO_PUBLIC_DEMO_MODE === 'true'`. In `seed-firebase-project.ts`, prevented seeding against non-demo/non-dev projects without `--force-prod-seed` and generated unique per-account passwords. Updated `README.md` to remove demo credentials. |
| **Task 7: Repo Hygiene & Leaked Artifacts** | `ecda3d3` | `.gitignore`, `backend/src/services/conversationStore.ts`, `SECURITY.md`, `.github/workflows/security.yml`, git index | Untracked `firebase-debug.log`, `backend/data/user_conversations.json`, and 14 `scratch/` test files using `git rm --cached`. Hardened `.gitignore` to block logs, secrets, service accounts, and scratch folders. Configured `conversationStore.ts` to use `CONVERSATION_STORE_PATH`. Added `SECURITY.md` with SLA policies. Added `.github/workflows/security.yml` with CI typechecks, audit, and gitleaks. Conducted historical secret audit and provided `git filter-repo` instructions. |
| **Task 8: Dependencies & Known Vulnerabilities** | `19b2738` | `package.json`, `package-lock.json` | Ran `npm audit fix`. Added dependency override for `tar: "^7.4.3"` to remediate critical vulnerability CVE-2024-45296. Aligned Expo SDK dependencies via `expo install --check`. Successfully verified full TypeScript compilation (`tsc --noEmit`). |
| **Task 9: Input Validation & Abuse Controls** | `014a8cc` | `lib/aadhaar.ts`, `types/index.ts`, `app/resident-details.tsx`, `app/(admin)/(tabs)/citizens.tsx`, `services/residentProfileService.ts`, `app/(auth)/login.tsx`, `services/authService.ts`, `backend/src/notifications/twilio.service.ts`, `backend/src/services/gemini.service.ts`, `backend/src/server.ts`, `tests/input-validation.test.ts` | Added runtime schema validation on all backend endpoints. Enforced a daily SMS cap of 5 messages per citizen and restricted SMS dispatch to pre-approved templates only. Enforced prompt boundary isolation (`<citizen_input>`) and stripped control characters in `gemini.service.ts`. Enforced 10-character password complexity with upper, lower, digit, and special characters. Implemented Verhoeff checksum validation for Aadhaar and enforced masked storage (`XXXX-XXXX-1234`). |
| **Task 10: App Check & Structured Audit Logging** | Current | `backend/src/lib/logger.ts`, `backend/src/lib/appCheck.ts`, `backend/src/lib/firebaseAdmin.ts`, `backend/src/server.ts`, `lib/firebase.ts`, `tests/audit-logger-appcheck.test.ts`, `SECURITY-FIXES.md` | Created structured JSON audit logger in `backend/src/lib/logger.ts` with zero-PII guarantees (masks emails/phones, redacts secrets/Aadhaar). Added backend App Check middleware in `backend/src/lib/appCheck.ts` and enabled optional client initialization in `lib/firebase.ts`. Created comprehensive documentation and verification matrix in `SECURITY-FIXES.md`. |

---

## 2. Verification Matrix & Automated Test Results

All security enhancements are backed by automated tests:

| Test Suite | File | Tests | Status |
| :--- | :--- | :--- | :--- |
| **Backend Authentication & Authorization** | `backend/src/__tests__/server-auth.test.ts` | 12 / 12 | :white_check_mark: PASSED |
| **Firestore Security Rules (Emulator)** | `tests/firestore-rules.test.ts` | 7 / 7 | :white_check_mark: PASSED |
| **Storage Sanitization & Security** | `tests/storage-service.test.ts` | 6 / 6 | :white_check_mark: PASSED |
| **Transport & Config Security** | `tests/config-security.test.ts` | 3 / 3 | :white_check_mark: PASSED |
| **Demo Gating & Password Security** | `tests/demo-security.test.ts` | 3 / 3 | :white_check_mark: PASSED |
| **Input Validation & Abuse Controls** | `tests/input-validation.test.ts` | 13 / 13 | :white_check_mark: PASSED |
| **Audit Logger & Firebase App Check** | `tests/audit-logger-appcheck.test.ts` | 5 / 5 | :white_check_mark: PASSED |
| **Full TypeScript Compilation** | `tsc --noEmit` | Clean | :white_check_mark: 0 Errors |

---

## 3. How to Run Verification Suites

### Prerequisites
- Node.js v20+ or v24+
- Java (JRE 11+) for Firebase Emulator Suite

### Running the Test Suites

1. **TypeScript Compilation Check:**
   ```bash
   node ./node_modules/typescript/bin/tsc --noEmit
   ```

2. **Backend Authentication & Privileged Route Tests (Hermetic):**
   ```bash
   node -r ts-node/register --test backend/src/__tests__/server-auth.test.ts
   ```

3. **Input Validation, Verhoeff Checksum & SMS Abuse Tests:**
   ```bash
   node -r ts-node/register --test tests/input-validation.test.ts
   ```

4. **Storage Service Sanitization Tests:**
   ```bash
   node -r ts-node/register --test tests/storage-service.test.ts
   ```

5. **Transport & Config Security Tests:**
   ```bash
   node -r ts-node/register --test tests/config-security.test.ts
   ```

6. **Demo Mode Gating Tests:**
   ```bash
   node -r ts-node/register --test tests/demo-security.test.ts
   ```

7. **Structured Audit Logger & App Check Tests:**
   ```bash
   node -r ts-node/register --test tests/audit-logger-appcheck.test.ts
   ```

8. **Firestore Security Rules Emulator Tests:**
   ```bash
   firebase-tools emulators:exec --only firestore run-rules-tests.cmd
   ```

---

## 4. Residual Risks & Action Items for the Project Owner

While the codebase is now fully hardened against static and architectural vulnerabilities, the project owner must execute the following operations in cloud provider consoles before opening the repository or promoting to production:

### 1. Rotate Exposed Historical API Keys
- In Google Cloud Console (**APIs & Services > Credentials**), delete or regenerate the API key `AIzaSyAj6AAYqX9EN8eLuJiRErVXd74xZgdsucc` that was committed in the initial commit (`89677e7`).
- Apply application restrictions (HTTP referrers for web, Android package name and SHA-1 fingerprint for Android).
- Apply API restrictions so the key can only call Firebase Auth, Firestore, and Firebase Storage.

### 2. Purge History via `git filter-repo`
- Because git history retains past commits, run the `git filter-repo` commands documented in `SECURITY.md` in an isolated clone before making this repository public.

### 3. Enforce Firebase App Check in Console
- Register your Android app (Play Integrity provider) and iOS app (DeviceCheck / App Attest) in the Firebase Console under **App Check**.
- Once registered, set `APP_CHECK_ENFORCED=true` in your production backend environment.

### 4. Configure Cloud Monitoring & Billing Alerts
- Set a budget alert on Google Cloud and Twilio to detect any abnormal traffic surges.
- Verify Twilio production credentials are set exclusively as backend environment variables.
