import { router } from 'expo-router';
import { UserProfile } from '../types';

export const DeepLinkGuard = {
  /**
   * Safe deep link handler enforcing strict RBAC
   * mahasetu://application/MS-10001
   * mahasetu://consent/c-101
   */
  handleDeepLink(url: string, currentUser: UserProfile | null) {
    if (!currentUser) {
      router.replace('/(auth)/login');
      return;
    }

    if (currentUser.status === 'PENDING' || currentUser.role === 'pending' || !currentUser.role) {
      router.replace('/(pending)');
      return;
    }

    try {
      const cleanUrl = url.replace('mahasetu://', '');
      const parts = cleanUrl.split('/');
      const resourceType = parts[0];
      const resourceId = parts[1];

      // Prevent unauthorized cross-role deep link attacks
      if (resourceType === 'admin') {
        if (currentUser.role !== 'admin') {
          console.warn('Blocked unauthorized deep link attempt to /admin');
          return;
        }
        router.push('/(admin)/(tabs)');
        return;
      }

      if (resourceType === 'auditor') {
        if (currentUser.role !== 'auditor') {
          console.warn('Blocked unauthorized deep link attempt to /auditor');
          return;
        }
        router.push('/(auditor)/(tabs)');
        return;
      }

      if (resourceType === 'department') {
        if (currentUser.role !== 'department_officer') {
          console.warn('Blocked unauthorized deep link attempt to /department');
          return;
        }
        router.push('/(department)/(tabs)');
        return;
      }

      const roleUpper = String(currentUser.role || '').toUpperCase();
      if (resourceType === 'application' && resourceId) {
        if (roleUpper === 'CITIZEN') {
          router.push(`/(citizen)/application/${resourceId}`);
        } else if (roleUpper.startsWith('DEPARTMENT') || roleUpper === 'DEPARTMENT_OFFICER') {
          router.push(`/(department)/review/${resourceId}`);
        } else if (roleUpper === 'AUDITOR') {
          router.push(`/(auditor)/review/${resourceId}`);
        } else if (roleUpper === 'ADMIN') {
          router.push('/(admin)/(tabs)/applications');
        }
        return;
      }

      if (resourceType === 'consent') {
        if (roleUpper === 'CITIZEN') {
          router.push('/(citizen)/(tabs)/consent');
        }
        return;
      }
    } catch (err) {
      console.warn('Invalid deep link format:', err);
    }
  },
};
