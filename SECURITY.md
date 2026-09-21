# Security Policy

MahaSetu is a secure, citizen-centric government interoperability mobile platform. We take the security and privacy of citizen identity documents and public services data with utmost seriousness.

---

## Supported Versions

Only the latest active release branch receives security fixes.

| Version | Supported          | Status |
| ------- | ------------------ | ------ |
| 1.0.x   | :white_check_mark: | Active production / remediation branch |
| < 1.0   | :x:                | Deprecated |

---

## Vulnerability Reporting Policy

If you discover a potential vulnerability or security flaw in MahaSetu Mobile, please report it through private, coordinated disclosure channels. **Do not create public GitHub issues or disclose vulnerabilities publicly before remediation.**

### Reporting Channels
- **Email:** `security@mahasetu.gov.in` (or administrative security contact)
- **PGP Key:** Available upon request or via national CERT-In disclosure portal.

### Report Details
Please include the following information in your report:
1. Description of the vulnerability, including attack vector and impacted components.
2. Step-by-step proof-of-concept (PoC) or reproduction steps.
3. Impact assessment (confidentiality, integrity, availability).
4. Any relevant logs, network captures, or code references.

---

## Response SLA & Remediation Commitments

We are committed to transparent, prompt resolution:
- **Initial Acknowledgment:** Within **48 hours** of receipt.
- **Triage & Severity Assessment:** Within **72 hours**.
- **Remediation Target:**
  - **Critical / High Severity:** Fix deployed within **7 calendar days**.
  - **Medium Severity:** Fix deployed within **14 calendar days**.
  - **Low Severity:** Addressed in the next planned minor release.

---

## Security Principles & Invariants

MahaSetu enforces the following foundational security controls:
1. **Zero Trust Authorization:** All mutations are authenticated via Firebase Admin SDK with signed custom token claims (`role`, `departmentId`, `status`). Body-supplied user identifiers and roles are strictly ignored.
2. **5/5 Statutory Isolation:** Applications require 5 independent certifications (Dept A, Dept B, Dept C, State Admin, Compliance Auditor). No single party can bypass or falsify slots.
3. **Citizen Data Minimization:** PII such as Aadhaar reference numbers are strictly masked (`XXXX-XXXX-1234`) and validated using Verhoeff checksums. Real Aadhaar numbers are never stored in plaintext.
4. **Transport Security:** Mobile communications mandate HTTPS / TLS 1.3 in production; cleartext HTTP traffic is disabled.
5. **No Mobile Secrets:** Service accounts, Twilio API auth tokens, and Gemini AI API keys reside exclusively in the backend server and are never bundled with the mobile client.

---

## Historical Secret Audit & Credential Rotation Advisory

During repository hardening, a static scan of the git history identified the following historical exposures:

| Commit Hash | File Path | Secret / Artifact Type | Date | Status / Action Required |
| :--- | :--- | :--- | :--- | :--- |
| `89677e7` | `constants/config.ts` | Firebase Web Client API Key (`AIzaSyAj...`), Project ID (`mahasetu-mobile-app`), App ID | 2026-09-09 | **Rotate:** Regenerate Web API key in Google Cloud / Firebase Console. Apply App Check and HTTP referer/bundle restrictions. |
| `89677e7` | `constants/demoData.ts` | Hardcoded shared demo password (`MahaSetu@2026!`) | 2026-09-09 | **Rotate:** Purged from active code in `ebb7bad`. Rotate any test/dev accounts created with this password. |
| `89677e7` | `backend/src/server.ts` | Hardcoded fallback credentials (`tammu.admin@mahasetu.gov.in`) | 2026-09-09 | **Rotate:** Removed in Task 1 (`dacc1e5`). Admin accounts now require distinct, rotated credentials. |
| `89677e7` | `firebase-debug.log` | Local network addresses, emulator ports, local file paths | 2026-09-09 | **Untracked:** Removed via `git rm --cached` in Task 7 and added to `.gitignore`. |
| `89677e7` | `backend/data/user_conversations.json` | Local test conversation messages | 2026-09-09 | **Untracked:** Removed via `git rm --cached` in Task 7 and added to `.gitignore`. |

### Immediate Actions for Project Owner
1. **Google Cloud / Firebase Console:**
   - Navigate to **APIs & Services > Credentials**.
   - Restrict the exposed browser key (`AIzaSyAj...`) to only Firebase Auth, Firestore, and Storage, or regenerate the key.
   - Enforce Firebase App Check on production buckets and Firestore.
2. **Twilio Console:**
   - Verify that production Twilio Account SIDs and Auth Tokens are only set in server-side environment variables and have never been committed.

### Purging Leaked Secrets from Git History (`git filter-repo`)

To rewrite history and permanently purge exposed credentials and artifacts before publishing the repository publicly, run the following commands in a **fresh, isolated clone** of the repository:

```bash
# 1. Clone repository to an isolated scratch folder
git clone <repo-url> mahasetu-clean
cd mahasetu-clean

# 2. Install git-filter-repo (requires Python 3)
pip install git-filter-repo

# 3. Permanently remove log files, scratch folders, and debug dumps from all commits
git-filter-repo --invert-paths \
  --path firebase-debug.log \
  --path backend/data/user_conversations.json \
  --path-glob 'scratch/*'

# 4. Replace leaked API keys and passwords across commit history
cat << 'EOF' > replace-patterns.txt
AIzaSyAj6AAYqX9EN8eLuJiRErVXd74xZgdsucc==>REDACTED_HISTORICAL_API_KEY
MahaSetu@2026!==>REDACTED_HISTORICAL_PASSWORD
EOF

git-filter-repo --replace-text replace-patterns.txt

# 5. Verify history is clean and force-push to remote (with team coordination)
git log -S "AIzaSy" --oneline
# git push origin --force --all
```

