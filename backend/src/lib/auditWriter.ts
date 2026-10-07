import * as crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';

export interface AuditEntryInput {
  actorUid: string;
  actorRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any> | string;
  ipAddress?: string;
  userAgent?: string;
}

export interface StoredAuditLog {
  id: string;
  sequenceNumber: number;
  prevHash: string;
  hash: string;
  actorUid: string;
  actorRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export function computeAuditHash(
  prevHash: string,
  sequenceNumber: number,
  timestamp: string,
  actorUid: string,
  actorRole: string,
  action: string,
  detailsStr: string
): string {
  const canonicalString = `${prevHash}|${sequenceNumber}|${timestamp}|${actorUid}|${actorRole}|${action}|${detailsStr}`;
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

/**
 * Writes a cryptographically linked, tamper-evident audit log entry in Cloud Firestore using Admin SDK.
 */
export async function writeAuditLog(
  db: FirebaseFirestore.Firestore,
  entry: AuditEntryInput
): Promise<StoredAuditLog> {
  const detailsStr = typeof entry.details === 'object' ? JSON.stringify(entry.details) : (entry.details || '');
  const timestamp = new Date().toISOString();

  // Retrieve the latest audit log to establish chain continuity
  const latestSnapshot = await db
    .collection('auditLogs')
    .orderBy('sequenceNumber', 'desc')
    .limit(1)
    .get();

  let prevHash = 'GENESIS_BLOCK_000000000000000000000000000000000000000000000000000000000000';
  let sequenceNumber = 1;

  if (!latestSnapshot.empty) {
    const lastDoc = latestSnapshot.docs[0].data();
    if (lastDoc.hash) {
      prevHash = lastDoc.hash;
    }
    if (typeof lastDoc.sequenceNumber === 'number') {
      sequenceNumber = lastDoc.sequenceNumber + 1;
    }
  }

  const hash = computeAuditHash(
    prevHash,
    sequenceNumber,
    timestamp,
    entry.actorUid,
    entry.actorRole,
    entry.action,
    detailsStr
  );

  const docId = `audit_${Date.now()}_${sequenceNumber.toString().padStart(6, '0')}`;
  const logDoc: StoredAuditLog = {
    id: docId,
    sequenceNumber,
    prevHash,
    hash,
    actorUid: entry.actorUid,
    actorRole: entry.actorRole,
    action: entry.action,
    targetType: entry.targetType || 'SYSTEM',
    targetId: entry.targetId || docId,
    details: detailsStr,
    ipAddress: entry.ipAddress || '127.0.0.1',
    userAgent: entry.userAgent || 'unknown',
    timestamp,
  };

  await db.collection('auditLogs').doc(docId).set({
    ...logDoc,
    serverTimestamp: FieldValue.serverTimestamp(),
  });

  return logDoc;
}

/**
 * Verifies the mathematical cryptographic integrity of an array of audit logs.
 * Returns valid = true if all hashes and chain links are intact, or identifies the corrupted block.
 */
export function verifyAuditChain(logs: StoredAuditLog[]): {
  valid: boolean;
  brokenAtIndex?: number;
  expectedHash?: string;
  actualHash?: string;
  error?: string;
} {
  if (!logs || logs.length === 0) {
    return { valid: true };
  }

  // Sort ascending by sequenceNumber
  const sorted = [...logs].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];

    // Check prevHash link with prior block
    if (i > 0) {
      const prior = sorted[i - 1];
      if (current.prevHash !== prior.hash) {
        return {
          valid: false,
          brokenAtIndex: i,
          error: `Chain broken at sequence #${current.sequenceNumber}: prevHash "${current.prevHash}" does not match prior hash "${prior.hash}"`,
        };
      }
      if (current.sequenceNumber !== prior.sequenceNumber + 1) {
        return {
          valid: false,
          brokenAtIndex: i,
          error: `Sequence numbering gap detected: #${prior.sequenceNumber} followed by #${current.sequenceNumber}`,
        };
      }
    } else {
      // First block in subset: verify its own internal hash
      if (current.sequenceNumber === 1 && current.prevHash !== 'GENESIS_BLOCK_000000000000000000000000000000000000000000000000000000000000') {
        return {
          valid: false,
          brokenAtIndex: 0,
          error: `Genesis block #${current.sequenceNumber} has invalid prevHash "${current.prevHash}"`,
        };
      }
    }

    // Verify self-hash integrity
    const computed = computeAuditHash(
      current.prevHash,
      current.sequenceNumber,
      current.timestamp,
      current.actorUid,
      current.actorRole,
      current.action,
      current.details
    );

    if (computed !== current.hash) {
      return {
        valid: false,
        brokenAtIndex: i,
        expectedHash: computed,
        actualHash: current.hash,
        error: `Tamper detected at sequence #${current.sequenceNumber}: expected hash "${computed}" but found "${current.hash}"`,
      };
    }
  }

  return { valid: true };
}
