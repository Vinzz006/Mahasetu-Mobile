/**
 * MahaSetu Native Intent / Deep Link Security Filter
 *
 * Sanitizes incoming deep link URLs to prevent:
 * - Open redirects to unauthorized schemes or hosts
 * - Directory traversal attacks in deep link paths
 * - Injection into administrative routes without authentication
 */

const ALLOWED_PATH_PREFIXES = [
  '/(auth)',
  '/(citizen)',
  '/(department)',
  '/(admin)',
  '/(auditor)',
  '/(pending)',
  '/resident-details',
  '/',
];

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    if (!path || typeof path !== 'string') {
      return '/';
    }

    // Decode and sanitize
    const decoded = decodeURIComponent(path).trim();

    // Block protocol injection, script schemes, traversal patterns
    if (
      decoded.includes('javascript:') ||
      decoded.includes('data:') ||
      decoded.includes('vbscript:') ||
      decoded.includes('..') ||
      decoded.includes('\\')
    ) {
      return '/';
    }

    // Extract path without domain / scheme
    let cleanPath = decoded;
    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://') || cleanPath.startsWith('mahasetu://')) {
      try {
        const parsed = new URL(cleanPath);
        cleanPath = parsed.pathname;
      } catch {
        return '/';
      }
    }

    // Normalize leading slash
    if (!cleanPath.startsWith('/')) {
      cleanPath = `/${cleanPath}`;
    }

    // Check against allowed path prefixes
    const isAllowed = ALLOWED_PATH_PREFIXES.some((prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`));
    if (!isAllowed) {
      return '/';
    }

    return cleanPath;
  } catch {
    return '/';
  }
}
