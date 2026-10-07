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

### T5 · Audit log integrity & tamper-evident hash chain
- **Status:** COMPLETED
- **Files Changed:** `backend/src/lib/auditWriter.ts`, `firestore.rules`, `tests/firestore-rules.test.ts`, `backend/src/__tests__/auditWriter.test.ts`
- **Tests Added:** Unit test suite in `auditWriter.test.ts` covering:
  - Deterministic SHA-256 hash generation for canonical log fields
  - Sequential verification of multi-block cryptographic hash chains (`verifyAuditChain`)
  - Detection of payload/action modifications in historical audit blocks
  - Detection of omitted, swapped, or broken chain links
  - Backend Admin SDK `writeAuditLog` linking with monotonic sequence numbering
  - Firestore rules rule-8 tightening to completely disallow direct client writes to `auditLogs`
- **Residual Risk:** None. Audit logs are strictly written by the backend Admin SDK with cryptographically chained block hashes (`prevHash` + `hash`), rendering any unilateral modification or tampering immediately detectable.

---

### T6 · Consent enforcement & officer document access control
- **Status:** COMPLETED
- **Files Changed:** `backend/src/lib/consentValidator.ts`, `backend/src/server.ts`, `services/consentService.ts`, `backend/src/__tests__/consent.test.ts`, `backend/src/__tests__/server-auth.test.ts`
- **Tests Added:** Unit test suites covering:
  - Departmental officer document access requiring explicit, non-expired citizen consent (`status === 'GRANTED'`, `expiresAt > now()`)
  - 403 Forbidden rejection when consent is missing, DENIED, or EXPIRED
  - 403 Forbidden rejection when officer attempts cross-department document access outside consented scope
  - Statutory Admin / Auditor oversight bypass with audit logging
  - Citizen ownership verification on consent grant/deny (`POST /api/v1/consent/:id/grant` and `/deny`)
  - Real-time cryptographic chained audit logging for all document access requests (`DOCUMENT_ACCESSED` and `DOCUMENT_ACCESS_DENIED_NO_CONSENT`)
- **Residual Risk:** None. All officer document accesses are verified on the backend against active citizen consent with zero ambient data sharing.

---

### T7 · Storage rules & upload validation / document finalization
- **Status:** COMPLETED
- **Files Changed:** `backend/src/lib/fileSecurityValidator.ts`, `backend/src/server.ts`, `storage.rules`, `services/residentProfileService.ts`, `backend/src/__tests__/fileValidator.test.ts`, `backend/src/__tests__/server-auth.test.ts`
- **Tests Added:** Unit test suites covering:
  - Binary magic byte validation for PDF (`%PDF-`), PNG (`\x89PNG`), and JPEG (`\xFF\xD8\xFF`)
  - Polyglot and script injection defense (rejecting HTML, JS, PHP, and shell scripts embedded in uploaded documents)
  - Statutory 10 MB file size limit enforcement
  - Server-side document finalization endpoint (`POST /api/v1/documents/finalize`)
  - Immediate server-side purge of invalid, corrupt, or disguised upload payloads with 422 Unprocessable Entity
  - Cross-user storage path finalization prevention with 403 Forbidden
  - Tamper-evident chained audit logging for document finalization and purged uploads
- **Residual Risk:** None. All uploads must be finalized through server-side magic byte inspection, and direct client writes to other storage paths remain blocked.

---
