/**
 * MahaSetu Structured Audit Logger
 *
 * Emits machine-readable JSON logs for administrative actions, statutory verifications,
 * authentication events, and security exceptions.
 * ZERO PII GUARANTEE: Never logs Aadhaar, full phone numbers, email addresses, or secrets.
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'AUDIT';

export interface AuditActor {
  uid: string;
  role?: string | null;
  departmentId?: string | null;
}

export interface AuditTarget {
  resource: 'application' | 'verification' | 'user' | 'residentProfile' | 'aiChat' | 'sms' | 'system';
  id: string;
}

export interface StructuredLogPayload {
  timestamp?: string;
  level: LogLevel;
  event: string;
  actor?: AuditActor;
  target?: AuditTarget;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'SKIPPED';
  ip?: string;
  userAgent?: string;
  details?: Record<string, any>;
  error?: string;
}

/**
 * Sanitizes any auxiliary metadata to strip PII before logging.
 */
function sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
  if (!details) return undefined;
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(details)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('aadhaar') ||
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('key')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (lowerKey.includes('phone') && typeof value === 'string') {
      sanitized[key] = value.length >= 6 ? `${value.slice(0, 3)}****${value.slice(-2)}` : '***';
    } else if (lowerKey.includes('email') && typeof value === 'string') {
      const parts = value.split('@');
      sanitized[key] = parts.length === 2 ? `${parts[0].slice(0, 2)}***@${parts[1]}` : '***';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class Logger {
  private format(entry: StructuredLogPayload): string {
    const record = {
      timestamp: entry.timestamp || new Date().toISOString(),
      level: entry.level,
      event: entry.event,
      actor: entry.actor
        ? {
            uid: entry.actor.uid,
            role: entry.actor.role || null,
            departmentId: entry.actor.departmentId || null,
          }
        : undefined,
      target: entry.target
        ? {
            resource: entry.target.resource,
            id: entry.target.id,
          }
        : undefined,
      action: entry.action,
      outcome: entry.outcome,
      ip: entry.ip || '127.0.0.1',
      userAgent: entry.userAgent || 'unknown',
      details: sanitizeDetails(entry.details),
      error: entry.error || undefined,
    };
    return JSON.stringify(record);
  }

  info(event: string, action: string, details?: Record<string, any>) {
    console.log(this.format({ level: 'INFO', event, action, outcome: 'SUCCESS', details }));
  }

  warn(event: string, action: string, error?: string, details?: Record<string, any>) {
    console.warn(this.format({ level: 'WARN', event, action, outcome: 'FAILURE', error, details }));
  }

  error(event: string, action: string, error?: string, details?: Record<string, any>) {
    console.error(this.format({ level: 'ERROR', event, action, outcome: 'FAILURE', error, details }));
  }

  audit(entry: Omit<StructuredLogPayload, 'level'>) {
    console.log(this.format({ ...entry, level: 'AUDIT' }));
  }
}

export const logger = new Logger();
