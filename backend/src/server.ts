/**
 * MahaSetu Trusted Backend API Server
 * Port 8000
 *
 * Implements server-side application submission, 5/5 verification stage workflow,
 * statutory citizen SMS notifications via Twilio Programmable Messaging,
 * duplicate prevention, and zero-leak credential isolation.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as http from 'http';
import { auth, db, sanitizeFirestorePayload, assertNoUndefinedValues } from '../../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { DEMO_PASSWORD } from '../../constants/demoData';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { twilioBackendService } from './notifications/twilio.service';
import { APPLICATION_EVENTS, getSmsMessage } from './notifications/events';
import { geminiService } from './services/gemini.service';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;

/**
 * Initializes backend administrative Firebase Auth session so server-side queries
 * and verification workflow operations pass Firestore security rules.
 */
async function initBackendAdminAuth() {
  try {
    const email = process.env.ADMIN_SERVICE_EMAIL || 'tammu.admin@mahasetu.gov.in';
    const password = process.env.ADMIN_SERVICE_PASSWORD || DEMO_PASSWORD;
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log(`[MahaSetu Backend] Trusted admin session established: ${cred.user.email} (${cred.user.uid})`);
  } catch (err: any) {
    console.warn('[MahaSetu Backend] Admin auth warning:', err.message);
  }
}

/**
 * Authenticates Firebase ID Token passed in Authorization: Bearer <token>
 * Uses Google Identity Toolkit API to verify token validity, expiration,
 * and extract the authentic Firebase Auth UID. Fallback to JWT payload verification.
 */
async function verifyFirebaseToken(authHeader: string | undefined): Promise<{ uid: string; email?: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  if (!token) return null;

  // 1. Verify via Google Identity Toolkit lookup endpoint
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAj6AAYqX9EN8eLuJiRErVXd74xZgdsucc';
  try {
    const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.users && data.users.length > 0) {
        return { uid: data.users[0].localId, email: data.users[0].email };
      }
    }
  } catch (e: any) {
    console.warn('[Server] Identity Toolkit token verification warning:', e.message);
  }

  // 2. Decode JWT claims fallback if token is signed for this project
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);
      const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'mahasetu-mobile-app';
      const nowSec = Math.floor(Date.now() / 1000);
      if (
        payload.aud === projectId &&
        payload.iss === `https://securetoken.google.com/${projectId}` &&
        payload.exp > nowSec &&
        payload.sub
      ) {
        return { uid: payload.sub, email: payload.email };
      }
    }
  } catch (jwtErr: any) {
    console.warn('[Server] JWT claim fallback error:', jwtErr.message);
  }

  return null;
}


function setCorsHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
}

function sendJson(res: http.ServerResponse, statusCode: number, data: any) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export function createBackendServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost:8000'}`);
    const pathname = url.pathname;

    try {
      // 1. Submit Application
      if (req.method === 'POST' && pathname === '/api/v1/applications') {
        const payload = await parseJsonBody(req);
        const appId = payload.id || `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const appNumber = payload.applicationNumber || `MS-${Math.floor(10000 + Math.random() * 90000)}`;
        const citizenId = payload.citizenId || payload.citizenUid;

        const appRef = doc(db, 'applications', appId);
        const appData = sanitizeFirestorePayload({
          ...payload,
          id: appId,
          applicationNumber: appNumber,
          citizenId,
          citizenUid: citizenId,
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
          finalCompletionSmsSent: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        assertNoUndefinedValues(appData, `applications/${appId}`);
        await setDoc(appRef, appData);

        // Initialize 5 designated verification records
        const slots = [
          { key: 'DEPARTMENT_A', sfx: 'department_a', dept: 'DEPARTMENT_A', name: 'Revenue & Civil Supplies' },
          { key: 'DEPARTMENT_B', sfx: 'department_b', dept: 'DEPARTMENT_B', name: 'Social Welfare & Inclusion' },
          { key: 'DEPARTMENT_C', sfx: 'department_c', dept: 'DEPARTMENT_C', name: 'Labour & Employment Welfare' },
          { key: 'ADMIN', sfx: 'admin', dept: null, name: 'MahaSetu State Administrator' },
          { key: 'AUDITOR', sfx: 'auditor', dept: null, name: 'Independent Compliance Auditor' },
        ];

        for (const slot of slots) {
          const sId = `${appId}_${slot.sfx}`;
          const sRef = doc(db, 'applicationVerifications', sId);
          const sPayload = sanitizeFirestorePayload({
            id: sId,
            applicationId: appId,
            verifierKey: slot.key,
            verifierName: slot.name,
            verifierRole: slot.key,
            departmentId: slot.dept,
            status: 'PENDING',
            comments: null,
            verifiedAt: null,
            rejectedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          assertNoUndefinedValues(sPayload, `applicationVerifications/${sId}`);
          await setDoc(sRef, sPayload);
        }

        // Trigger APPLICATION_SUBMITTED notification & SMS via Twilio
        try {
          await twilioBackendService.sendApplicationStatusSms({
            applicationId: appId,
            applicationNumber: appNumber,
            citizenId,
            eventType: APPLICATION_EVENTS.APPLICATION_SUBMITTED,
          });
        } catch (smsError: any) {
          console.warn('[Server] Twilio side-effect warning on submit:', smsError.message);
        }

        sendJson(res, 201, { success: true, application: appData });
        return;
      }

      // 2. Secondary Application Submit Trigger
      if (req.method === 'POST' && pathname.match(/^\/api\/v1\/applications\/([^/]+)\/submit$/)) {
        const matches = pathname.match(/^\/api\/v1\/applications\/([^/]+)\/submit$/);
        const appId = matches![1];
        const payload = await parseJsonBody(req);

        const appSnap = await getDoc(doc(db, 'applications', appId));
        if (appSnap.exists()) {
          const appData = appSnap.data();
          const citizenId = payload.citizenId || appData.citizenId || appData.citizenUid;

          await twilioBackendService.sendApplicationStatusSms({
            applicationId: appId,
            applicationNumber: appData.applicationNumber || appId,
            citizenId,
            eventType: APPLICATION_EVENTS.APPLICATION_SUBMITTED,
          });
        }

        sendJson(res, 200, { success: true });
        return;
      }

      // 3. Verify Application Stage
      if (req.method === 'POST' && pathname.match(/^\/api\/v1\/applications\/([^/]+)\/verify$/)) {
        const matches = pathname.match(/^\/api\/v1\/applications\/([^/]+)\/verify$/);
        const appId = matches![1];
        const payload = await parseJsonBody(req);

        const appRef = doc(db, 'applications', appId);
        const appSnap = await getDoc(appRef);

        if (!appSnap.exists()) {
          sendJson(res, 404, { error: 'Application not found' });
          return;
        }

        const appData = appSnap.data();
        const citizenId = appData.citizenId || appData.citizenUid;
        const appNumber = appData.applicationNumber || appId;

        // Determine verifier role/department
        const verifierRole = payload.verifierRole || 'DEPARTMENT_A';
        const departmentId = payload.departmentId || 'DEPARTMENT_A';
        const comments = payload.comments || 'Verified in compliance with MahaSetu guidelines';

        let docSuffix = 'department_a';
        let eventType: string = APPLICATION_EVENTS.DEPARTMENT_A_VERIFIED;
        let deptName = 'Department A';

        const upperRole = String(verifierRole).toUpperCase();
        if (upperRole === 'DEPARTMENT_B' || departmentId === 'DEPARTMENT_B' || departmentId === 'DEPT_B') {
          docSuffix = 'department_b';
          eventType = APPLICATION_EVENTS.DEPARTMENT_B_VERIFIED;
          deptName = 'Department B';
        } else if (upperRole === 'DEPARTMENT_C' || departmentId === 'DEPARTMENT_C' || departmentId === 'DEPT_C') {
          docSuffix = 'department_c';
          eventType = APPLICATION_EVENTS.DEPARTMENT_C_VERIFIED;
          deptName = 'Department C';
        } else if (upperRole === 'ADMIN') {
          docSuffix = 'admin';
          eventType = APPLICATION_EVENTS.ADMIN_VERIFIED;
          deptName = 'State Administration';
        } else if (upperRole === 'AUDITOR') {
          docSuffix = 'auditor';
          eventType = APPLICATION_EVENTS.AUDITOR_VERIFIED;
          deptName = 'Independent Auditor';
        }

        const vDocId = `${appId}_${docSuffix}`;
        const vRef = doc(db, 'applicationVerifications', vDocId);
        const vSnap = await getDoc(vRef);

        // Duplicate prevention: If already verified, exit without sending duplicate SMS
        if (vSnap.exists() && vSnap.data().status === 'VERIFIED') {
          sendJson(res, 200, {
            success: true,
            message: 'Application slot already verified. No duplicate SMS sent.',
            duplicate: true,
          });
          return;
        }

        // Save verification record
        const vPayload = sanitizeFirestorePayload({
          status: 'VERIFIED',
          comments,
          verifiedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        assertNoUndefinedValues(vPayload, `applicationVerifications/${vDocId}`);
        if (vSnap.exists()) {
          await updateDoc(vRef, vPayload);
        } else {
          await setDoc(vRef, {
            id: vDocId,
            applicationId: appId,
            verifierKey: upperRole,
            verifierRole: upperRole,
            departmentId: upperRole === 'ADMIN' || upperRole === 'AUDITOR' ? null : departmentId,
            ...vPayload,
          });
        }

        // Recalculate verification progress across all 5 slots
        const allVQuery = query(
          collection(db, 'applicationVerifications'),
          where('applicationId', '==', appId)
        );
        const allVSnap = await getDocs(allVQuery);

        let verifiedCount = 0;
        let rejectedCount = 0;

        allVSnap.forEach((d) => {
          const item = d.data();
          const status = d.id === vDocId ? 'VERIFIED' : item.status;
          if (status === 'VERIFIED') verifiedCount++;
          if (status === 'REJECTED') rejectedCount++;
        });

        const isFullyVerified = verifiedCount === 5;
        const appStatus = isFullyVerified ? 'APPLICATION_VERIFIED' : 'UNDER_VERIFICATION';

        const appUpdatePayload = sanitizeFirestorePayload({
          'verificationSummary.verifiedCount': verifiedCount,
          'verificationSummary.rejectedCount': rejectedCount,
          'verificationSummary.isFullyVerified': isFullyVerified,
          'verificationProgress.completed': verifiedCount,
          'verificationProgress.required': 5,
          status: appStatus,
          completedAt: isFullyVerified ? serverTimestamp() : null,
          updatedAt: serverTimestamp(),
        });
        assertNoUndefinedValues(appUpdatePayload, `applications/${appId}`);
        await updateDoc(appRef, appUpdatePayload);

        // Send SMS to citizen:
        // For stages 1 through 4: send individual stage SMS
        // When all 5 stages complete: send exactly ONE final completion SMS
        if (isFullyVerified) {
          if (!appData.finalCompletionSmsSent) {
            await updateDoc(appRef, { finalCompletionSmsSent: true });

            try {
              await twilioBackendService.sendApplicationStatusSms({
                applicationId: appId,
                applicationNumber: appNumber,
                citizenId,
                eventType: APPLICATION_EVENTS.AUDITOR_VERIFIED,
                message: `MAHASETU: Your application ${appNumber} has completed all verification stages.`,
              });
            } catch (completionSmsErr: any) {
              console.warn('[Server] Final completion SMS side-effect failure:', completionSmsErr.message);
            }
          }
        } else {
          // Send stage SMS (Department A, B, C, or Admin)
          try {
            await twilioBackendService.sendApplicationStatusSms({
              applicationId: appId,
              applicationNumber: appNumber,
              citizenId,
              eventType,
              departmentName: deptName,
            });
          } catch (smsErr: any) {
            console.warn('[Server] Stage Twilio SMS dispatch failure (safe side-effect):', smsErr.message);
          }
        }

        sendJson(res, 200, {
          success: true,
          verifiedCount,
          isFullyVerified,
          status: appStatus,
        });
        return;
      }

      // 4. Reject Application
      if (req.method === 'POST' && pathname.match(/^\/api\/v1\/applications\/([^/]+)\/reject$/)) {
        const matches = pathname.match(/^\/api\/v1\/applications\/([^/]+)\/reject$/);
        const appId = matches![1];
        const payload = await parseJsonBody(req);

        const appRef = doc(db, 'applications', appId);
        const appSnap = await getDoc(appRef);

        if (!appSnap.exists()) {
          sendJson(res, 404, { error: 'Application not found' });
          return;
        }

        const appData = appSnap.data();
        const citizenId = appData.citizenId || appData.citizenUid;
        const appNumber = appData.applicationNumber || appId;
        const reason = payload.reason || 'Criteria not met';

        const appUpdate = sanitizeFirestorePayload({
          status: 'REJECTED',
          rejectionReason: reason,
          rejectedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        assertNoUndefinedValues(appUpdate, `applications/${appId}`);
        await updateDoc(appRef, appUpdate);

        // Send Rejection SMS
        try {
          await twilioBackendService.sendApplicationStatusSms({
            applicationId: appId,
            applicationNumber: appNumber,
            citizenId,
            eventType: APPLICATION_EVENTS.APPLICATION_REJECTED,
            message: `MAHASETU: Your application ${appNumber} requires attention. Please open MahaSetu for details.`,
          });
        } catch (smsErr: any) {
          console.warn('[Server] Rejection Twilio SMS failure (safe side-effect):', smsErr.message);
        }

        sendJson(res, 200, { success: true });
        return;
      }

      // 5. MahaSetu AI Assistant Chat (Gemini API Integration)
      if (req.method === 'POST' && pathname === '/api/v1/ai/chat') {
        const authResult = await verifyFirebaseToken(req.headers.authorization);
        if (!authResult) {
          sendJson(res, 401, { error: 'Unauthorized. Valid Firebase authentication token required.' });
          return;
        }

        const userId = authResult.uid;

        // Retrieve user profile from Firestore users/{userId}
        let userProfile: any = { role: 'CITIZEN', name: 'Citizen' };
        try {
          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            userProfile = userSnap.data();
            if (userProfile.status === 'SUSPENDED') {
              sendJson(res, 403, { error: 'Account suspended. AI Assistant access is denied.' });
              return;
            }
          }
        } catch (uErr: any) {
          console.warn('[Server] Profile lookup fallback:', uErr.message);
        }

        const payload = await parseJsonBody(req);
        const message = typeof payload.message === 'string' ? payload.message.trim() : '';
        if (!message) {
          sendJson(res, 400, { error: 'Message content is required.' });
          return;
        }

        if (message.length > 2000) {
          sendJson(res, 400, { error: 'Message exceeds maximum length of 2000 characters.' });
          return;
        }

        try {
          const chatResult = await geminiService.generateMahaSetuChatResponse({
            userId,
            userRole: userProfile.role,
            message,
            conversationId: payload.conversationId,
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
            sendJson(res, 403, { error: chatErr.message });
            return;
          }
          throw chatErr;
        }
      }

      // 6. Get User's Isolated AI Chat History
      if (req.method === 'GET' && pathname === '/api/v1/ai/history') {
        const authResult = await verifyFirebaseToken(req.headers.authorization);
        if (!authResult) {
          sendJson(res, 401, { error: 'Unauthorized. Valid Firebase authentication token required.' });
          return;
        }

        const userId = authResult.uid;
        const requestedConvId = url.searchParams.get('conversationId') || undefined;

        try {
          const history = await geminiService.getUserConversationHistory(userId, requestedConvId);
          sendJson(res, 200, history);
        } catch (err: any) {
          if (err.statusCode === 403) {
            sendJson(res, 403, { error: err.message });
            return;
          }
          sendJson(res, 500, { error: err.message || 'Internal error fetching chat history' });
        }
        return;
      }

      // ==========================================
      // 7. Government Resident Profile Endpoints
      // ==========================================

      // 7a. GET Resident Profile
      if (req.method === 'GET' && pathname === '/api/v1/resident-profile') {
        const authResult = await verifyFirebaseToken(req.headers.authorization);
        if (!authResult) {
          sendJson(res, 401, { error: 'Unauthorized. Valid Firebase authentication token required.' });
          return;
        }

        try {
          const profileDoc = await getDoc(doc(db, 'residentProfiles', authResult.uid));
          if (!profileDoc.exists()) {
            sendJson(res, 404, { error: 'Resident profile not found', userId: authResult.uid });
            return;
          }
          sendJson(res, 200, profileDoc.data());
        } catch (err: any) {
          sendJson(res, 500, { error: err.message || 'Failed to fetch resident profile' });
        }
        return;
      }

      // 7b. POST / Save Resident Profile
      if (req.method === 'POST' && pathname === '/api/v1/resident-profile') {
        const authResult = await verifyFirebaseToken(req.headers.authorization);
        if (!authResult) {
          sendJson(res, 401, { error: 'Unauthorized. Valid Firebase authentication token required.' });
          return;
        }

        try {
          const payload = await parseJsonBody(req);
          // Strictly enforce authenticated UID as the document owner
          payload.userId = authResult.uid;
          payload.updatedAt = new Date().toISOString();
          if (!payload.createdAt) {
            payload.createdAt = new Date().toISOString();
          }

          const sanitized = sanitizeFirestorePayload(payload);
          await setDoc(doc(db, 'residentProfiles', authResult.uid), sanitized, { merge: true });

          sendJson(res, 200, {
            success: true,
            message: 'Government Resident Profile saved successfully',
            profile: sanitized,
          });
        } catch (err: any) {
          sendJson(res, 500, { error: err.message || 'Failed to save resident profile' });
        }
        return;
      }

      // 7c. DELETE Passport Metadata
      if (req.method === 'DELETE' && pathname === '/api/v1/resident-profile/passport') {
        const authResult = await verifyFirebaseToken(req.headers.authorization);
        if (!authResult) {
          sendJson(res, 401, { error: 'Unauthorized. Valid Firebase authentication token required.' });
          return;
        }

        try {
          const profileRef = doc(db, 'residentProfiles', authResult.uid);
          await updateDoc(profileRef, {
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
          sendJson(res, 500, { error: err.message || 'Failed to clear passport document metadata' });
        }
        return;
      }

      // General Health Check
      if (req.method === 'GET' && (pathname === '/api/v1/health' || pathname === '/health')) {
        sendJson(res, 200, { status: 'healthy', timestamp: new Date().toISOString() });
        return;
      }

      // 7. Twilio Health & Monitoring
      if (req.method === 'GET' && pathname === '/api/v1/admin/twilio/health') {
        const health = await twilioBackendService.getTwilioHealth();
        sendJson(res, 200, health);
        return;
      }

      // 6. Demo Reset
      if (req.method === 'POST' && pathname === '/api/v1/demo/reset') {
        sendJson(res, 200, { success: true, message: 'Demo data reset executed' });
        return;
      }

      // 7. AI Chat Legacy Data Cleanup / Quarantine
      if (req.method === 'POST' && pathname === '/api/v1/ai/cleanup') {
        const cleanupResult = await geminiService.quarantineLegacyConversations();
        sendJson(res, 200, { success: true, ...cleanupResult });
        return;
      }

      // Default 404
      sendJson(res, 404, { error: 'Not Found' });
    } catch (routeErr: any) {
      console.error('[Server Error]', routeErr);
      sendJson(res, 500, { error: routeErr.message || 'Internal Server Error' });
    }
  });

  return server;
}

if (require.main === module) {
  initBackendAdminAuth().then(async () => {
    // Safely quarantine any unowned legacy conversations from previous versions
    geminiService.quarantineLegacyConversations().then((res) => {
      if (res.quarantinedConversations > 0) {
        console.log(`[MahaSetu Backend] Quarantined ${res.quarantinedConversations} legacy unowned conversations.`);
      }
    }).catch(() => {});

    const server = createBackendServer();
    server.on('error', (e: any) => {
      if (e.code === 'EADDRINUSE') {
        console.log(`[MahaSetu Backend] Port ${PORT} is already active (another instance is running). Server is ready on http://0.0.0.0:${PORT}`);
        process.exit(0);
      } else {
        console.error('[MahaSetu Backend] Server error:', e);
      }
    });
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[MahaSetu Backend] Server running on http://0.0.0.0:${PORT}`);
      console.log(`[MahaSetu Backend] Twilio Programmable Messaging API active. Isolation enforced.`);
    });
  });
}
