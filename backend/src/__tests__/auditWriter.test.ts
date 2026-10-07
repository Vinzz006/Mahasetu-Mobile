import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  computeAuditHash,
  verifyAuditChain,
  StoredAuditLog,
  writeAuditLog,
} from '../lib/auditWriter';

describe('Audit Writer & Cryptographic Hash Chain Tests', () => {
  it('1. Computes deterministic sha256 hash for identical input', () => {
    const hash1 = computeAuditHash(
      'GENESIS',
      1,
      '2026-01-01T00:00:00.000Z',
      'user_1',
      'CITIZEN',
      'LOGIN',
      'details_abc'
    );
    const hash2 = computeAuditHash(
      'GENESIS',
      1,
      '2026-01-01T00:00:00.000Z',
      'user_1',
      'CITIZEN',
      'LOGIN',
      'details_abc'
    );
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(typeof hash1, 'string');
    assert.strictEqual(hash1.length, 64);
  });

  it('2. Verifies valid 3-block cryptographic hash chain', () => {
    const genesisPrev = 'GENESIS_BLOCK_000000000000000000000000000000000000000000000000000000000000';
    const time1 = '2026-01-01T00:00:00.000Z';
    const hash1 = computeAuditHash(genesisPrev, 1, time1, 'alice', 'CITIZEN', 'LOGIN', '');

    const time2 = '2026-01-01T00:01:00.000Z';
    const hash2 = computeAuditHash(hash1, 2, time2, 'alice', 'CITIZEN', 'APPLY', '{"serviceId":"REV_01"}');

    const time3 = '2026-01-01T00:02:00.000Z';
    const hash3 = computeAuditHash(hash2, 3, time3, 'officer_1', 'DEPARTMENT_A', 'VERIFY', '{"stage":1}');

    const chain: StoredAuditLog[] = [
      {
        id: 'audit_1',
        sequenceNumber: 1,
        prevHash: genesisPrev,
        hash: hash1,
        actorUid: 'alice',
        actorRole: 'CITIZEN',
        action: 'LOGIN',
        details: '',
        timestamp: time1,
      },
      {
        id: 'audit_2',
        sequenceNumber: 2,
        prevHash: hash1,
        hash: hash2,
        actorUid: 'alice',
        actorRole: 'CITIZEN',
        action: 'APPLY',
        details: '{"serviceId":"REV_01"}',
        timestamp: time2,
      },
      {
        id: 'audit_3',
        sequenceNumber: 3,
        prevHash: hash2,
        hash: hash3,
        actorUid: 'officer_1',
        actorRole: 'DEPARTMENT_A',
        action: 'VERIFY',
        details: '{"stage":1}',
        timestamp: time3,
      },
    ];

    const result = verifyAuditChain(chain);
    assert.strictEqual(result.valid, true);
  });

  it('3. Detects modified action / payload in historical block', () => {
    const genesisPrev = 'GENESIS_BLOCK_000000000000000000000000000000000000000000000000000000000000';
    const time1 = '2026-01-01T00:00:00.000Z';
    const hash1 = computeAuditHash(genesisPrev, 1, time1, 'alice', 'CITIZEN', 'LOGIN', '');

    const corruptedChain: StoredAuditLog[] = [
      {
        id: 'audit_1',
        sequenceNumber: 1,
        prevHash: genesisPrev,
        hash: hash1,
        actorUid: 'alice',
        actorRole: 'CITIZEN',
        action: 'MALICIOUS_TAMPERED_ACTION', // Tampered action without updating hash
        details: '',
        timestamp: time1,
      },
    ];

    const result = verifyAuditChain(corruptedChain);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes('Tamper detected'));
  });

  it('4. Detects broken link when a block is omitted or swapped', () => {
    const genesisPrev = 'GENESIS_BLOCK_000000000000000000000000000000000000000000000000000000000000';
    const time1 = '2026-01-01T00:00:00.000Z';
    const hash1 = computeAuditHash(genesisPrev, 1, time1, 'alice', 'CITIZEN', 'LOGIN', '');

    const time3 = '2026-01-01T00:02:00.000Z';
    const hash3 = computeAuditHash('non_existent_prev_hash', 3, time3, 'officer_1', 'DEPARTMENT_A', 'VERIFY', '');

    const brokenChain: StoredAuditLog[] = [
      {
        id: 'audit_1',
        sequenceNumber: 1,
        prevHash: genesisPrev,
        hash: hash1,
        actorUid: 'alice',
        actorRole: 'CITIZEN',
        action: 'LOGIN',
        details: '',
        timestamp: time1,
      },
      {
        id: 'audit_3',
        sequenceNumber: 3,
        prevHash: 'non_existent_prev_hash',
        hash: hash3,
        actorUid: 'officer_1',
        actorRole: 'DEPARTMENT_A',
        action: 'VERIFY',
        details: '',
        timestamp: time3,
      },
    ];

    const result = verifyAuditChain(brokenChain);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes('Chain broken') || result.error?.includes('gap'));
  });

  it('5. writeAuditLog creates chained log using mock db', async () => {
    let savedDoc: any = null;
    const mockDb: any = {
      collection: (colName: string) => ({
        orderBy: () => ({
          limit: () => ({
            get: async () => ({
              empty: false,
              docs: [
                {
                  data: () => ({
                    sequenceNumber: 5,
                    hash: 'prev_hash_12345',
                  }),
                },
              ],
            }),
          }),
        }),
        doc: () => ({
          set: async (docData: any) => {
            savedDoc = docData;
          },
        }),
      }),
    };

    const written = await writeAuditLog(mockDb, {
      actorUid: 'admin_1',
      actorRole: 'ADMIN',
      action: 'APPROVE_USER',
      details: { targetUid: 'officer_1' },
    });

    assert.strictEqual(written.sequenceNumber, 6);
    assert.strictEqual(written.prevHash, 'prev_hash_12345');
    assert.strictEqual(written.actorUid, 'admin_1');
    assert.strictEqual(savedDoc.sequenceNumber, 6);
    assert.strictEqual(savedDoc.prevHash, 'prev_hash_12345');
  });
});
