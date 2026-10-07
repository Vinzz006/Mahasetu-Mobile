# Security Round 2 Implementation Log — MahaSetu Mobile

This log tracks all security hardening tasks performed in Security Round 2, including files changed, tests added, verification results, and documented residual risks.

---

## Task Progress & Log

### T1 · Backend authentication gate
- **Status:** COMPLETED
- **Files Changed:** `backend/src/server.ts`, `backend/src/__tests__/server-auth.test.ts`
- **Tests Added:** Unit tests 13-19 covering unverified email, missing status, rejected role, SUSPENDED status, role mismatch, pending user onboarding access vs restricted access, and unknown routes. All 19 backend security tests passing.
- **Residual Risk:** None. All non-health endpoints route through strict `authorize()` gate with verified claims.

---

### T2 · Claim lifecycle, token revocation, re-auth for privileged actions
- **Status:** COMPLETED
- **Files Changed:** `backend/src/server.ts`, `scripts/bootstrap-admin.ts`, `services/api.ts`, `services/authService.ts`, `backend/src/__tests__/server-auth.test.ts`
- **Tests Added:** Unit tests 20-26 covering immediate token revocation via `adminAuth.revokeRefreshTokens`, department role-departmentId strict coupling, last remaining admin protection (preventing self and last admin demotion/rejection/suspension), user suspension and reinstatement endpoints (`POST /api/v1/admin/users/:uid/suspend` and `/reinstate`), maxAuthAgeSec (300s) re-auth gating returning `401 {code:'REAUTH_REQUIRED'}`, target user existence checks, and single 401 force-refresh and signout handling in client ApiClient. All 26 backend security tests passing.
- **Residual Risk:** None. Refresh tokens are actively revoked on every claims/status change, and privileged administrative actions require authentication within the last 300 seconds.

---

### T3 · Resident profile & sensitive PII surface
- **Status:** COMPLETED
- **Files Changed:** `backend/src/lib/aadhaar.ts`, `lib/aadhaar.ts`, `backend/src/lib/residentProfileValidator.ts`, `backend/src/server.ts`, `services/residentProfileService.ts`, `firestore.rules`, `backend/src/__tests__/server-auth.test.ts`
- **Tests Added:** Unit tests 27-32 covering:
  - 422 rejection on unknown top-level or nested keys via strict allowlist schema
  - 422 rejection on raw 12-digit Aadhaar leak anywhere in payload
  - Server-side Verhoeff checksum validation and mandatory masking (only storing `aadhaarLast4` and `XXXX-XXXX-last4`)
  - Automatic identity re-certification reset (reverting `VERIFIED` to `PENDING`, clearing verifier metadata, and emitting tamper audit log on profile changes)
  - 403 IDOR prevention when non-admin submits another user's `userId`
  - Server-side passport file deletion from Cloud Storage and metadata clearing via `DELETE /api/v1/resident-profile/passport`
- **Residual Risk:** None. Direct citizen writes to `residentProfiles` are disabled in Firestore rules and all writes strictly route through the backend API with deep schema validation and Verhoeff verification.

---

### T4 · Firestore rules tightening & coverage
- **Status:** COMPLETED
- **Files Changed:** `firestore.rules`, `tests/firestore-rules.test.ts`
- **Tests Added:** Expanded unit test suite covering all 13 rules in `firestore.rules`:
  1. `users`: Owner read/update allowlist, admin/auditor full read, signup pending validation, deletion blocked.
  2. `applications`: Owner, department officer, admin, auditor read; all client writes forbidden.
  3. `applicationVerifications`: Owner, admin, auditor, officer read; client writes forbidden.
  4. `notifications`: Owner read/create, 'read' field update only, deletion forbidden.
  5. `consents`: Owner, officer, admin read; status transition to GRANTED/DENIED by owner only.
  6. `dataExchanges`: Admin, auditor, officer read; writes forbidden.
  7. `integrationLogs`: Admin, auditor read; writes forbidden.
  8. `auditLogs`: Admin, auditor read; signed-in append bound to matching caller UID only; update/delete forbidden.
  9. `workflows`: Admin, auditor, officer read; writes forbidden.
  10. `services` & `departments`: Signed-in read; admin write only.
  11. `aiConversations` & `messages`: Owner and admin isolation for read/create/update/delete; cross-citizen access denied.
  12. `residentProfiles`: Owner/admin/auditor read; citizen write denied (backend API route only); admin write allowed.
  13. `/{document=**}`: Default deny-all on unknown collections.
- **Residual Risk:** None. All rules enforce deny-by-default with zero reliance on document reads inside authorization helpers (`get()`).

---
