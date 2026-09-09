import { api } from './api';
import { TwilioHealthStatus } from '../types';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

export interface SmsMetrics {
  smsSentToday: number;
  smsFailedToday: number;
  recentLogs: any[];
}

/**
 * Mobile-safe Twilio Monitoring Service
 * Zero credentials in bundle. NO Twilio Verify. NO OTP.
 * Communicates with trusted MahaSetu Backend and Firestore integrationLogs.
 */
export const twilioService = {
  /**
   * Admin: Get Twilio status and SMS notification metrics from trusted backend
   */
  async getTwilioHealth(): Promise<TwilioHealthStatus> {
    try {
      return await api.get<TwilioHealthStatus>('/api/v1/admin/twilio/health');
    } catch (err: any) {
      throw new Error(`Unable to load SMS telemetry: ${err.message || 'Backend unreachable'}`);
    }
  },

  /**
   * Real-time listener for SMS notifications recorded in integrationLogs
   * Dynamically tracks sent and failed counts for today with zero synthetic data.
   */
  subscribeToSmsMetrics(
    callback: (metrics: SmsMetrics) => void,
    onError?: (err: string) => void
  ): () => void {
    const logsRef = collection(db, 'integrationLogs');
    const q = query(logsRef, orderBy('createdAt', 'desc'), limit(50));

    return onSnapshot(
      q,
      (snapshot) => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        let smsSentToday = 0;
        let smsFailedToday = 0;
        const recentLogs: any[] = [];

        snapshot.forEach((d) => {
          const data = d.data();
          if (data.isDemo) return; // Exclude demo/test records

          const createdAtDate = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : data.createdAt
            ? new Date(data.createdAt)
            : null;
          const isToday = createdAtDate && createdAtDate >= startOfToday;

          if (isToday) {
            if (data.status === 'SENT') smsSentToday++;
            if (data.status === 'FAILED') smsFailedToday++;
          }

          recentLogs.push({
            id: d.id,
            recipient: data.phoneNumberMasked || '***',
            applicationNumber: data.applicationId || 'N/A',
            messageType: data.eventType || 'NOTIFICATION',
            status: data.status || 'SENT',
            timestamp: createdAtDate
              ? createdAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Just now',
            twilioSid: data.twilioMessageSid,
            errorReason: data.errorReason,
          });
        });

        callback({
          smsSentToday,
          smsFailedToday,
          recentLogs,
        });
      },
      (err) => {
        console.warn('integrationLogs realtime listener warning:', err.message);
        if (onError) onError(err.message);
        else {
          callback({
            smsSentToday: 0,
            smsFailedToday: 0,
            recentLogs: [],
          });
        }
      }
    );
  },
};
