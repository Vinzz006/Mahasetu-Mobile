function resolveApiBaseUrl(): string {
  // 1. Auto-detect from Expo hostUri if running on device via Metro
  try {
    const Constants = require('expo-constants')?.default || require('expo-constants');
    const hostUri =
      Constants?.expoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoGo?.debuggerHost ||
      Constants?.manifest?.debuggerHost;
    if (hostUri) {
      const hostIp = hostUri.split(':')[0];
      if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
        return `http://${hostIp}:8000`;
      }
    }
  } catch {}

  // 2. Explicit configured URL in .env
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }

  return 'http://localhost:8000';
}

export const Config = {
  FIREBASE_API_KEY:
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'YOUR_FIREBASE_API_KEY',

FIREBASE_AUTH_DOMAIN:
  process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'YOUR_FIREBASE_AUTH_DOMAIN',

FIREBASE_PROJECT_ID:
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'YOUR_FIREBASE_PROJECT_ID',

FIREBASE_STORAGE_BUCKET:
  process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'YOUR_FIREBASE_STORAGE_BUCKET',

FIREBASE_MESSAGING_SENDER_ID:
  process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_FIREBASE_MESSAGING_SENDER_ID',

FIREBASE_APP_ID:
  process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 'YOUR_FIREBASE_APP_ID',

FIREBASE_MEASUREMENT_ID:
  process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || 'YOUR_FIREBASE_MEASUREMENT_ID',
};

export const config = {
  firebase: {
    apiKey: Config.FIREBASE_API_KEY,
    authDomain: Config.FIREBASE_AUTH_DOMAIN,
    projectId: Config.FIREBASE_PROJECT_ID,
    storageBucket: Config.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: Config.FIREBASE_MESSAGING_SENDER_ID,
    appId: Config.FIREBASE_APP_ID,
    measurementId: Config.FIREBASE_MEASUREMENT_ID,
  },
  apiBaseUrl: Config.API_BASE_URL,
  demoMode: Config.DEMO_MODE,
};
