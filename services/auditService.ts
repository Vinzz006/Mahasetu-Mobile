import { db, sanitizeFirestorePayload, assertNoUndefinedValues } from '../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { AuditLogItem, UserRole } from '../types';

export const auditService = {
  /**
   * Records an immutable audit log entry in Cloud Firestore (append-only)
   */
  async logAction(entry: {
    actorUid: string;
    actorName: string;
    actorRole: UserRole;
    action: string;
    targetType: 'APPLICATION' | 'USER' | 'CONSENT' | 'VERIFICATION' | 'SYSTEM';
    targetId: string;
    details: string;
    ipAddress?: string;
  }): Promise<string> {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logRef = doc(db, 'auditLogs', id);

    const payload = sanitizeFirestorePayload({
      id,
      actorUid: entry.actorUid,
      actorName: entry.actorName,
      actorRole: entry.actorRole,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      details: entry.details,
      ipAddress: entry.ipAddress || '127.0.0.1',
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    assertNoUndefinedValues(payload, `auditLogs/${id}`);

    try {
      await setDoc(logRef, payload);
    } catch (err: any) {
      console.warn('Direct auditLog write failed (e.g. permission or offline):', err.message);
    }

    return id;
  },

  /**
   * Subscribe to real-time audit logs (read-only, for Auditor/Admin)
   */
  subscribeToAuditLogs(callback: (logs: AuditLogItem[]) => void, maxCount: number = 50) {
    const logsRef = collection(db, 'auditLogs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(maxCount));

    return onSnapshot(
      q,
      (snapshot) => {
        const logs: AuditLogItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          logs.push({
            id: docSnap.id,
            actorUid: data.actorUid || 'system',
            actorName: data.actorName || 'System',
            actorRole: data.actorRole || 'SYSTEM',
            action: data.action || 'UNKNOWN',
            targetType: data.targetType || 'SYSTEM',
            targetId: data.targetId || docSnap.id,
            details: data.details || '',
            ipAddress: data.ipAddress,
            timestamp: data.timestamp?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          });
        });
        callback(logs);
      },
      (error) => {
        console.warn('Audit logs realtime listener warning:', error.message);
        callback([]);
      }
    );
  },

  /**
   * Fetch audit logs once
   */
  async getAuditLogs(maxCount: number = 50): Promise<AuditLogItem[]> {
    try {
      const logsRef = collection(db, 'auditLogs');
      const q = query(logsRef, orderBy('timestamp', 'desc'), limit(maxCount));
      const snapshot = await getDocs(q);
      const logs: AuditLogItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        logs.push({
          id: docSnap.id,
          actorUid: data.actorUid || 'system',
          actorName: data.actorName || 'System',
          actorRole: data.actorRole || 'SYSTEM',
          action: data.action || 'UNKNOWN',
          targetType: data.targetType || 'SYSTEM',
          targetId: data.targetId || docSnap.id,
          details: data.details || '',
          ipAddress: data.ipAddress,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        });
      });
      return logs;
    } catch (e: any) {
      console.warn('getAuditLogs warning:', e.message);
      return [];
    }
  },
};
