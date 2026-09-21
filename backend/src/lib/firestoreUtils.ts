/**
 * Backend Firestore Utility Functions
 * Isolates payload normalization to the backend without client SDK dependencies.
 */

export function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date || (obj as any)?._methodName !== undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => (item === undefined ? null : sanitizeFirestorePayload(item))) as any;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      result[key] = null;
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      (value as any)?._methodName === undefined
    ) {
      result[key] = sanitizeFirestorePayload(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

export function assertNoUndefinedValues(payload: Record<string, any>, documentContext: string): void {
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) {
      throw new Error(
        `Firestore Write Error: Field "${key}" is undefined in document "${documentContext}". All optional fields must be null, not undefined.`
      );
    }
    if (value !== null && typeof value === 'object' && !(value instanceof Date) && (value as any)?._methodName === undefined) {
      assertNoUndefinedValues(value, `${documentContext}.${key}`);
    }
  }
}
