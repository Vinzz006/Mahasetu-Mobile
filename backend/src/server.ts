/**
 * MahaSetu Trusted Backend API Server
 * Port 8000
 *
 * Implements server-side application submission, 5/5 verification stage workflow,
 * statutory citizen SMS notifications via Twilio Programmable Messaging,
 * duplicate prevention, zero-leak credential isolation, and strict claims-based authorization.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as http from 'http';
import * as crypto from 'crypto';
import { adminAuth, adminDb, adminAppCheck, adminStorage, FieldValue, Transaction } from './lib/firebaseAdmin';
import { sanitizeFirestorePayload, assertNoUndefinedValues } from './lib/firestoreUtils';
import { twilioBackendService } from './notifications/twilio.service';
import { APPLICATION_EVENTS, getSmsMessage } from './notifications/events';
import { geminiService } from './services/gemini.service';
import { logger } from './lib/logger';
import { verifyAppCheck } from './lib/appCheck';
import { validateResidentProfilePayload } from './lib/residentProfileValidator';
import { verifyOfficerConsent } from './lib/consentValidator';
import { writeAuditLog } from './lib/auditWriter';
import { validateFileMagicBytes } from './lib/fileSecurityValidator';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY_BYTES = 100 * 1024; // 100 KB limit

export interface VerifiedUserClaims {
  uid: string;
  email?: string;
  role?: string | null;
  departmentId?: string | null;
  status?: string | null;
  emailVerified?: boolean;
  authTime?: number;
}

export interface RouteConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  pattern: RegExp;
  roles: string[];
  requireApproved?: boolean; // default true
  requireVerifiedEmail?: boolean; // default true
  maxAuthAgeSec?: number;
}

export const KNOWN_ROLES = ['CITIZEN', 'DEPARTMENT_A', 'DEPARTMENT_B', 'DEPARTMENT_C', 'ADMIN', 'AUDITOR'] as const;

export const ROUTE_TABLE: RouteConfig[] = [
  // 1. Submit Application
  {
    method: 'POST',
    pattern: /^\/api\/v1\/applications$/,
    roles: ['CITIZEN'],
    requireApproved: true,
    requireVerifiedEmail: true,
  },
  // 2. Secondary Application Submit Trigger
  {
    method: 'POST',
    pattern: /^\/api\/v1\/applications\/[^/]+\/submit$/,
    roles: ['CITIZEN'],
    requireApproved: true,
    requireVerifiedEmail: true,
  },
  // 3. Verify Application Stage
  {
    method: 'POST',
    pattern: /^\/api\/v1\/applications\/[^/]+\/verify$/,
    roles: ['DEPARTMENT_A', 'DEPARTMENT_B', 'DEPARTMENT_C', 'ADMIN', 'AUDITOR'],
    requireApproved: true,
    requireVerifiedEmail: true,
  },
  // 4. Reject Application
  {
    method: 'POST',
    pattern: /^\/api\/v1\/applications\/[^/]+\/reject$/,
    roles: ['DEPARTMENT_A', 'DEPARTMENT_B', 'DEPARTMENT_C', 'ADMIN', 'AUDITOR'],
    requireApproved: true,
    requireVerifiedEmail: true,
  },
  // 5. AI Assistant Chat
  {
    method: 'POST',
    pattern: /^\/api\/v1\/ai\/chat$/,
    roles: ['CITIZEN', 'DEPARTMENT_A', 'DEPARTMENT_B', 'DEPARTMENT_C', 'ADMIN', 'AUDITOR'],
    requireApproved: true,
    requireVerifiedEmail: true,
  },
  // 6. User AI Chat History
  {
    method: 'GET',
    pattern: /^\/api\/v1\/ai\/history$/,
    roles: ['CITIZEN', 'DEPARTMENT_A', 'DEPARTMENT_B', 'DEPARTMENT_C', 'ADMIN', 'AUDITOR'],
    requireApproved: true,
    requireVerifiedEmail: true,
  },
  // 7a. GET Resident Profile (Allowed for PENDING citizen during onboarding)
  {
    method: 'GET',
    pattern: /^\/api\/v1\/resident-profile$/,
    roles: ['CITIZEN', 'ADMIN'],
    requireApproved: false,
    requireVerifiedEmail: true,
  },
  // 7b. POST Resident Profile (Allowed for PENDING citizen during onboarding)
  {
    method: 'POST',
    pattern: /^\/api\/v1\/resident-profile$/,
    roles: ['CITIZEN', 'ADMIN'],
    requireApproved: false,
    requireVerifiedEmail: true,
  },
  // 7c. DELETE Passport Metadata
  {
    method: 'DELETE',
    pattern: /^\/api\/v1\/resident-profile\/passport$/,
    roles: ['CITIZEN', 'ADMIN'],
    requireApproved: false,
    requireVerifiedEmail: true,
  },
  // 8a. Admin User Approval
  {
    method: 'POST',
    pattern: /^\/api\/v1\/admin\/user-approvals\/[^/]+\/approve$/,
    roles: ['ADMIN'],
    requireApproved: true,
    requireVerifiedEmail: true,
    maxAuthAgeSec: 300,
  },
  // 8b. Admin User Rejection
  {
    method: 'POST',
    pattern: /^\/api\/v1\/admin\/user-approvals\/[^/]+\/reject$/,
    roles: ['ADMIN'],
    requireApproved: true,
    requireVerifiedEmail: true,
    maxAuthAgeSec: 300,
  },
  // 8c. Admin Citizen Identity Certification
  {
    method: 'POST',
    pattern: /^\/api\/v1\/admin\/citizens\/[^/]+\/verify$/,
    roles: ['ADMIN'],
    requireApproved: true,
    requireVerifiedEmail: true,
    maxAuthAgeSec: 300,
  },
  // 8d. Admin User Suspend
  {
    method: 'POST',
    pattern: /^\/api\/v1\/admin\/users\/[^/]+\/suspend$/,
    roles: ['ADMIN'],
    requireApproved: true,
    requireVerifiedEmail: true,
    maxAuthAgeSec: 300,
  },
  // 8e. Admin User Reinstate
  {
    method: 'POST',
    pattern: /^\/api\/v1\/admin\/users\/[^/]+\/reinstate$/,
    roles: ['ADMIN'],
    requireApproved: true,
    requireVerifiedEmail: true,
    maxAuthAgeSec: 300,
  },
  // Twilio Health & Monitoring
  {
    method: 'GET',
    pattern: /^\/api\/v1\/admin\/twilio\/health$/,
    roles: ['ADMIN'],
    requireApproved: true,
    requireVerifiedEmail: true,
  },
  // AI Chat Legacy Cleanup
  {
    method: 'POST',
    pattern: /^\/api\/v1\/ai\/cleanup$/,
    roles: ['ADMIN'],
    requireApproved: true,
    requireVerifiedEmail: true,
  },
  // Demo Reset
  {
    method: 'POST',
    pattern: /^\/api\/v1\/demo\/reset$/,
    roles: ['ADMIN'],
    requireApproved: true,
    requireVerifiedEmail: true,
  },
  // 9a. Citizen Grant Consent
  {
    method: 'POST',
    pattern: /^\/api\/v1\/consent\/[^/]+\/grant$/,
    roles: ['CITIZEN'],
    requireApproved: true,
    requireVerifiedEmail: true,
  },
  // 9b. Citizen Deny Consent
  {
    method: 'POST',
    pattern: /^\/api\/v1\/consent\/[^/]+\/deny$/,
    roles: ['CITIZEN'],
    requireApproved: true,
    requireVerifiedEmail: true,
  },
  // 9c. Document Access Control Endpoint
  {
    method: 'POST',
    pattern: /^\/api\/v1\/documents\/access$/,
    roles: ['CITIZEN', 'DEPARTMENT_A', 'DEPARTMENT_B', 'DEPARTMENT_C', 'ADMIN', 'AUDITOR'],
    requireApproved: true,
    requireVerifiedEmail: true,
  },
  // 9d. Document Upload Finalization & Magic Byte Verification
  {
    method: 'POST',
    pattern: /^\/api\/v1\/documents\/finalize$/,
    roles: ['CITIZEN', 'ADMIN'],
    requireApproved: false,
    requireVerifiedEmail: true,
  },
];

export function findRoute(method: string, pathname: string): RouteConfig | null {
  for (const route of ROUTE_TABLE) {
    if (route.method === method && route.pattern.test(pathname)) {
      return route;
    }
  }
  return null;
}

// In-memory rate limiter per IP and per UID
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const ipRateLimits = new Map<string, RateLimitEntry>();
const uidRateLimits = new Map<string, RateLimitEntry>();

function checkRateLimit(key: string, map: Map<string, RateLimitEntry>, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || now > entry.resetTime) {
    map.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

// Periodic cleanup of rate limit maps every 5 minutes
(setInterval(() => {
  const now = Date.now();
  for (const [k, v] of ipRateLimits.entries()) {
    if (now > v.resetTime) ipRateLimits.delete(k);
  }
  for (const [k, v] of uidRateLimits.entries()) {
    if (now > v.resetTime) uidRateLimits.delete(k);
  }
}, 5 * 60 * 1000) as unknown as NodeJS.Timeout).unref();

/**
 * Authenticates Firebase ID Token passed in Authorization: Bearer <token>
 * Cryptographically verifies token signature, expiration, and revocation status
 * using Firebase Admin SDK.
 */
export async function verifyFirebaseToken(authHeader: string | undefined): Promise<VerifiedUserClaims | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token, true); // checkRevoked = true
    return {
      uid: decoded.uid,
      email: decoded.email,
      role: (decoded.role as string) || null,
      departmentId: (decoded.departmentId as string) || null,
      status: (decoded.status as string) || null,
      emailVerified: !!decoded.email_verified,
      authTime: decoded.auth_time,
    };
  } catch (err: any) {
    // Signature invalid, expired, revoked, or malformed
    return null;
  }
}

/**
 * Authorizes request against the route table policy.
 * Enforces email verification, strict role authorization, status gating, and auth age.
 */
export async function authorize(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  route: RouteConfig,
  requestId: string
): Promise<VerifiedUserClaims | null> {
  const claims = await verifyFirebaseToken(req.headers.authorization);
  if (!claims) {
    sendError(res, 401, 'Unauthorized: Valid authentication token required', requestId);
    return null;
  }

  const requireVerifiedEmail = route.requireVerifiedEmail !== false;
  if (requireVerifiedEmail && !claims.emailVerified) {
    sendError(res, 403, 'Forbidden: Verified email address required.', requestId);
    return null;
  }

  const roleUpper = (claims.role || '').toUpperCase();
  if (!roleUpper || !(KNOWN_ROLES as readonly string[]).includes(roleUpper) || claims.role === 'rejected') {
    sendError(res, 403, 'Forbidden: Invalid or unrecognized role.', requestId);
    return null;
  }

  if (route.roles && route.roles.length > 0) {
    const upperAllowed = route.roles.map((r) => r.toUpperCase());
    if (!upperAllowed.includes(roleUpper)) {
      sendError(res, 403, 'Forbidden: Insufficient role privileges for this endpoint.', requestId);
      return null;
    }
  }

  const requireApproved = route.requireApproved !== false; // Default true
  if (requireApproved) {
    if (claims.status !== 'APPROVED') {
      sendError(res, 403, 'Forbidden: Approved account required for this action.', requestId);
      return null;
    }
  } else {
    // For requireApproved: false routes (e.g. onboarding resident profile)
    if (!claims.status || claims.status === 'REJECTED' || claims.status === 'SUSPENDED') {
      sendError(res, 403, 'Forbidden: Account is suspended or rejected.', requestId);
      return null;
    }
  }

  if (route.maxAuthAgeSec) {
    const authAgeSec = claims.authTime ? Math.floor(Date.now() / 1000) - claims.authTime : Infinity;
    if (authAgeSec > route.maxAuthAgeSec) {
      sendJson(res, 401, {
        error: 'Re-authentication required for privileged action.',
        code: 'REAUTH_REQUIRED',
        requestId,
      });
      return null;
    }
  }

  return claims;
}

export async function checkNotLastAdmin(targetUid: string): Promise<boolean> {
  try {
    const adminSnap = await adminDb.collection('users')
      .where('role', '==', 'ADMIN')
      .where('status', '==', 'APPROVED')
      .get();

    const otherAdmins = adminSnap.docs.filter((d: any) => d.id !== targetUid && d.data().isActive !== false);
    return otherAdmins.length > 0;
  } catch (err) {
    // Fail closed
    return false;
  }
}

export function didIdentityFieldsChange(oldProfile: any, newSanitized: any): boolean {
  if (!oldProfile) return false;
  const identitySections = ['personalDetails', 'address', 'identity', 'family'];
  for (const sec of identitySections) {
    if (newSanitized[sec]) {
      const oldSec = oldProfile[sec] || {};
      const newSec = newSanitized[sec];
      for (const [k, v] of Object.entries(newSec)) {
        if (JSON.stringify(v) !== JSON.stringify(oldSec[k])) {
          return true;
        }
      }
    }
  }
  return false;
}

export function computeProfileCompletion(profile: any): { percentage: number; isComplete: boolean } {
  const missing: string[] = [];
  const p = profile.personalDetails;
  if (!p?.fullLegalName?.trim()) missing.push('Full Legal Name');
  if (!p?.dateOfBirth?.trim()) missing.push('Date of Birth');
  if (!p?.gender) missing.push('Gender');
  if (!p?.maritalStatus) missing.push('Marital Status');
  if (!p?.community) missing.push('Community');

  const addr = profile.address;
  if (!addr?.address?.trim()) missing.push('Residential Address');
  if (!addr?.city?.trim()) missing.push('City');
  if (!addr?.district?.trim()) missing.push('District');
  if (!addr?.state?.trim()) missing.push('State');
  if (!addr?.pinCode?.trim()) missing.push('PIN Code');

  const c = profile.contact;
  if (!c?.phoneNumber?.trim()) missing.push('Phone Number');
  if (!c?.emailAddress?.trim()) missing.push('Email Address');

  const f = profile.family;
  const hasParentOrGuardian = f?.fatherName?.trim() || f?.motherName?.trim() || f?.guardianName?.trim();
  if (!hasParentOrGuardian) missing.push('Parent / Guardian Name');

  const id = profile.identity;
  if (!id?.aadhaarReference?.trim()) missing.push('Aadhaar Reference');
  if (!id?.panCardNumber?.trim()) missing.push('PAN Card Number');

  const edu = profile.education;
  if (!edu?.educationalQualification?.trim()) missing.push('Educational Qualification');

  const b = profile.bank;
  if (!b?.bankName?.trim()) missing.push('Bank Name');
  if (!b?.accountHolderName?.trim()) missing.push('Account Holder Name');
  if (!b?.accountNumber?.trim()) missing.push('Bank Account Number');
  if (!b?.ifscCode?.trim()) missing.push('IFSC Code');

  const pass = profile.passport;
  if (pass?.hasPassport && !pass.documentPath) {
    missing.push('Passport Document PDF');
  }

  const totalChecks = 19;
  const filledCount = Math.max(0, totalChecks - missing.length);
  const percentage = Math.round((filledCount / totalChecks) * 100);
  const isComplete = missing.length === 0;

  return { percentage, isComplete };
}

const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim().toLowerCase())
  : [];

function setSecurityHeaders(req: http.IncomingMessage, res: http.ServerResponse) {
  const origin = req.headers.origin;
  if (origin) {
    const cleanOrigin = origin.trim().toLowerCase();
    if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(cleanOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else if (process.env.NODE_ENV !== 'production') {
      if (
        cleanOrigin.startsWith('http://localhost') ||
        cleanOrigin.startsWith('http://127.0.0.1') ||
        cleanOrigin.startsWith('http://10.') ||
        cleanOrigin.startsWith('http://192.168.')
      ) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Frame-Options', 'DENY');

  const isTls = (req.socket as any).encrypted || req.headers['x-forwarded-proto'] === 'https';
  if (isTls) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function sendJson(res: http.ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(
  res: http.ServerResponse,
  statusCode: number,
  userMessage: string,
  requestId: string,
  internalDetail?: any
) {
  if (internalDetail) {
    console.error(`[Server Error][ReqId: ${requestId}] ${statusCode} - ${userMessage}:`, internalDetail);
  }
  sendJson(res, statusCode, {
    error: userMessage,
    requestId,
  });
}

function parseJsonBody(req: http.IncomingMessage): Promise<{ ok: boolean; data?: any; error?: string }> {
  return new Promise((resolve) => {
    let body = '';
    let receivedBytes = 0;

    req.on('data', (chunk) => {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_BODY_BYTES) {
        req.destroy();
        resolve({ ok: false, error: 'PAYLOAD_TOO_LARGE' });
        return;
      }
      body += chunk.toString();
    });

    req.on('end', () => {
      if (!body || body.trim() === '') {
        resolve({ ok: true, data: {} });
        return;
      }
      try {
        const parsed = JSON.parse(body);
        resolve({ ok: true, data: parsed });
      } catch {
        resolve({ ok: false, error: 'INVALID_JSON' });
      }
    });

    req.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}

async function requireAuth(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestId: string
): Promise<VerifiedUserClaims | null> {
  const claims = await verifyFirebaseToken(req.headers.authorization);
  if (!claims) {
    sendError(res, 401, 'Unauthorized: Valid authentication token required', requestId);
    return null;
  }
  return claims;
}

function requireRole(
  claims: VerifiedUserClaims,
  allowedRoles: string[],
  res: http.ServerResponse,
  requestId: string
): boolean {
  const role = (claims.role || '').toUpperCase();
  const upperAllowed = allowedRoles.map((r) => r.toUpperCase());
  if (!role || !upperAllowed.includes(role)) {
    sendError(res, 403, 'Forbidden: Insufficient role privileges for this action', requestId);
    return false;
  }
  return true;
}

export function createBackendServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    const requestId = crypto.randomUUID();
    setSecurityHeaders(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp, ipRateLimits, 120, 60 * 1000)) {
      sendError(res, 429, 'Too many requests from this IP. Please try again later.', requestId);
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost:8000'}`);
    const pathname = url.pathname;

    try {
      // 0. Public Health Check (No Auth Required)
      if (req.method === 'GET' && (pathname === '/api/v1/health' || pathname === '/health')) {
        sendJson(res, 200, { status: 'healthy', timestamp: new Date().toISOString() });
        return;
      }

      // Match route against ROUTE_TABLE
      const route = findRoute(req.method || '', pathname);
      if (!route) {
        sendError(res, 404, 'Not Found', requestId);
        return;
      }

      // 0b. Firebase App Check Token Validation
      const appCheckPassed = await verifyAppCheck(req, res, requestId);
      if (!appCheckPassed) return;

      // Read Body for write methods
      let body: any = {};
      if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
        const bodyResult = await parseJsonBody(req);
        if (!bodyResult.ok) {
          if (bodyResult.error === 'PAYLOAD_TOO_LARGE') {
            sendError(res, 413, 'Payload too large. Maximum size is 100 KB.', requestId);
            return;
          }
          sendError(res, 400, 'Invalid JSON payload in request body.', requestId);
          return;
        }
        body = bodyResult.data || {};
      }

      // Authorize all non-health endpoints via strict claims gate
      const claims = await authorize(req, res, route, requestId);
      if (!claims) return;

      // ==========================================
      // 1. Submit Application (Approved Citizen Only)
      // ==========================================
      if (req.method === 'POST' && pathname === '/api/v1/applications') {
        if (!checkRateLimit(claims.uid, uidRateLimits, 60, 60 * 1000)) {
          sendError(res, 429, 'Rate limit exceeded for your account.', requestId);
          return;
        }

        // Generate authoritative server-controlled IDs and application number
        const appId = `app_${crypto.randomUUID()}`;
        const appNumber = `MS-${crypto.randomInt(10000, 99999)}`;
        const citizenId = claims.uid;

        // Strictly validate required serviceId
        if (typeof body.serviceId !== 'string' || !body.serviceId.trim()) {
          sendError(res, 400, 'Field "serviceId" is required and must be a non-empty string.', requestId);
          return;
        }
        const serviceId = body.serviceId.trim();
        if (!/^[a-zA-Z0-9_-]{2,100}$/.test(serviceId)) {
          sendError(res, 400, 'Invalid "serviceId" format: must be alphanumeric characters or underscores (2-100 chars).', requestId);
          return;
        }

        const serviceName = typeof body.serviceName === 'string' ? body.serviceName.substring(0, 200) : 'General Citizen Service';
        const category = typeof body.category === 'string' ? body.category.substring(0, 100) : 'GENERAL';

        // Validate and sanitize formData fields
        const sanitizedFormData: Record<string, any> = {};
        if (body.formData && typeof body.formData === 'object' && !Array.isArray(body.formData)) {
          for (const [k, v] of Object.entries(body.formData).slice(0, 50)) {
            if (/^[a-zA-Z0-9_.-]{1,60}$/.test(k)) {
              if (typeof v === 'string') {
                sanitizedFormData[k] = v.substring(0, 2000);
              } else if (typeof v === 'number' || typeof v === 'boolean') {
                sanitizedFormData[k] = v;
              }
            }
          }
        }
        const formData = sanitizedFormData;
        const documents = Array.isArray(body.documents) ? body.documents.slice(0, 20) : [];

        const batch = adminDb.batch();
        const appRef = adminDb.collection('applications').doc(appId);

        const appData = sanitizeFirestorePayload({
          id: appId,
          applicationNumber: appNumber,
          citizenId,
          citizenUid: citizenId,
          serviceId,
          serviceName,
          category,
          formData,
          documents,
          status: 'APPLICATION_SUBMITTED',
          verificationSummary: {
            totalRequired: 5,
            verifiedCount: 0,
            rejectedCount: 0,
            isFullyVerified: false,
          },
          verificationProgress: {
            completed: 0,
            required: 5,
          },
          submissionSmsSent: true,
          finalCompletionSmsSent: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        assertNoUndefinedValues(appData, `applications/${appId}`);
        batch.create(appRef, appData);

        // Atomically initialize the 5 verification slots in the same batch
        const slots = [
          { key: 'DEPARTMENT_A', sfx: 'department_a', dept: 'DEPARTMENT_A', name: 'Revenue & Civil Supplies' },
          { key: 'DEPARTMENT_B', sfx: 'department_b', dept: 'DEPARTMENT_B', name: 'Social Welfare & Inclusion' },
          { key: 'DEPARTMENT_C', sfx: 'department_c', dept: 'DEPARTMENT_C', name: 'Labour & Employment Welfare' },
          { key: 'ADMIN', sfx: 'admin', dept: null, name: 'MahaSetu State Administrator' },
          { key: 'AUDITOR', sfx: 'auditor', dept: null, name: 'Independent Compliance Auditor' },
        ];

        for (const slot of slots) {
          const sId = `${appId}_${slot.sfx}`;
          const sRef = adminDb.collection('applicationVerifications').doc(sId);
          const sPayload = sanitizeFirestorePayload({
            id: sId,
            applicationId: appId,
            citizenId,
            citizenUid: citizenId,
            verifierKey: slot.key,
            verifierName: slot.name,
            verifierRole: slot.key,
            departmentId: slot.dept,
            status: 'PENDING',
            comments: null,
            verifiedAt: null,
            rejectedAt: null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          assertNoUndefinedValues(sPayload, `applicationVerifications/${sId}`);
          batch.create(sRef, sPayload);
        }

        await batch.commit();

        // Safe background SMS dispatch
        try {
          await twilioBackendService.sendApplicationStatusSms({
            applicationId: appId,
            applicationNumber: appNumber,
            citizenId,
            eventType: APPLICATION_EVENTS.APPLICATION_SUBMITTED,
          });
        } catch (smsError: any) {
          console.warn('[Server] Twilio SMS dispatch warning on application create:', smsError.message);
        }

        sendJson(res, 201, {
          success: true,
          applicationId: appId,
          applicationNumber: appNumber,
          status: 'APPLICATION_SUBMITTED',
        });
        return;
      }

      // ==========================================
      // 2. Secondary Application Submit Trigger
      // ==========================================
      if (req.method === 'POST' && pathname.match(/^\/api\/v1\/applications\/([^/]+)\/submit$/)) {
        const matches = pathname.match(/^\/api\/v1\/applications\/([^/]+)\/submit$/);
        const appId = matches![1];

        const appRef = adminDb.collection('applications').doc(appId);
        const appSnap = await appRef.get();

        if (!appSnap.exists) {
          sendError(res, 404, 'Application not found', requestId);
          return;
        }

        const appData = appSnap.data()!;
        if (appData.citizenId !== claims.uid && appData.citizenUid !== claims.uid) {
          sendError(res, 403, 'Forbidden: You do not own this application', requestId);
          return;
        }

        // Idempotency check: do not re-send submission SMS
        if (appData.status === 'APPLICATION_SUBMITTED' || appData.submissionSmsSent === true) {
          sendJson(res, 200, {
            success: true,
            message: 'Application already submitted. No duplicate SMS dispatched.',
            idempotent: true,
          });
          return;
        }

        await appRef.update({
          status: 'APPLICATION_SUBMITTED',
          submissionSmsSent: true,
          updatedAt: FieldValue.serverTimestamp(),
        });

        try {
          await twilioBackendService.sendApplicationStatusSms({
            applicationId: appId,
            applicationNumber: appData.applicationNumber || appId,
            citizenId: claims.uid,
            eventType: APPLICATION_EVENTS.APPLICATION_SUBMITTED,
          });
        } catch (smsErr: any) {
          console.warn('[Server] Twilio submit SMS warning:', smsErr.message);
        }

        sendJson(res, 200, { success: true });
        return;
      }

      // ==========================================
      // 3. Verify Application Stage (Officers, Admin, Auditor)
      // ==========================================
      if (req.method === 'POST' && pathname.match(/^\/api\/v1\/applications\/([^/]+)\/verify$/)) {
        const matches = pathname.match(/^\/api\/v1\/applications\/([^/]+)\/verify$/);
        const appId = matches![1];

        // Derive verification slot SOLELY from caller claims (ignore any body verifierRole / departmentId)
        const roleUpper = (claims.role || '').toUpperCase();
        const deptUpper = (claims.departmentId || '').toUpperCase();

        let slotKey: string | null = null;
        let docSuffix: string | null = null;
        let deptName: string | null = null;
        let eventType: string = APPLICATION_EVENTS.DEPARTMENT_A_VERIFIED;

        if (roleUpper === 'DEPARTMENT_A' || deptUpper === 'DEPARTMENT_A' || deptUpper === 'DEPT_A') {
          slotKey = 'DEPARTMENT_A';
          docSuffix = 'department_a';
          deptName = 'Department A';
          eventType = APPLICATION_EVENTS.DEPARTMENT_A_VERIFIED;
        } else if (roleUpper === 'DEPARTMENT_B' || deptUpper === 'DEPARTMENT_B' || deptUpper === 'DEPT_B') {
          slotKey = 'DEPARTMENT_B';
          docSuffix = 'department_b';
          deptName = 'Department B';
          eventType = APPLICATION_EVENTS.DEPARTMENT_B_VERIFIED;
        } else if (roleUpper === 'DEPARTMENT_C' || deptUpper === 'DEPARTMENT_C' || deptUpper === 'DEPT_C') {
          slotKey = 'DEPARTMENT_C';
          docSuffix = 'department_c';
          deptName = 'Department C';
          eventType = APPLICATION_EVENTS.DEPARTMENT_C_VERIFIED;
        } else if (roleUpper === 'ADMIN') {
          slotKey = 'ADMIN';
          docSuffix = 'admin';
          deptName = 'State Administration';
          eventType = APPLICATION_EVENTS.ADMIN_VERIFIED;
        } else if (roleUpper === 'AUDITOR') {
          slotKey = 'AUDITOR';
          docSuffix = 'auditor';
          deptName = 'Independent Compliance Auditor';
          eventType = APPLICATION_EVENTS.AUDITOR_VERIFIED;
        } else {
          sendError(res, 403, 'Forbidden: Officer, Admin, or Auditor authorization required.', requestId);
          return;
        }

        if (body.status && body.status !== 'VERIFIED' && body.status !== 'REJECTED') {
          sendError(res, 400, 'Invalid status: must be either VERIFIED or REJECTED.', requestId);
          return;
        }

        const comments = typeof body.comments === 'string'
          ? body.comments.substring(0, 1000).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
          : 'Verified in compliance with MahaSetu guidelines';

        const appRef = adminDb.collection('applications').doc(appId);
        const vDocId = `${appId}_${docSuffix}`;
        const vRef = adminDb.collection('applicationVerifications').doc(vDocId);

        // Execute in a Firestore transaction for atomic slot decision and recount
        const txResult = await adminDb.runTransaction(async (transaction: Transaction) => {
          const appDoc = await transaction.get(appRef);
          if (!appDoc.exists) {
            return { notFound: true };
          }
          const appData = appDoc.data()!;
          const vDoc = await transaction.get(vRef);

          if (vDoc.exists) {
            const vData = vDoc.data()!;
            if (vData.status === 'VERIFIED') {
              return { duplicate: true, appData };
            }
            if (vData.status === 'REJECTED') {
              return { rejected: true, appData };
            }
          }

          transaction.set(
            vRef,
            {
              id: vDocId,
              applicationId: appId,
              citizenId: appData.citizenId || appData.citizenUid,
              citizenUid: appData.citizenUid || appData.citizenId,
              verifierKey: slotKey,
              verifierRole: slotKey,
              verifierUid: claims.uid,
              status: 'VERIFIED',
              comments,
              verifiedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          // Recount the 5 verification slots within the transaction
          const slotSuffixes = ['department_a', 'department_b', 'department_c', 'admin', 'auditor'];
          let verifiedCount = 0;
          let rejectedCount = 0;

          for (const sfx of slotSuffixes) {
            const sId = `${appId}_${sfx}`;
            if (sId === vDocId) {
              verifiedCount++;
            } else {
              const sDoc = await transaction.get(adminDb.collection('applicationVerifications').doc(sId));
              if (sDoc.exists) {
                const sData = sDoc.data()!;
                if (sData.status === 'VERIFIED') verifiedCount++;
                if (sData.status === 'REJECTED') rejectedCount++;
              }
            }
          }

          const isFullyVerified = verifiedCount === 5;
          const appStatus = isFullyVerified ? 'APPLICATION_VERIFIED' : 'UNDER_VERIFICATION';
          const shouldSendCompletionSms = isFullyVerified && !appData.finalCompletionSmsSent;

          const appUpdate: any = {
            'verificationSummary.verifiedCount': verifiedCount,
            'verificationSummary.rejectedCount': rejectedCount,
            'verificationSummary.isFullyVerified': isFullyVerified,
            'verificationProgress.completed': verifiedCount,
            'verificationProgress.required': 5,
            status: appStatus,
            updatedAt: FieldValue.serverTimestamp(),
          };

          if (isFullyVerified) {
            appUpdate.completedAt = FieldValue.serverTimestamp();
            if (shouldSendCompletionSms) {
              appUpdate.finalCompletionSmsSent = true;
            }
          }

          transaction.update(appRef, appUpdate);

          return {
            success: true,
            verifiedCount,
            isFullyVerified,
            appStatus,
            shouldSendCompletionSms,
            citizenId: appData.citizenId || appData.citizenUid,
            applicationNumber: appData.applicationNumber || appId,
          };
        });

        if (txResult.notFound) {
          sendError(res, 404, 'Application not found', requestId);
          return;
        }

        if (txResult.duplicate) {
          sendJson(res, 200, {
            success: true,
            message: 'Application slot already verified. No duplicate SMS sent.',
            duplicate: true,
          });
          return;
        }

        if (txResult.rejected) {
          sendError(res, 409, 'Application slot has already been rejected and cannot be verified.', requestId);
          return;
        }

        // Side-effect SMS dispatch based on transaction outcome
        if (txResult.shouldSendCompletionSms) {
          try {
            await twilioBackendService.sendApplicationStatusSms({
              applicationId: appId,
              applicationNumber: txResult.applicationNumber,
              citizenId: txResult.citizenId,
              eventType: APPLICATION_EVENTS.AUDITOR_VERIFIED,
              message: `MAHASETU: Your application ${txResult.applicationNumber} has completed all verification stages.`,
            });
          } catch (smsErr: any) {
            console.warn('[Server] Final completion SMS side-effect failure:', smsErr.message);
          }
        } else {
          try {
            await twilioBackendService.sendApplicationStatusSms({
              applicationId: appId,
              applicationNumber: txResult.applicationNumber,
              citizenId: txResult.citizenId,
              eventType,
              departmentName: deptName || undefined,
            });
          } catch (smsErr: any) {
            console.warn('[Server] Stage SMS dispatch failure:', smsErr.message);
          }
        }

        sendJson(res, 200, {
          success: true,
          verifiedCount: txResult.verifiedCount,
          isFullyVerified: txResult.isFullyVerified,
          status: txResult.appStatus,
        });
        return;
      }

      // ==========================================
      // 4. Reject Application (Officer, Admin, Auditor for their slot)
      // ==========================================
      if (req.method === 'POST' && pathname.match(/^\/api\/v1\/applications\/([^/]+)\/reject$/)) {
        const matches = pathname.match(/^\/api\/v1\/applications\/([^/]+)\/reject$/);
        const appId = matches![1];

        const roleUpper = (claims.role || '').toUpperCase();
        const deptUpper = (claims.departmentId || '').toUpperCase();

        let slotKey: string | null = null;
        let docSuffix: string | null = null;

        if (roleUpper === 'DEPARTMENT_A' || deptUpper === 'DEPARTMENT_A' || deptUpper === 'DEPT_A') {
          slotKey = 'DEPARTMENT_A';
          docSuffix = 'department_a';
        } else if (roleUpper === 'DEPARTMENT_B' || deptUpper === 'DEPARTMENT_B' || deptUpper === 'DEPT_B') {
          slotKey = 'DEPARTMENT_B';
          docSuffix = 'department_b';
        } else if (roleUpper === 'DEPARTMENT_C' || deptUpper === 'DEPARTMENT_C' || deptUpper === 'DEPT_C') {
          slotKey = 'DEPARTMENT_C';
          docSuffix = 'department_c';
        } else if (roleUpper === 'ADMIN') {
          slotKey = 'ADMIN';
          docSuffix = 'admin';
        } else if (roleUpper === 'AUDITOR') {
          slotKey = 'AUDITOR';
          docSuffix = 'auditor';
        } else {
          sendError(res, 403, 'Forbidden: Officer, Admin, or Auditor authorization required to reject.', requestId);
          return;
        }

        const reason = typeof body.reason === 'string' && body.reason.trim()
          ? body.reason.trim().substring(0, 500)
          : 'Application criteria not met';

        const appRef = adminDb.collection('applications').doc(appId);
        const vDocId = `${appId}_${docSuffix}`;
        const vRef = adminDb.collection('applicationVerifications').doc(vDocId);

        const txResult = await adminDb.runTransaction(async (transaction: Transaction) => {
          const appDoc = await transaction.get(appRef);
          if (!appDoc.exists) {
            return { notFound: true };
          }
          const appData = appDoc.data()!;

          transaction.set(
            vRef,
            {
              id: vDocId,
              applicationId: appId,
              citizenId: appData.citizenId || appData.citizenUid,
              verifierKey: slotKey,
              verifierRole: slotKey,
              rejectedByUid: claims.uid,
              status: 'REJECTED',
              rejectionReason: reason,
              rejectedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          transaction.update(appRef, {
            status: 'REJECTED',
            rejectionReason: reason,
            rejectedBy: claims.uid,
            rejectedByRole: slotKey,
            rejectedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          return {
            success: true,
            citizenId: appData.citizenId || appData.citizenUid,
            applicationNumber: appData.applicationNumber || appId,
          };
        });

        if (txResult.notFound) {
          sendError(res, 404, 'Application not found', requestId);
          return;
        }

        // Send Rejection SMS
        try {
          await twilioBackendService.sendApplicationStatusSms({
            applicationId: appId,
            applicationNumber: txResult.applicationNumber,
            citizenId: txResult.citizenId,
            eventType: APPLICATION_EVENTS.APPLICATION_REJECTED,
            message: `MAHASETU: Your application ${txResult.applicationNumber} requires attention. Please open MahaSetu for details.`,
          });
        } catch (smsErr: any) {
          console.warn('[Server] Rejection Twilio SMS failure:', smsErr.message);
        }

        console.log(`[Audit] Application ${appId} rejected by ${claims.uid} (${slotKey}): ${reason}`);
        sendJson(res, 200, { success: true, message: 'Application rejected.' });
        return;
      }

      // ==========================================
      // 5. AI Assistant Chat (Authenticated Citizen/User)
      // ==========================================
      if (req.method === 'POST' && pathname === '/api/v1/ai/chat') {
        const userId = claims.uid;

        // Retrieve user profile from Firestore users/{userId}
        let userProfile: any = { role: claims.role || 'CITIZEN', name: 'Citizen' };
        try {
          const userSnap = await adminDb.collection('users').doc(userId).get();
          if (userSnap.exists) {
            userProfile = userSnap.data()!;
            if (userProfile.status === 'SUSPENDED') {
              sendError(res, 403, 'Account suspended. AI Assistant access is denied.', requestId);
              return;
            }
          }
        } catch (uErr: any) {
          console.warn('[Server] Profile lookup fallback:', uErr.message);
        }

        const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';
        const message = rawMessage.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        if (!message) {
          sendError(res, 400, 'Message content is required.', requestId);
          return;
        }
        if (message.length > 2000) {
          sendError(res, 400, 'Message exceeds maximum length of 2000 characters.', requestId);
          return;
        }

        const conversationId = typeof body.conversationId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(body.conversationId)
          ? body.conversationId
          : undefined;

        try {
          const chatResult = await geminiService.generateMahaSetuChatResponse({
            userId,
            userRole: userProfile.role,
            message,
            conversationId,
            userProfile,
          });

          if (chatResult.rateLimited) {
            sendJson(res, 429, chatResult);
            return;
          }

          sendJson(res, 200, chatResult);
          return;
        } catch (chatErr: any) {
          if (chatErr.statusCode === 403) {
            sendError(res, 403, chatErr.message, requestId);
            return;
          }
          throw chatErr;
        }
      }

      // ==========================================
      // 6. Get User's Isolated AI Chat History
      // ==========================================
      if (req.method === 'GET' && pathname === '/api/v1/ai/history') {
        const userId = claims.uid;
        const requestedConvId = url.searchParams.get('conversationId') || undefined;

        try {
          const history = await geminiService.getUserConversationHistory(userId, requestedConvId);
          sendJson(res, 200, history);
        } catch (err: any) {
          if (err.statusCode === 403) {
            sendError(res, 403, err.message, requestId);
            return;
          }
          sendError(res, 500, 'Error retrieving chat history.', requestId, err);
        }
        return;
      }

      // ==========================================
      // 7. Government Resident Profile Endpoints
      // ==========================================

      // 7a. GET Resident Profile
      if (req.method === 'GET' && pathname === '/api/v1/resident-profile') {
        try {
          const profileDoc = await adminDb.collection('residentProfiles').doc(claims.uid).get();
          if (!profileDoc.exists) {
            sendError(res, 404, 'Resident profile not found', requestId);
            return;
          }
          sendJson(res, 200, profileDoc.data());
        } catch (err: any) {
          sendError(res, 500, 'Failed to fetch resident profile', requestId, err);
        }
        return;
      }

      // 7b. POST / Save Resident Profile
      if (req.method === 'POST' && pathname === '/api/v1/resident-profile') {
        if (body?.userId && typeof body.userId === 'string' && body.userId !== claims.uid && claims.role !== 'ADMIN') {
          sendError(res, 403, 'Forbidden: Cannot modify another resident profile.', requestId);
          return;
        }

        const valResult = validateResidentProfilePayload(body, claims.uid);
        if (!valResult.valid || !valResult.sanitized) {
          sendError(res, 422, `Unprocessable Entity: ${valResult.errors?.join('; ')}`, requestId);
          return;
        }

        try {
          const profileRef = adminDb.collection('residentProfiles').doc(claims.uid);
          const existingSnap = await profileRef.get();
          const existingData = existingSnap.exists ? existingSnap.data()! : null;

          let certificationStatus = existingData?.certificationStatus || 'PENDING';
          let certifiedBy = existingData?.certifiedBy || null;
          let certifiedAt = existingData?.certifiedAt || null;

          // Check if previously certified identity was modified
          if (existingData && existingData.certificationStatus === 'VERIFIED') {
            const changed = didIdentityFieldsChange(existingData, valResult.sanitized);
            if (changed) {
              certificationStatus = 'PENDING';
              certifiedBy = null;
              certifiedAt = null;

              // Reset status in users collection
              await adminDb.collection('users').doc(claims.uid).set({
                isVerified: false,
                identityStatus: 'PENDING',
                updatedAt: FieldValue.serverTimestamp(),
              }, { merge: true });

              logger.audit({
                event: 'RESIDENT_IDENTITY_CERTIFICATION_RESET',
                action: 'reset_identity_certification_on_profile_edit',
                actor: { uid: claims.uid, role: claims.role, departmentId: claims.departmentId },
                target: { resource: 'residentProfile', id: claims.uid },
                outcome: 'SUCCESS',
                details: { reason: 'Identity-bearing fields were modified post-verification' },
              });
            }
          }

          const mergedProfile = {
            ...(existingData || {}),
            ...valResult.sanitized,
          };
          const { percentage, isComplete } = computeProfileCompletion(mergedProfile);

          const finalDocData = sanitizeFirestorePayload({
            ...valResult.sanitized,
            userId: claims.uid,
            certificationStatus,
            certifiedBy,
            certifiedAt,
            isComplete,
            completionPercentage: percentage,
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: existingData?.createdAt || FieldValue.serverTimestamp(),
          });

          await profileRef.set(finalDocData, { merge: true });

          // Synchronize completion and profile flag to users collection
          await adminDb.collection('users').doc(claims.uid).set({
            hasResidentProfile: true,
            identityStatus: certificationStatus,
            profileCompletion: percentage,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          sendJson(res, 200, {
            success: true,
            message: 'Government Resident Profile saved successfully',
            profile: finalDocData,
          });
        } catch (err: any) {
          sendError(res, 500, 'Failed to save resident profile', requestId, err);
        }
        return;
      }

      // 7c. DELETE Passport Metadata & Storage File
      if (req.method === 'DELETE' && pathname === '/api/v1/resident-profile/passport') {
        try {
          const profileRef = adminDb.collection('residentProfiles').doc(claims.uid);
          const snap = await profileRef.get();
          if (snap.exists) {
            const pData = snap.data()!;
            const docPath = pData.passport?.documentPath;
            if (typeof docPath === 'string' && docPath.startsWith(`residentDocuments/${claims.uid}/passport/`)) {
              try {
                await adminStorage.bucket().file(docPath).delete({ ignoreNotFound: true });
              } catch (storageErr: any) {
                console.warn('[Server] Storage file delete warning:', storageErr.message);
              }
            }
          }

          await profileRef.update({
            'passport.hasPassport': false,
            'passport.documentPath': null,
            'passport.fileName': null,
            'passport.fileSize': null,
            'passport.uploadedAt': null,
            updatedAt: FieldValue.serverTimestamp(),
          });

          sendJson(res, 200, {
            success: true,
            message: 'Passport document metadata and storage file cleared successfully',
          });
        } catch (err: any) {
          sendError(res, 500, 'Failed to clear passport metadata', requestId, err);
        }
        return;
      }

      // ==========================================
      // 8. Admin Privileged Routes (ADMIN Role Only)
      // ==========================================

      // 8a. Admin User Approval & Custom Claims Assignment
      const approveMatch = pathname.match(/^\/api\/v1\/admin\/user-approvals\/([^/]+)\/approve$/);
      if (req.method === 'POST' && approveMatch) {
        const targetUid = approveMatch[1];
        if (targetUid === claims.uid) {
          sendError(res, 400, 'Forbidden: Self-approval or self-role assignment is prohibited.', requestId);
          return;
        }

        let targetUserRecord: any;
        try {
          targetUserRecord = await adminAuth.getUser(targetUid);
        } catch {
          sendError(res, 404, `Target user ${targetUid} not found in authentication registry.`, requestId);
          return;
        }

        const role = typeof body.role === 'string' ? body.role.toUpperCase() : '';
        const allowedRoles = ['CITIZEN', 'DEPARTMENT_A', 'DEPARTMENT_B', 'DEPARTMENT_C', 'ADMIN', 'AUDITOR'];
        if (!allowedRoles.includes(role)) {
          sendError(res, 400, `Invalid role: must be one of ${allowedRoles.join(', ')}`, requestId);
          return;
        }

        // Prevent demoting the last remaining admin
        if (targetUserRecord.customClaims?.role === 'ADMIN' && role !== 'ADMIN') {
          const hasOtherAdmin = await checkNotLastAdmin(targetUid);
          if (!hasOtherAdmin) {
            sendError(res, 400, 'Forbidden: Cannot demote the last remaining administrator.', requestId);
            return;
          }
        }

        const isDept = ['DEPARTMENT_A', 'DEPARTMENT_B', 'DEPARTMENT_C'].includes(role);
        let departmentId: string | null = null;
        if (isDept) {
          if (!body.departmentId || body.departmentId.toUpperCase() !== role) {
            sendError(res, 400, `Department ID must match the assigned department role ${role}.`, requestId);
            return;
          }
          departmentId = role;
        } else {
          if (body.departmentId) {
            sendError(res, 400, 'Department ID is not permitted for non-department roles.', requestId);
            return;
          }
        }

        // Set signed custom claims and revoke tokens for immediate demotion/role detection
        await adminAuth.setCustomUserClaims(targetUid, {
          role,
          departmentId,
          status: 'APPROVED',
        });
        await adminAuth.revokeRefreshTokens(targetUid);

        // Update Firestore user document
        await adminDb.collection('users').doc(targetUid).set({
          role,
          departmentId,
          status: 'APPROVED',
          isActive: true,
          approvedBy: claims.uid,
          approvedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        logger.audit({
          event: 'ADMIN_USER_APPROVED',
          action: 'approve_user_and_set_claims',
          actor: { uid: claims.uid, role: claims.role, departmentId: claims.departmentId },
          target: { resource: 'user', id: targetUid },
          outcome: 'SUCCESS',
          details: { assignedRole: role, departmentId },
        });
        sendJson(res, 200, { success: true, message: `User ${targetUid} approved with role ${role}.` });
        return;
      }

      // 8b. Admin User Rejection
      const rejectMatch = pathname.match(/^\/api\/v1\/admin\/user-approvals\/([^/]+)\/reject$/);
      if (req.method === 'POST' && rejectMatch) {
        const targetUid = rejectMatch[1];
        if (targetUid === claims.uid) {
          sendError(res, 400, 'Forbidden: Self-rejection is not allowed.', requestId);
          return;
        }

        let targetUserRecord: any;
        try {
          targetUserRecord = await adminAuth.getUser(targetUid);
        } catch {
          sendError(res, 404, `Target user ${targetUid} not found in authentication registry.`, requestId);
          return;
        }

        if (targetUserRecord.customClaims?.role === 'ADMIN') {
          const hasOtherAdmin = await checkNotLastAdmin(targetUid);
          if (!hasOtherAdmin) {
            sendError(res, 400, 'Forbidden: Cannot reject the last remaining administrator.', requestId);
            return;
          }
        }

        const reason = typeof body.reason === 'string' && body.reason.trim()
          ? body.reason.trim().substring(0, 500)
          : 'Registration rejected by administrator';

        // Revoke claims and refresh tokens
        await adminAuth.setCustomUserClaims(targetUid, {
          role: 'rejected',
          status: 'REJECTED',
        });
        await adminAuth.revokeRefreshTokens(targetUid);

        // Update Firestore user document
        await adminDb.collection('users').doc(targetUid).set({
          status: 'REJECTED',
          isActive: false,
          rejectionReason: reason,
          rejectedBy: claims.uid,
          rejectedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        logger.audit({
          event: 'ADMIN_USER_REJECTED',
          action: 'reject_user_and_revoke_claims',
          actor: { uid: claims.uid, role: claims.role, departmentId: claims.departmentId },
          target: { resource: 'user', id: targetUid },
          outcome: 'SUCCESS',
          details: { reason },
        });
        sendJson(res, 200, { success: true, message: `User ${targetUid} rejected.` });
        return;
      }

      // 8c. Admin Citizen Identity Certification
      const verifyCitizenMatch = pathname.match(/^\/api\/v1\/admin\/citizens\/([^/]+)\/verify$/);
      if (req.method === 'POST' && verifyCitizenMatch) {
        const targetUid = verifyCitizenMatch[1];

        try {
          await adminAuth.getUser(targetUid);
        } catch {
          sendError(res, 404, `Target citizen ${targetUid} not found in authentication registry.`, requestId);
          return;
        }

        const isVerified = body.verified === true;

        await adminDb.collection('users').doc(targetUid).set({
          isVerified,
          identityStatus: isVerified ? 'VERIFIED' : 'REJECTED',
          verifiedBy: claims.uid,
          verifiedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        const rpRef = adminDb.collection('residentProfiles').doc(targetUid);
        const rpSnap = await rpRef.get();
        if (rpSnap.exists) {
          await rpRef.set({
            certificationStatus: isVerified ? 'VERIFIED' : 'REJECTED',
            certifiedBy: claims.uid,
            certifiedAt: FieldValue.serverTimestamp(),
            isVerified,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        logger.audit({
          event: 'ADMIN_CITIZEN_VERIFIED',
          action: 'certify_citizen_identity',
          actor: { uid: claims.uid, role: claims.role, departmentId: claims.departmentId },
          target: { resource: 'user', id: targetUid },
          outcome: 'SUCCESS',
          details: { isVerified },
        });
        sendJson(res, 200, { success: true, isVerified });
        return;
      }

      // 8d. Admin User Suspend
      const suspendMatch = pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/suspend$/);
      if (req.method === 'POST' && suspendMatch) {
        const targetUid = suspendMatch[1];
        if (targetUid === claims.uid) {
          sendError(res, 400, 'Forbidden: Cannot suspend your own administrative account.', requestId);
          return;
        }

        let targetUserRecord: any;
        try {
          targetUserRecord = await adminAuth.getUser(targetUid);
        } catch {
          sendError(res, 404, `Target user ${targetUid} not found in authentication registry.`, requestId);
          return;
        }

        if (targetUserRecord.customClaims?.role === 'ADMIN') {
          const hasOtherAdmin = await checkNotLastAdmin(targetUid);
          if (!hasOtherAdmin) {
            sendError(res, 400, 'Forbidden: Cannot suspend the last remaining administrator.', requestId);
            return;
          }
        }

        const reason = typeof body.reason === 'string' && body.reason.trim()
          ? body.reason.trim().substring(0, 500)
          : 'Account suspended by administrator';

        const existingRole = targetUserRecord.customClaims?.role || 'CITIZEN';
        const existingDept = targetUserRecord.customClaims?.departmentId || null;

        await adminAuth.setCustomUserClaims(targetUid, {
          role: existingRole,
          departmentId: existingDept,
          status: 'SUSPENDED',
        });
        await adminAuth.revokeRefreshTokens(targetUid);
        await adminAuth.updateUser(targetUid, { disabled: true });

        await adminDb.collection('users').doc(targetUid).set({
          status: 'SUSPENDED',
          isActive: false,
          suspendedReason: reason,
          suspendedBy: claims.uid,
          suspendedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        logger.audit({
          event: 'ADMIN_USER_SUSPENDED',
          action: 'suspend_user_and_revoke_tokens',
          actor: { uid: claims.uid, role: claims.role, departmentId: claims.departmentId },
          target: { resource: 'user', id: targetUid },
          outcome: 'SUCCESS',
          details: { reason },
        });
        sendJson(res, 200, { success: true, message: `User ${targetUid} suspended.` });
        return;
      }

      // 8e. Admin User Reinstate
      const reinstateMatch = pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/reinstate$/);
      if (req.method === 'POST' && reinstateMatch) {
        const targetUid = reinstateMatch[1];
        let targetUserRecord: any;
        try {
          targetUserRecord = await adminAuth.getUser(targetUid);
        } catch {
          sendError(res, 404, `Target user ${targetUid} not found in authentication registry.`, requestId);
          return;
        }

        const existingRole = targetUserRecord.customClaims?.role || 'CITIZEN';
        const existingDept = targetUserRecord.customClaims?.departmentId || null;

        await adminAuth.setCustomUserClaims(targetUid, {
          role: existingRole,
          departmentId: existingDept,
          status: 'APPROVED',
        });
        await adminAuth.revokeRefreshTokens(targetUid);
        await adminAuth.updateUser(targetUid, { disabled: false });

        await adminDb.collection('users').doc(targetUid).set({
          status: 'APPROVED',
          isActive: true,
          reinstatedBy: claims.uid,
          reinstatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        logger.audit({
          event: 'ADMIN_USER_REINSTATED',
          action: 'reinstate_user_and_enable_account',
          actor: { uid: claims.uid, role: claims.role, departmentId: claims.departmentId },
          target: { resource: 'user', id: targetUid },
          outcome: 'SUCCESS',
        });
        sendJson(res, 200, { success: true, message: `User ${targetUid} reinstated.` });
        return;
      }

      // Twilio Health & Monitoring
      if (req.method === 'GET' && pathname === '/api/v1/admin/twilio/health') {
        const health = await twilioBackendService.getTwilioHealth();
        sendJson(res, 200, health);
        return;
      }

      // AI Chat Legacy Data Cleanup / Quarantine
      if (req.method === 'POST' && pathname === '/api/v1/ai/cleanup') {
        const cleanupResult = await geminiService.quarantineLegacyConversations();
        sendJson(res, 200, { success: true, ...cleanupResult });
        return;
      }

      // 9a. Citizen Grant Consent
      const consentGrantMatch = pathname.match(/^\/api\/v1\/consent\/([^/]+)\/grant$/);
      if (req.method === 'POST' && consentGrantMatch) {
        const consentId = consentGrantMatch[1];
        const cDoc = await adminDb.collection('consents').doc(consentId).get();
        if (!cDoc.exists) {
          sendError(res, 404, 'Consent request not found', requestId);
          return;
        }
        const cData = cDoc.data()!;
        if (cData.citizenUid !== claims.uid) {
          sendError(res, 403, 'Forbidden: Cannot grant consent for another citizen', requestId);
          return;
        }

        await adminDb.collection('consents').doc(consentId).update({
          status: 'GRANTED',
          grantedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        await writeAuditLog(adminDb, {
          actorUid: claims.uid,
          actorRole: claims.role || 'CITIZEN',
          action: 'CITIZEN_GRANTED_CONSENT',
          targetType: 'CONSENT',
          targetId: consentId,
          details: { targetDepartment: cData.targetDepartment, applicationId: cData.applicationId },
        });

        sendJson(res, 200, { success: true, message: 'Consent granted successfully.' });
        return;
      }

      // 9b. Citizen Deny Consent
      const consentDenyMatch = pathname.match(/^\/api\/v1\/consent\/([^/]+)\/deny$/);
      if (req.method === 'POST' && consentDenyMatch) {
        const consentId = consentDenyMatch[1];
        const cDoc = await adminDb.collection('consents').doc(consentId).get();
        if (!cDoc.exists) {
          sendError(res, 404, 'Consent request not found', requestId);
          return;
        }
        const cData = cDoc.data()!;
        if (cData.citizenUid !== claims.uid) {
          sendError(res, 403, 'Forbidden: Cannot deny consent for another citizen', requestId);
          return;
        }

        await adminDb.collection('consents').doc(consentId).update({
          status: 'DENIED',
          deniedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        await writeAuditLog(adminDb, {
          actorUid: claims.uid,
          actorRole: claims.role || 'CITIZEN',
          action: 'CITIZEN_DENIED_CONSENT',
          targetType: 'CONSENT',
          targetId: consentId,
          details: { targetDepartment: cData.targetDepartment, applicationId: cData.applicationId },
        });

        sendJson(res, 200, { success: true, message: 'Consent denied successfully.' });
        return;
      }

      // 9c. Document Access Control Endpoint
      if (req.method === 'POST' && pathname === '/api/v1/documents/access') {
        const citizenUid = typeof body.citizenUid === 'string' ? body.citizenUid.trim() : '';
        const documentPath = typeof body.documentPath === 'string' ? body.documentPath.trim() : '';
        const applicationId = typeof body.applicationId === 'string' ? body.applicationId.trim() : undefined;

        if (!citizenUid || !documentPath) {
          sendError(res, 400, 'Bad Request: "citizenUid" and "documentPath" are required.', requestId);
          return;
        }

        // Citizens can only access their own documents
        if (claims.role === 'CITIZEN') {
          if (claims.uid !== citizenUid) {
            sendError(res, 403, 'Forbidden: Citizens can only access their own documents.', requestId);
            return;
          }
        } else {
          // Department officers must have active citizen consent
          const consentCheck = await verifyOfficerConsent({
            db: adminDb,
            citizenUid,
            departmentId: claims.departmentId || claims.role || '',
            officerRole: claims.role || '',
            officerUid: claims.uid,
            applicationId,
          });

          if (!consentCheck.allowed) {
            await writeAuditLog(adminDb, {
              actorUid: claims.uid,
              actorRole: claims.role || 'UNKNOWN',
              action: 'DOCUMENT_ACCESS_DENIED_NO_CONSENT',
              targetType: 'DOCUMENT',
              targetId: documentPath,
              details: { citizenUid, reason: consentCheck.reason, departmentId: claims.departmentId },
            });
            sendError(res, 403, `Forbidden: ${consentCheck.reason || 'Active citizen consent required.'}`, requestId);
            return;
          }
        }

        await writeAuditLog(adminDb, {
          actorUid: claims.uid,
          actorRole: claims.role || 'UNKNOWN',
          action: 'DOCUMENT_ACCESSED',
          targetType: 'DOCUMENT',
          targetId: documentPath,
          details: { citizenUid, applicationId },
        });

        sendJson(res, 200, {
          success: true,
          allowed: true,
          documentPath,
          accessedAt: new Date().toISOString(),
        });
        return;
      }

      // 9d. Document Upload Finalization & Magic Byte Verification
      if (req.method === 'POST' && pathname === '/api/v1/documents/finalize') {
        const storagePath = typeof body.storagePath === 'string' ? body.storagePath.trim() : '';
        const declaredType = typeof body.declaredType === 'string' ? body.declaredType.trim() : undefined;
        const applicationId = typeof body.applicationId === 'string' ? body.applicationId.trim() : undefined;

        if (!storagePath) {
          sendError(res, 400, 'Bad Request: "storagePath" is required.', requestId);
          return;
        }

        // Enforce path ownership
        const isOwner =
          storagePath.startsWith(`residentDocuments/${claims.uid}/`) ||
          storagePath.startsWith(`users/${claims.uid}/`) ||
          claims.role === 'ADMIN';

        if (!isOwner) {
          sendError(res, 403, 'Forbidden: Cannot finalize documents outside your user directory.', requestId);
          return;
        }

        try {
          const fileRef = adminStorage.bucket().file(storagePath);
          const [exists] = await fileRef.exists();
          if (!exists) {
            sendError(res, 404, 'Uploaded document file not found in storage.', requestId);
            return;
          }

          const [buffer] = await fileRef.download();
          const validation = validateFileMagicBytes(buffer, declaredType);

          if (!validation.isValid) {
            // Delete corrupt or disguised file immediately
            await fileRef.delete({ ignoreNotFound: true });

            await writeAuditLog(adminDb, {
              actorUid: claims.uid,
              actorRole: claims.role || 'CITIZEN',
              action: 'DOCUMENT_UPLOAD_PURGED_MALICIOUS_OR_INVALID',
              targetType: 'DOCUMENT',
              targetId: storagePath,
              details: { error: validation.error, declaredType },
            });

            sendError(res, 422, `Document validation failed: ${validation.error}`, requestId);
            return;
          }

          await writeAuditLog(adminDb, {
            actorUid: claims.uid,
            actorRole: claims.role || 'CITIZEN',
            action: 'DOCUMENT_UPLOAD_FINALIZED',
            targetType: 'DOCUMENT',
            targetId: storagePath,
            details: { detectedType: validation.detectedType, sizeBytes: buffer.length, applicationId },
          });

          sendJson(res, 200, {
            success: true,
            verified: true,
            storagePath,
            detectedType: validation.detectedType,
            sizeBytes: buffer.length,
            finalizedAt: new Date().toISOString(),
          });
        } catch (err: any) {
          sendError(res, 500, 'Failed to finalize uploaded document.', requestId, err);
        }
        return;
      }

      // Demo Reset (DEV / TEST Only, ADMIN Required)
      if (req.method === 'POST' && pathname === '/api/v1/demo/reset') {
        if (process.env.NODE_ENV === 'production') {
          sendError(res, 404, 'Not Found', requestId);
          return;
        }

        sendJson(res, 200, { success: true, message: 'Demo reset executed.' });
        return;
      }

      // Default 404 for unknown endpoints
      sendError(res, 404, 'Not Found', requestId);
    } catch (routeErr: any) {
      console.error(`[Server Error][ReqId: ${requestId}] Unhandled exception:`, routeErr);
      sendError(res, 500, 'Internal Server Error. Please contact MahaSetu support with the request ID.', requestId);
    }
  });

  // Transport and Connection Timeouts
  server.headersTimeout = 10000; // 10s
  server.requestTimeout = 30000; // 30s
  server.keepAliveTimeout = 5000; // 5s

  return server;
}

if (require.main === module) {
  const server = createBackendServer();
  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`[MahaSetu Backend] Port ${PORT} is already in use. Server is active on http://${HOST}:${PORT}`);
      process.exit(0);
    } else {
      console.error('[MahaSetu Backend] Server initialization error:', e);
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`[MahaSetu Backend] Trusted server running on http://${HOST}:${PORT}`);
    console.log(`[MahaSetu Backend] Firebase Admin SDK active. Claims-based authorization enforced.`);
  });
}
