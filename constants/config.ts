declare const __DEV__: boolean | undefined;

function isDevelopment(): boolean {
  if (typeof __DEV__ !== 'undefined') {
    return __DEV__;
  }
  return process.env.NODE_ENV !== 'production';
}

function resolveApiBaseUrl(): string {
  // 1. Explicit configured URL in .env
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }

  // 2. Auto-detect from Expo hostUri if running on physical device via Metro in dev
  if (isDevelopment()) {
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
    return 'http://localhost:8000';
  }

  throw new Error('EXPO_PUBLIC_API_BASE_URL environment variable must be set in production builds.');
}

function validateUrlSecurity(url: string): string {
  if (!isDevelopment()) {
    if (!url.startsWith('https://')) {
      throw new Error(
        `Insecure HTTP connection "${url}" is strictly prohibited in production builds. EXPO_PUBLIC_API_BASE_URL must use HTTPS.`
      );
    }
  }
  return url;
}

function getRequiredConfig(name: string, value: string | undefined): string {
  if (!value || value.startsWith('YOUR_') || value.includes('_here')) {
    if (!isDevelopment()) {
      throw new Error(
        `Missing required configuration variable "EXPO_PUBLIC_${name}". Placeholder credentials are not permitted in production.`
      );
    }
    return value || (name === 'FIREBASE_API_KEY' ? 'AIzaSyDummyDevKeyForTestingOnly00000' : `dev-${name.toLowerCase()}`);
  }
  return value;
}

const apiBaseUrl = validateUrlSecurity(resolveApiBaseUrl());

export interface AppConfig {
  FIREBASE_API_KEY: string;
  FIREBASE_AUTH_DOMAIN: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_STORAGE_BUCKET: string;
  FIREBASE_MESSAGING_SENDER_ID: string;
  FIREBASE_APP_ID: string;
  FIREBASE_MEASUREMENT_ID: string;
  API_BASE_URL: string;
  DEMO_MODE: boolean;
}

export const Config: AppConfig = {
  FIREBASE_API_KEY: getRequiredConfig('FIREBASE_API_KEY', process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  FIREBASE_AUTH_DOMAIN: getRequiredConfig('FIREBASE_AUTH_DOMAIN', process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
  FIREBASE_PROJECT_ID: getRequiredConfig('FIREBASE_PROJECT_ID', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
  FIREBASE_STORAGE_BUCKET: getRequiredConfig('FIREBASE_STORAGE_BUCKET', process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
  FIREBASE_MESSAGING_SENDER_ID: getRequiredConfig(
    'FIREBASE_MESSAGING_SENDER_ID',
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  ),
  FIREBASE_APP_ID: getRequiredConfig('FIREBASE_APP_ID', process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
  FIREBASE_MEASUREMENT_ID: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
  API_BASE_URL: apiBaseUrl,
  DEMO_MODE: process.env.EXPO_PUBLIC_DEMO_MODE === 'true',
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
