/**
 * Twilio Programmable Messaging Service (Server-Side Backend Only)
 * MahaSetu Interoperability Platform
 *
 * Strictly isolates Twilio Messaging credentials to backend.
 * NO Twilio Verify. NO Twilio OTP. NO phone verification.
 * Dedicated solely to Application Status & Verification Notifications.
 */

import { adminDb, FieldValue } from '../lib/firebaseAdmin';
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
 * Normalizes and strictly validates phone numbers to Indian E.164 format (+91XXXXXXXXXX)
 */
export function normalizePhoneNumber(phone: string): { valid: boolean; normalized?: string; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required.' };
  }
  let cleaned = phone.trim().replace(/[\s-]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = `+91${cleaned}`;
    } else {
      cleaned = `+${cleaned}`;
    }
  }

  // India E.164 allowlist: +91 followed by digits starting with 6, 7, 8, or 9 and 9 subsequent digits
  const indiaRegex = /^\+91[6-9]\d{9}$/;
  if (!indiaRegex.test(cleaned)) {
    return {
      valid: false,
      error: 'Invalid phone number format. Only Indian mobile numbers (+91XXXXXXXXXX) are permitted.',
    };
  }
  return { valid: true, normalized: cleaned };
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

// In-memory sliding-window SMS rate limiter per citizen (cap at 10/hour)
class SmsRateLimiter {
  private history = new Map<string, number[]>();

  isAllowed(citizenId: string, limitPerHour: number = 10): boolean {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const timestamps = (this.history.get(citizenId) || []).filter((t) => now - t < oneHourMs);
    if (timestamps.length >= limitPerHour) {
      return false;
    }
    timestamps.push(now);
    this.history.set(citizenId, timestamps);
    return true;
  }
}

const smsRateLimiter = new SmsRateLimiter();

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
   */
  async sendApplicationStatusSms(params: SendStatusSmsParams): Promise<SmsResult> {
    const { applicationId, citizenId, eventType } = params;
    // Strip non-alphanumeric characters from applicationNumber to prevent smishing injection
    const cleanAppNumber = (params.applicationNumber || applicationId).replace(/[^a-zA-Z0-9-]/g, '');
    const message = params.message || getSmsMessage(eventType, cleanAppNumber);
    const config = this.getConfig();

    // 1. Enforce per-citizen SMS cap (10/hour)
    if (!smsRateLimiter.isAllowed(citizenId, 10)) {
      console.warn(`[TwilioService] Rate limit exceeded: Citizen ${citizenId} has reached maximum 10 SMS/hour cap.`);
      return {
        success: false,
        skipped: true,
        status: 'SKIPPED',
        error: 'Citizen hourly SMS rate limit reached (max 10/hour).',
      };
    }

    // 2. Load citizen's phoneNumber from Firestore users collection via Admin SDK
    let citizenPhone: string | null = null;
    let citizenName = 'Citizen';

    try {
      const userDoc = await adminDb.collection('users').doc(citizenId).get();
      if (userDoc.exists) {
        const userData = userDoc.data() || {};
        citizenPhone = userData.phoneNumber || userData.phone || null;
        citizenName = userData.name || userData.displayName || citizenName;
      }
    } catch (err: any) {
      console.warn(`[TwilioService] Warning loading user profile for ${citizenId}:`, err.message);
    }

    // 3. Validate that a phone number exists and passes Indian E.164 allowlist
    if (!citizenPhone || !citizenPhone.trim()) {
      const warningMsg = `[TwilioService] Citizen ${citizenId} has no registered phone number. Skipping SMS for ${cleanAppNumber}.`;
      console.warn(warningMsg);

      await this.recordAuditLog({
        applicationId,
        citizenId,
        eventType,
        phoneNumberMasked: 'N/A',
        twilioMessageSid: null,
        status: 'SKIPPED',
        errorReason: 'No registered mobile phone number in citizen profile',
      });

      await this.createInAppNotification({
        citizenId,
        applicationId,
        applicationNumber: cleanAppNumber,
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

    const phoneValidation = normalizePhoneNumber(citizenPhone);
    if (!phoneValidation.valid || !phoneValidation.normalized) {
      console.warn(`[TwilioService] Rejected non-compliant phone number for ${citizenId}: ${phoneValidation.error}`);
      await this.recordAuditLog({
        applicationId,
        citizenId,
        eventType,
        phoneNumberMasked: maskPhoneNumber(citizenPhone),
        twilioMessageSid: null,
        status: 'FAILED',
        errorReason: phoneValidation.error,
      });
      return {
        success: false,
        status: 'FAILED',
        error: phoneValidation.error,
      };
    }

    const normalizedPhone = phoneValidation.normalized;
    const maskedPhone = maskPhoneNumber(normalizedPhone);

    // 4. Dispatch SMS through Twilio Programmable Messaging API
    let twilioSid: string | null = null;
    let dispatchStatus: 'SENT' | 'FAILED' = 'SENT';
    let errorMessage: string | null = null;

    if (config.enabled) {
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

          // Timeout after 10 seconds via AbortSignal.timeout
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                Authorization: `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: bodyData.toString(),
              signal: AbortSignal.timeout(10_000),
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
          errorMessage = callError.name === 'TimeoutError' ? 'Twilio network request timed out (10s limit)' : callError.message;
          console.warn(`[TwilioService] Twilio call failed (${maskedPhone}):`, errorMessage);
        }
      }
    } else {
      // Demo Mode (TWILIO_ENABLED=false)
      twilioSid = `SM_sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      dispatchStatus = 'SENT';
      console.log(`[TwilioService] [DEMO_MODE TWILIO_ENABLED=false] Simulated SMS to ${maskedPhone} [${eventType}]: "${message}"`);
    }

    // 5. Record SMS delivery attempt in integrationLogs via Admin SDK
    await this.recordAuditLog({
      applicationId,
      citizenId,
      eventType,
      phoneNumberMasked: maskedPhone,
      twilioMessageSid: twilioSid,
      status: dispatchStatus,
      errorReason: errorMessage,
    });

    // 6. Create in-app notification via Admin SDK
    await this.createInAppNotification({
      citizenId,
      applicationId,
      applicationNumber: cleanAppNumber,
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
      await adminDb.collection('integrationLogs').doc(logId).set({
        id: logId,
        applicationId: log.applicationId,
        citizenId: log.citizenId,
        eventType: log.eventType,
        phoneNumberMasked: log.phoneNumberMasked,
        twilioMessageSid: log.twilioMessageSid,
        status: log.status,
        errorReason: log.errorReason || null,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err: any) {
      console.warn('[TwilioService] Warning saving integration audit log:', err.message);
    }
  }

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
      await adminDb.collection('notifications').add({
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
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err: any) {
      console.warn('[TwilioService] Warning creating in-app notification:', err.message);
    }
  }

  async getTwilioHealth() {
    const config = this.getConfig();

    let smsSentToday = 0;
    let smsFailedToday = 0;
    const recentLogs: any[] = [];

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    try {
      const snap = await adminDb.collection('integrationLogs')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      snap.forEach((d: any) => {
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
      verifyServiceConfigured: false,
      smsSentToday,
      smsFailedToday,
      recentLogs,
    };
  }
}

export const twilioBackendService = new TwilioMessagingService();
