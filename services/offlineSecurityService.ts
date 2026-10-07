/**
 * MahaSetu Secure Offline Storage & Queue Management Service
 *
 * Implements:
 * 1. User-isolated storage keys (`@mahasetu:user_${uid}:${key}`)
 * 2. Automatic PII redaction (Aadhaar, passwords) before writing to local persistence
 * 3. Enforced TTL / expiry on cached offline state
 * 4. Secure multi-tenant cache cleanup upon logout or user switch
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { maskAadhaar } from '../lib/aadhaar';

export interface StorageOptions {
  ttlMs?: number; // Default: 24 hours
}

export interface CachedEnvelope<T> {
  data: T;
  userId: string;
  cachedAt: number;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class OfflineSecurityService {
  private formatKey(userId: string, key: string): string {
    return `@mahasetu:user_${userId}:${key}`;
  }

  /**
   * Recursively sanitizes any sensitive credentials or unmasked Aadhaar before caching.
   */
  sanitizeOfflinePayload<T>(data: T): T {
    if (data === null || data === undefined) return data;

    if (typeof data === 'string') {
      const str: string = data as string;
      const masked = str.replace(/\b([2-9]\d{3}\s?\d{4}\s?\d{4})\b/g, (match) => {
        return maskAadhaar(match);
      });
      return masked as unknown as T;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeOfflinePayload(item)) as any;
    }

    if (typeof data === 'object' && !(data instanceof Date)) {
      const sanitized: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        if (k.toLowerCase().includes('password') || k.toLowerCase().includes('token') || k.toLowerCase().includes('secret')) {
          continue; // Strip passwords and secrets from offline storage
        }
        sanitized[k] = this.sanitizeOfflinePayload(v);
      }
      return sanitized as T;
    }

    return data;
  }

  /**
   * Securely saves data in local storage for the specified user with TTL.
   */
  async setSecureItem<T>(userId: string, key: string, data: T, options?: StorageOptions): Promise<void> {
    if (!userId || !key) return;

    const ttl = options?.ttlMs || DEFAULT_TTL_MS;
    const now = Date.now();
    const sanitizedData = this.sanitizeOfflinePayload(data);

    const envelope: CachedEnvelope<T> = {
      data: sanitizedData,
      userId,
      cachedAt: now,
      expiresAt: now + ttl,
    };

    const storageKey = this.formatKey(userId, key);
    await AsyncStorage.setItem(storageKey, JSON.stringify(envelope));
  }

  /**
   * Securely retrieves data from local storage with user isolation and TTL verification.
   */
  async getSecureItem<T>(userId: string, key: string): Promise<T | null> {
    if (!userId || !key) return null;

    const storageKey = this.formatKey(userId, key);
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;

    try {
      const envelope: CachedEnvelope<T> = JSON.parse(raw);

      // Verify user isolation
      if (envelope.userId !== userId) {
        await AsyncStorage.removeItem(storageKey);
        return null;
      }

      // Verify TTL
      if (Date.now() > envelope.expiresAt) {
        await AsyncStorage.removeItem(storageKey);
        return null;
      }

      return envelope.data;
    } catch {
      await AsyncStorage.removeItem(storageKey);
      return null;
    }
  }

  /**
   * Purges all offline storage keys for a specific user upon logout or revocation.
   */
  async purgeUserData(userId: string): Promise<void> {
    if (!userId) return;

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const userPrefix = `@mahasetu:user_${userId}:`;
      const keysToRemove = allKeys.filter((k) => k.startsWith(userPrefix));

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (err: any) {
      console.warn('[OfflineSecurityService] Purge error:', err?.message);
    }
  }
}

export const offlineSecurityService = new OfflineSecurityService();
