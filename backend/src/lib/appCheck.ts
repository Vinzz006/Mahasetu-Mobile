import * as http from 'http';
import { adminAppCheck } from './firebaseAdmin';
import { logger } from './logger';

export interface AppCheckVerificationResult {
  valid: boolean;
  appId?: string;
  error?: string;
}

/**
 * Validates a raw App Check token string using Firebase Admin SDK.
 */
export async function verifyAppCheckToken(token: string | undefined): Promise<AppCheckVerificationResult> {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return { valid: false, error: 'App Check token is missing or empty' };
  }

  try {
    const claims = await adminAppCheck.verifyToken(token.trim());
    return {
      valid: true,
      appId: claims.appId,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err?.message || 'Invalid App Check token',
    };
  }
}

/**
 * Verifies the incoming Firebase App Check token header (X-Firebase-AppCheck).
 * If APP_CHECK_ENFORCED === 'true', rejecting invalid or missing tokens is mandatory.
 */
export async function verifyAppCheck(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestId: string
): Promise<boolean> {
  const isEnforced = process.env.APP_CHECK_ENFORCED === 'true';
  const token = req.headers['x-firebase-appcheck'] as string | undefined;

  if (!token) {
    if (isEnforced) {
      logger.warn('APP_CHECK_MISSING', 'Request rejected due to missing App Check token', undefined, { requestId });
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
      });
      res.end(JSON.stringify({
        error: 'Unauthorized: Firebase App Check token is required.',
        code: 'APP_CHECK_REQUIRED',
        requestId,
      }));
      return false;
    }
    return true; // Allowed in development/testing when not strictly enforced
  }

  const result = await verifyAppCheckToken(token);
  if (!result.valid) {
    logger.warn('APP_CHECK_INVALID', 'App Check verification failed', result.error, { requestId });
    if (isEnforced) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
      });
      res.end(JSON.stringify({
        error: 'Unauthorized: Invalid Firebase App Check token.',
        code: 'APP_CHECK_INVALID',
        requestId,
      }));
      return false;
    }
    return true;
  }

  logger.info('APP_CHECK_VERIFIED', 'App Check token verified successfully', {
    requestId,
    appId: result.appId,
  });
  return true;
}

