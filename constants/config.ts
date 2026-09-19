function resolveApiBaseUrl(): string {
  // 1. If running in web browser, always connect to the same host on port 8000
  if (typeof window !== 'undefined' && (window as any)?.location?.hostname) {
    const host = (window as any).location.hostname;
    return `http://${host}:8000`;
  }

  // 2. Auto-detect from Expo hostUri if running on device via Metro
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

  // 3. Explicit configured URL in .env
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }

  return 'http://localhost:8000';
}

export const Config = {
  FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAj6AAYqX9EN8eLuJiRErVXd74xZgdsucc',
  FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'mahasetu-mobile-app.firebaseapp.com',
  FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'mahasetu-mobile-app',
  FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mahasetu-mobile-app.firebasestorage.app',
  FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '829459489988',
  FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:829459489988:web:b5c81579595f1f118ad591',
  FIREBASE_MEASUREMENT_ID: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-XPGC7JNSRF',
  get API_BASE_URL(): string {
    return resolveApiBaseUrl();
  },
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
  get apiBaseUrl(): string {
    return Config.API_BASE_URL;
  },
};
