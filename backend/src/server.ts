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
import { adminAuth, adminDb, FieldValue } from './lib/firebaseAdmin';
import { sanitizeFirestorePayload, assertNoUndefinedValues } from './lib/firestoreUtils';
import { twilioBackendService } from './notifications/twilio.service';
import { APPLICATION_EVENTS, getSmsMessage } from './notifications/events';
import { geminiService } from './services/gemini.service';

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
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of ipRateLimits.entries()) {
    if (now > v.resetTime) ipRateLimits.delete(k);
  }
  for (const [k, v] of uidRateLimits.entries()) {
    if (now > v.resetTime) uidRateLimits.delete(k);
  }
}, 5 * 60 * 1000).unref();

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
    };
  } catch (err: any) {
    // Signature invalid, expired, revoked, or malformed
    return null;
  }
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

      // ==========================================
      // 1. Submit Application (Approved Citizen Only)
      // ==========================================
      if (req.method === 'POST' && pathname === '/api/v1/applications') {
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;

        if (!checkRateLimit(claims.uid, uidRateLimits, 60, 60 * 1000)) {
          sendError(res, 429, 'Rate limit exceeded for your account.', requestId);
          return;
        }

        const roleUpper = (claims.role || '').toUpperCase();
        if (roleUpper !== 'CITIZEN') {
          sendError(res, 403, 'Forbidden: Only citizens may create applications.', requestId);
          return;
        }
        if (claims.status && claims.status !== 'APPROVED') {
          sendError(res, 403, 'Forbidden: Citizen account must be approved to create applications.', requestId);
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
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;

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
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;

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
        const txResult = await adminDb.runTransaction(async (transaction) => {
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
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;

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

        const txResult = await adminDb.runTransaction(async (transaction) => {
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
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;

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
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;

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
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;

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
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;

        try {
          // Strictly enforce authenticated UID as document owner
          body.userId = claims.uid;
          body.updatedAt = new Date().toISOString();
          if (!body.createdAt) {
            body.createdAt = new Date().toISOString();
          }

          // Citizens are NEVER permitted to self-certify identity via profile payload
          delete body.certificationStatus;
          delete body.certifiedBy;
          delete body.certifiedAt;
          delete body.isVerified;

          const sanitized = sanitizeFirestorePayload(body);
          await adminDb.collection('residentProfiles').doc(claims.uid).set(sanitized, { merge: true });

          sendJson(res, 200, {
            success: true,
            message: 'Government Resident Profile saved successfully',
            profile: sanitized,
          });
        } catch (err: any) {
          sendError(res, 500, 'Failed to save resident profile', requestId, err);
        }
        return;
      }

      // 7c. DELETE Passport Metadata
      if (req.method === 'DELETE' && pathname === '/api/v1/resident-profile/passport') {
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;

        try {
          await adminDb.collection('residentProfiles').doc(claims.uid).update({
            'passport.hasPassport': false,
            'passport.documentPath': null,
            'passport.fileName': null,
            'passport.fileSize': null,
            'passport.uploadedAt': null,
            updatedAt: new Date().toISOString(),
          });

          sendJson(res, 200, {
            success: true,
            message: 'Passport document metadata cleared successfully',
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
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;
        if (!requireRole(claims, ['ADMIN'], res, requestId)) return;

        const targetUid = approveMatch[1];
        if (targetUid === claims.uid) {
          sendError(res, 400, 'Forbidden: Self-approval or self-role assignment is prohibited.', requestId);
          return;
        }

        const role = typeof body.role === 'string' ? body.role.toUpperCase() : '';
        const allowedRoles = ['CITIZEN', 'DEPARTMENT_A', 'DEPARTMENT_B', 'DEPARTMENT_C', 'ADMIN', 'AUDITOR'];
        if (!allowedRoles.includes(role)) {
          sendError(res, 400, `Invalid role: must be one of ${allowedRoles.join(', ')}`, requestId);
          return;
        }

        const isDept = ['DEPARTMENT_A', 'DEPARTMENT_B', 'DEPARTMENT_C'].includes(role);
        const departmentId = isDept && typeof body.departmentId === 'string' ? body.departmentId.toUpperCase() : null;

        // Set signed custom claims
        await adminAuth.setCustomUserClaims(targetUid, {
          role,
          departmentId,
          status: 'APPROVED',
        });

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

        console.log(`[Admin Audit] Admin ${claims.uid} approved user ${targetUid} with role ${role} (dept: ${departmentId})`);
        sendJson(res, 200, { success: true, message: `User ${targetUid} approved with role ${role}.` });
        return;
      }

      // 8b. Admin User Rejection
      const rejectMatch = pathname.match(/^\/api\/v1\/admin\/user-approvals\/([^/]+)\/reject$/);
      if (req.method === 'POST' && rejectMatch) {
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;
        if (!requireRole(claims, ['ADMIN'], res, requestId)) return;

        const targetUid = rejectMatch[1];
        if (targetUid === claims.uid) {
          sendError(res, 400, 'Forbidden: Self-rejection is not allowed.', requestId);
          return;
        }

        const reason = typeof body.reason === 'string' && body.reason.trim()
          ? body.reason.trim().substring(0, 500)
          : 'Registration rejected by administrator';

        // Revoke claims
        await adminAuth.setCustomUserClaims(targetUid, {
          role: 'rejected',
          status: 'REJECTED',
        });

        // Update Firestore user document
        await adminDb.collection('users').doc(targetUid).set({
          status: 'REJECTED',
          isActive: false,
          rejectionReason: reason,
          rejectedBy: claims.uid,
          rejectedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`[Admin Audit] Admin ${claims.uid} rejected user ${targetUid}: ${reason}`);
        sendJson(res, 200, { success: true, message: `User ${targetUid} rejected.` });
        return;
      }

      // 8c. Admin Citizen Identity Certification
      const verifyCitizenMatch = pathname.match(/^\/api\/v1\/admin\/citizens\/([^/]+)\/verify$/);
      if (req.method === 'POST' && verifyCitizenMatch) {
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;
        if (!requireRole(claims, ['ADMIN'], res, requestId)) return;

        const targetUid = verifyCitizenMatch[1];
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

        console.log(`[Admin Audit] Admin ${claims.uid} set citizen ${targetUid} verification to ${isVerified}`);
        sendJson(res, 200, { success: true, isVerified });
        return;
      }

      // Twilio Health & Monitoring
      if (req.method === 'GET' && pathname === '/api/v1/admin/twilio/health') {
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;
        if (!requireRole(claims, ['ADMIN'], res, requestId)) return;

        const health = await twilioBackendService.getTwilioHealth();
        sendJson(res, 200, health);
        return;
      }

      // AI Chat Legacy Data Cleanup / Quarantine
      if (req.method === 'POST' && pathname === '/api/v1/ai/cleanup') {
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;
        if (!requireRole(claims, ['ADMIN'], res, requestId)) return;

        const cleanupResult = await geminiService.quarantineLegacyConversations();
        sendJson(res, 200, { success: true, ...cleanupResult });
        return;
      }

      // Demo Reset (DEV / TEST Only, ADMIN Required)
      if (req.method === 'POST' && pathname === '/api/v1/demo/reset') {
        if (process.env.NODE_ENV === 'production') {
          sendError(res, 404, 'Not Found', requestId);
          return;
        }
        const claims = await requireAuth(req, res, requestId);
        if (!claims) return;
        if (!requireRole(claims, ['ADMIN'], res, requestId)) return;

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
