import { app } from './firebase';

let appCheckInstance: any = null;

/**
 * Initializes App Check for Web / Mobile environments.
 */
export function initClientAppCheck(): any {
  if (appCheckInstance) return appCheckInstance;

  try {
    const { initializeAppCheck, ReCaptchaV3Provider, CustomProvider } = require('firebase/app-check');
    const appCheckKey = process.env.EXPO_PUBLIC_APP_CHECK_KEY;

    if (typeof window !== 'undefined' && appCheckKey) {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else if (process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN || (typeof __DEV__ !== 'undefined' && __DEV__)) {
      // In development mode or when debug token is provided, configure custom debug provider
      const debugToken = process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN || 'true';
      if (typeof window !== 'undefined') {
        (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === 'true' ? true : debugToken;
      }
      appCheckInstance = initializeAppCheck(app, {
        provider: new CustomProvider({
          getToken: async () => ({
            token: typeof debugToken === 'string' && debugToken !== 'true' ? debugToken : 'debug-token',
            expireTimeMillis: Date.now() + 60 * 60 * 1000,
          }),
        }),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (err: any) {
    // Graceful fallback if app-check is unavailable or already initialized
    console.warn('[AppCheck] Client initialization notice:', err?.message || err);
  }

  return appCheckInstance;
}

/**
 * Retrieves the current Firebase App Check token for client API requests.
 */
export async function getAppCheckToken(forceRefresh = false): Promise<string | null> {
  try {
    const instance = initClientAppCheck();
    if (!instance) return null;

    const { getToken } = require('firebase/app-check');
    const result = await getToken(instance, forceRefresh);
    return result?.token || null;
  } catch (err) {
    return null;
  }
}
