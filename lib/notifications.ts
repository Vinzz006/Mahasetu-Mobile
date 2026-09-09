import { db } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';

export interface DevicePushRegistration {
  token: string;
  platform: 'ios' | 'android' | 'web';
  createdAt: any;
  updatedAt: any;
  isActive: boolean;
}

export const pushNotificationService = {
  /**
   * Register mobile push notification token under:
   * users/{uid}/devices/{deviceId}
   * Preserves privacy: device tokens are scoped exclusively to the user document.
   */
  async registerDeviceToken(uid: string, token: string): Promise<void> {
    if (!uid || !token) return;

    const deviceId = `device_${Platform.OS}_${token.substring(0, 12).replace(/[^a-zA-Z0-9]/g, '')}`;
    const deviceRef = doc(db, 'users', uid, 'devices', deviceId);

    try {
      await setDoc(
        deviceRef,
        {
          token,
          platform: Platform.OS as 'ios' | 'android' | 'web',
          isActive: true,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`Push token registered for user ${uid} on ${Platform.OS}`);
    } catch (e) {
      console.warn('Could not store push token in Firestore:', e);
    }
  },

  /**
   * Mock push notification generator for in-app demo testing
   */
  sendLocalDemoNotification(title: string, body: string) {
    console.log(`[Push Notification Displayed] ${title}: ${body}`);
  },
};
