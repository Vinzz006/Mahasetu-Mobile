import { db } from '../lib/firebase';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { NotificationItem, UserProfile } from '../types';

export const notificationService = {
  /**
   * Listen to user notifications realtime
   */
  subscribeToNotifications(user: UserProfile, callback: (notifications: NotificationItem[]) => void) {
    const nRef = collection(db, 'notifications');
    const q = query(nRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: NotificationItem[] = [];
        snapshot.forEach((snap) => {
          const d = snap.data();
          list.push({
            id: snap.id,
            userId: d.userId,
            applicationId: d.applicationId,
            applicationNumber: d.applicationNumber,
            type: d.type || 'VERIFICATION_UPDATE',
            title: d.title || 'MahaSetu Notice',
            message: d.message || '',
            channel: d.channel || 'IN_APP',
            status: d.status || 'SENT',
            twilioMessageSid: d.twilioMessageSid,
            read: !!d.read,
            createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            sentAt: d.sentAt?.toDate?.()?.toISOString() || d.sentAt,
          });
        });
        callback(list);
      },
      (error) => {
        console.warn('Notifications listener warning:', error.message);
        callback([]);
      }
    );
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const nRef = doc(db, 'notifications', notificationId);
      await updateDoc(nRef, { read: true });
    } catch (e) {
      console.warn('Could not mark notification as read:', e);
    }
  },
};
