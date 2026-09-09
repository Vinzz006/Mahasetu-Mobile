/**
 * Twilio Programmable Messaging Service (Server-Side Backend Only)
 * MahaSetu Interoperability Platform
 *
 * Strictly isolates Twilio Messaging credentials to backend.
 * NO Twilio Verify. NO Twilio OTP. NO phone verification.
 * Dedicated solely to Application Status & Verification Notifications.
 */

import { db, sanitizeFirestorePayload, assertNoUndefinedValues } from '../../../lib/firebase';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { APPLICATION_EVENTS, ApplicationEventType, getSmsMessage, getInAppNotificationDetails } from './events';

export interface SendStatusSmsParams {
  applicationId: string;
  applicationNumber: string;
  citizenId: string;
  eventType: ApplicationEventType | string;
  message?: string;
  departmentName?: string;
}

export interface SmsResult {
  success: boolean;
  sid?: string;
  skipped?: boolean;
  error?: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
}

/**
 * Normalizes phone numbers to standard E.164 format (+91 for Indian numbers)
 */
export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.trim().replace(/[\s-]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = `+91${cleaned}`;
    } else {
      cleaned = `+${cleaned}`;
    }
  }
  return cleaned;
}

/**
 * Masks phone numbers for audit compliance (e.g. +9198******10)
 * Never stores or logs raw phone numbers or credentials in audit logs.
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 6) return '***';
  const clean = phone.trim();
  const prefix = clean.substring(0, Math.min(5, clean.length - 2));
  const suffix = clean.substring(clean.length - 2);
  const stars = '*'.repeat(Math.max(3, clean.length - prefix.length - suffix.length));
  return `${prefix}${stars}${suffix}`;
}

export class TwilioMessagingService {
  /**
   * Retrieves backend Twilio configuration
   */
  private getConfig() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const enabled = process.env.TWILIO_ENABLED === 'true';

    return {
      accountSid,
      authToken,
      messagingServiceSid,
      enabled,
      isConfigured: !!(accountSid && authToken && messagingServiceSid),
    };
  }

  /**
   * Sends an application status SMS to the citizen's registered mobile number
   * using Twilio Programmable Messaging API.
   *
   * 1. Loads the citizen's phoneNumber from Firestore users/{citizenId}.
   * 2. Validates that a phone number exists.
   * 3. Sends SMS through the Twilio Messaging Service (if TWILIO_ENABLED=true).
   * 4. Returns the Twilio message SID.
   * 5. Logs success/failure safely in integrationLogs.
   * 6. Creates a corresponding in-app notification in Firestore.
   * 7. Never exposes Twilio credentials.
   */
  async sendApplicationStatusSms(params: SendStatusSmsParams): Promise<SmsResult> {
    const { applicationId, applicationNumber, citizenId, eventType } = params;
    const message = params.message || getSmsMessage(eventType, applicationNumber);
    const config = this.getConfig();

    // 1. Load citizen's phoneNumber from Firestore
    let citizenPhone: string | null = null;
    let citizenName = 'Citizen';

    try {
      const userRef = doc(db, 'users', citizenId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        citizenPhone = userData.phoneNumber || userData.phone || null;
        citizenName = userData.name || userData.displayName || citizenName;
      }
    } catch (err: any) {
      console.warn(`[TwilioService] Warning loading user profile for ${citizenId}:`, err.message);
    }

    // 2. Validate that a phone number exists
    if (!citizenPhone || !citizenPhone.trim()) {
      const warningMsg = `[TwilioService] Safe Notice: Citizen ${citizenId} has no registered phone number. Skipping SMS for ${applicationNumber}.`;
      console.warn(warningMsg);

      // Record safe skipped audit entry
      await this.recordAuditLog({
        applicationId,
        citizenId,
        eventType,
        phoneNumberMasked: 'N/A',
        twilioMessageSid: null,
        status: 'SKIPPED',
        errorReason: 'No registered mobile phone number in citizen profile',
      });

      // Still create in-app notification (SMS is an additional channel)
      await this.createInAppNotification({
        citizenId,
        applicationId,
        applicationNumber,
        eventType,
        smsStatus: 'SKIPPED',
        extra: { departmentName: params.departmentName },
      });

      return {
        success: true,
        skipped: true,
        status: 'SKIPPED',
        error: 'No phone number registered',
      };
    }

    const normalizedPhone = normalizePhoneNumber(citizenPhone);
    const maskedPhone = maskPhoneNumber(normalizedPhone);

    // 3. Dispatch SMS through Twilio Programmable Messaging API
    let twilioSid: string | null = null;
    let dispatchStatus: 'SENT' | 'FAILED' = 'SENT';
    let errorMessage: string | null = null;

    if (config.enabled) {
      // Real Twilio API Call (Server-side only)
      if (!config.isConfigured) {
        console.error('[TwilioService] Real dispatch failed: Twilio credentials not configured in backend.');
        dispatchStatus = 'FAILED';
        errorMessage = 'Twilio credentials not configured';
      } else {
        try {
          const authString = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
          const bodyData = new URLSearchParams({
            To: normalizedPhone,
            MessagingServiceSid: config.messagingServiceSid!,
            Body: message,
          });

          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                Authorization: `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: bodyData.toString(),
            }
          );

          const result = await response.json();

          if (response.ok && result.sid) {
            twilioSid = result.sid;
            dispatchStatus = 'SENT';
            console.log(`[TwilioService] SMS successfully dispatched via Twilio Messaging SID: ${twilioSid} to ${maskedPhone}`);
          } else {
            dispatchStatus = 'FAILED';
            errorMessage = result.message || `Twilio error code ${result.code || response.status}`;
            console.warn(`[TwilioService] Twilio delivery rejected (${maskedPhone}):`, errorMessage);
          }
        } catch (callError: any) {
          dispatchStatus = 'FAILED';
          errorMessage = callError.message || 'Twilio network timeout';
          console.warn(`[TwilioService] Twilio call failed (${maskedPhone}):`, errorMessage);
        }
      }
    } else {
      // Demo Mode (TWILIO_ENABLED=false)
      // Generates simulated Twilio Message SID for testing while logging clearly
      twilioSid = `SM_sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      dispatchStatus = 'SENT';
      console.log(`[TwilioService] [DEMO_MODE TWILIO_ENABLED=false] Simulated SMS to ${maskedPhone} [${eventType}]: "${message}"`);
    }

    // 4. Record SMS delivery attempt in integrationLogs
    await this.recordAuditLog({
      applicationId,
      citizenId,
      eventType,
      phoneNumberMasked: maskedPhone,
      twilioMessageSid: twilioSid,
      status: dispatchStatus,
      errorReason: errorMessage,
    });

    // 5. Create in-app notification in Firestore
    await this.createInAppNotification({
      citizenId,
      applicationId,
      applicationNumber,
      eventType,
      smsStatus: dispatchStatus,
      twilioMessageSid: twilioSid,
      extra: { departmentName: params.departmentName },
    });

    return {
      success: dispatchStatus === 'SENT',
      sid: twilioSid || undefined,
      status: dispatchStatus,
      error: errorMessage || undefined,
    };
  }

  /**
   * Persists SMS delivery attempt to integrationLogs (audit log)
   * Strictly avoids storing sensitive credentials.
   */
  private async recordAuditLog(log: {
    applicationId: string;
    citizenId: string;
    eventType: string;
    phoneNumberMasked: string;
    twilioMessageSid: string | null;
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    errorReason?: string | null;
  }) {
    try {
      const logId = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const logRef = doc(db, 'integrationLogs', logId);

      const payload = sanitizeFirestorePayload({
        id: logId,
        applicationId: log.applicationId,
        citizenId: log.citizenId,
        eventType: log.eventType,
        phoneNumberMasked: log.phoneNumberMasked,
        twilioMessageSid: log.twilioMessageSid,
        status: log.status,
        errorReason: log.errorReason || null,
        createdAt: serverTimestamp(),
      });

      assertNoUndefinedValues(payload, `integrationLogs/${logId}`);
      await setDoc(logRef, payload);
    } catch (err: any) {
      console.warn('[TwilioService] Warning saving integration audit log:', err.message);
    }
  }

  /**
   * Creates an in-app notification in the notifications collection
   */
  private async createInAppNotification(opts: {
    citizenId: string;
    applicationId: string;
    applicationNumber: string;
    eventType: string;
    smsStatus: 'SENT' | 'FAILED' | 'SKIPPED';
    twilioMessageSid?: string | null;
    extra?: { departmentName?: string; reason?: string };
  }) {
    try {
      const { title, message } = getInAppNotificationDetails(opts.eventType, opts.applicationNumber, opts.extra);
      const notifRef = doc(collection(db, 'notifications'));

      const payload = sanitizeFirestorePayload({
        userId: opts.citizenId,
        applicationId: opts.applicationId,
        applicationNumber: opts.applicationNumber,
        type: opts.eventType,
        title,
        message,
        channel: 'SMS',
        status: opts.smsStatus === 'SENT' ? 'SENT' : 'PENDING',
        smsStatus: opts.smsStatus,
        twilioMessageSid: opts.twilioMessageSid || null,
        read: false,
        createdAt: serverTimestamp(),
      });

      assertNoUndefinedValues(payload, 'notifications');
      await setDoc(notifRef, payload);
    } catch (err: any) {
      console.warn('[TwilioService] Warning creating in-app notification:', err.message);
    }
  }

  /**
   * Admin Health Endpoint: Get Twilio status and Programmable Messaging metrics
   */
  async getTwilioHealth() {
    const config = this.getConfig();

    let smsSentToday = 0;
    let smsFailedToday = 0;
    const recentLogs: any[] = [];

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    try {
      const logsRef = collection(db, 'integrationLogs');
      const q = query(logsRef, orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);

      snap.forEach((d) => {
        const data = d.data();
        if (data.isDemo === true || data.recordType === 'DEMO') return;
        const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
        const isToday = createdAtDate && createdAtDate >= startOfToday;

        if (isToday) {
          if (data.status === 'SENT') smsSentToday++;
          if (data.status === 'FAILED') smsFailedToday++;
        }

        recentLogs.push({
          id: d.id,
          recipient: data.phoneNumberMasked || '***',
          applicationNumber: data.applicationId,
          messageType: data.eventType,
          status: data.status,
          timestamp: createdAtDate ? createdAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
          twilioSid: data.twilioMessageSid,
          errorReason: data.errorReason,
        });
      });
    } catch (err: any) {
      console.warn('[TwilioService] Health lookup info:', err.message);
    }

    return {
      enabled: config.enabled,
      connected: config.isConfigured || !config.enabled,
      messagingServiceConfigured: !!config.messagingServiceSid,
      verifyServiceConfigured: false, // Twilio Verify is intentionally not used
      smsSentToday,
      smsFailedToday,
      recentLogs,
    };
  }
}

export const twilioBackendService = new TwilioMessagingService();
