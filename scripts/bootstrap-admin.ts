/**
 * MahaSetu Admin Bootstrap Script
 *
 * Sets the initial ADMIN custom claims and Firestore record for a specified UID.
 * Zero hardcoded UIDs or credentials.
 * Refuses execution in production unless --confirm is explicitly passed.
 *
 * Usage:
 *   npx ts-node scripts/bootstrap-admin.ts --uid <USER_UID> [--confirm]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { adminAuth, adminDb, FieldValue } from '../backend/src/lib/firebaseAdmin';

async function bootstrapAdmin() {
  const args = process.argv.slice(2);
  let targetUid = '';
  let confirmed = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--uid' && args[i + 1]) {
      targetUid = args[i + 1].trim();
      i++;
    } else if (args[i] === '--confirm') {
      confirmed = true;
    } else if (!targetUid && !args[i].startsWith('--')) {
      targetUid = args[i].trim();
    }
  }

  if (!targetUid) {
    console.error('Error: Target UID is required.');
    console.error('Usage: npx ts-node scripts/bootstrap-admin.ts --uid <USER_UID> [--confirm]');
    process.exit(1);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !confirmed) {
    console.error('SAFETY WARNING: Running in production environment.');
    console.error('To bootstrap an administrator in production, you must explicitly pass the --confirm flag:');
    console.error(`  npx ts-node scripts/bootstrap-admin.ts --uid ${targetUid} --confirm`);
    process.exit(1);
  }

  try {
    console.log(`[Bootstrap] Verifying user record in Firebase Auth for UID: ${targetUid}...`);
    const userRecord = await adminAuth.getUser(targetUid);
    console.log(`[Bootstrap] Found user: ${userRecord.email || userRecord.uid}`);

    // Set signed custom claims for ADMIN role
    console.log('[Bootstrap] Setting custom user claims { role: "ADMIN", status: "APPROVED" }...');
    await adminAuth.setCustomUserClaims(targetUid, {
      role: 'ADMIN',
      status: 'APPROVED',
    });

    // Update user document in Firestore
    console.log('[Bootstrap] Updating Firestore user profile document...');
    await adminDb.collection('users').doc(targetUid).set(
      {
        uid: targetUid,
        email: userRecord.email || '',
        role: 'ADMIN',
        status: 'APPROVED',
        isActive: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log('----------------------------------------------------');
    console.log(`SUCCESS: User ${targetUid} (${userRecord.email}) is now bootstrapped as ADMIN.`);
    console.log('The user must sign out and sign back in, or call getIdToken(true) to refresh their token claims.');
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (err: any) {
    console.error('[Bootstrap Error] Failed to bootstrap administrator:', err.message);
    process.exit(1);
  }
}

bootstrapAdmin();
