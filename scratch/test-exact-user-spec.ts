import * as dotenv from 'dotenv';
dotenv.config();

import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { DEMO_PASSWORD } from '../constants/demoData';

const BASE_URL = 'http://127.0.0.1:8000';

const CITIZENS = [
  { name: 'Anusha G.', email: 'anusha@mahasetu.gov.in', prompt: 'ANUSHA_PRIVATE_TEST_123' },
  { name: 'Muthumayil M.', email: 'muthumayil@mahasetu.gov.in', prompt: 'MUTHUMAYIL_PRIVATE_TEST_456' },
  { name: 'Akshita S S', email: 'akshita@mahasetu.gov.in', prompt: 'AKSHITA_PRIVATE_TEST_789' },
  { name: 'Kanimozhi N', email: 'kanimozhi@mahasetu.gov.in', prompt: 'KANIMOZHI_PRIVATE_TEST_999' },
];

async function loginCitizen(email: string) {
  const cred = await signInWithEmailAndPassword(auth, email, DEMO_PASSWORD);
  const token = await cred.user.getIdToken(true);
  return { user: cred.user, uid: cred.user.uid, token };
}

async function logoutCitizen() {
  await signOut(auth);
}

async function sendChatMessage(token: string, message: string, conversationId?: string, extraBody: any = {}) {
  await new Promise((r) => setTimeout(r, 1500));
  const resp = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, conversationId, ...extraBody }),
  });
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, data };
}

async function getChatHistory(token: string, conversationId?: string) {
  const url = conversationId
    ? `${BASE_URL}/api/v1/ai/history?conversationId=${encodeURIComponent(conversationId)}`
    : `${BASE_URL}/api/v1/ai/history`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, data };
}

async function runExactTests() {
  console.log('================================================================');
  console.log('MAHASETU AI STRICT CHAT HISTORY ISOLATION: EXACT USER SPEC TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assertCheck(cond: boolean, msg: string) {
    total++;
    if (cond) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      throw new Error(`FAILED: ${msg}`);
    }
  }

  // ================================================================
  // SECTION 22: TEST THE ACTUAL BUG (Anusha -> Muthumayil -> Anusha)
  // ================================================================
  console.log('--- SECTION 22: THE ACTUAL BUG REPRODUCTION TEST ---');

  // STEP 1: Login as Anusha
  console.log('Step 1: Logging in as Anusha G....');
  const anushaLogin1 = await loginCitizen('anusha@mahasetu.gov.in');
  const uidA = anushaLogin1.uid;
  assertCheck(auth.currentUser?.uid === uidA, `Firebase auth.currentUser.uid is UID_A (${uidA})`);

  console.log('Sending: ANUSHA_PRIVATE_TEST_123');
  const anushaSend = await sendChatMessage(anushaLogin1.token, 'ANUSHA_PRIVATE_TEST_123');
  assertCheck(anushaSend.status === 200, 'Anusha message successfully sent (200)');
  const anushaConvId = anushaSend.data.conversationId;
  assertCheck(!!anushaConvId, `Anusha conversation ID obtained: ${anushaConvId}`);

  // STEP 2: Logout
  console.log('Step 2: Logging out...');
  await logoutCitizen();
  assertCheck(auth.currentUser === null, 'Firebase auth.currentUser == null');

  // STEP 3: Login as Muthumayil
  console.log('Step 3: Logging in as Muthumayil M....');
  const muthuLogin1 = await loginCitizen('muthumayil@mahasetu.gov.in');
  const uidB = muthuLogin1.uid;
  assertCheck(auth.currentUser?.uid === uidB, `Firebase auth.currentUser.uid is UID_B (${uidB})`);
  assertCheck(uidA !== uidB, `UID_A (${uidA}) !== UID_B (${uidB})`);

  // Open AI assistant: Muthumayil must NOT see Anusha's message
  console.log('Fetching Muthumayil chat history...');
  const muthuHist1 = await getChatHistory(muthuLogin1.token);
  assertCheck(muthuHist1.status === 200, 'Muthumayil history query succeeded');
  const muthuMsgs1 = muthuHist1.data.messages || [];
  const hasAnushaSecret = muthuMsgs1.some((m: any) => m.content.includes('ANUSHA_PRIVATE_TEST_123'));
  assertCheck(!hasAnushaSecret, 'CRITICAL: Muthumayil MUST NOT see "ANUSHA_PRIVATE_TEST_123"');

  // STEP 4: Muthumayil sends "MUTHUMAYIL_PRIVATE_TEST_456"
  console.log('Step 4: Muthumayil sends "MUTHUMAYIL_PRIVATE_TEST_456"...');
  const muthuSend = await sendChatMessage(muthuLogin1.token, 'MUTHUMAYIL_PRIVATE_TEST_456');
  assertCheck(muthuSend.status === 200, 'Muthumayil message successfully sent (200)');
  const muthuConvId = muthuSend.data.conversationId;
  assertCheck(muthuConvId !== anushaConvId, 'Muthumayil conversationId !== Anusha conversationId');

  // STEP 5: Logout
  console.log('Step 5: Logging out Muthumayil...');
  await logoutCitizen();
  assertCheck(auth.currentUser === null, 'Firebase auth.currentUser == null after logout');

  // STEP 6: Login Anusha again
  console.log('Step 6: Logging in as Anusha G. again...');
  const anushaLogin2 = await loginCitizen('anusha@mahasetu.gov.in');
  assertCheck(auth.currentUser?.uid === uidA, `Anusha UID re-verified as UID_A (${uidA})`);

  const anushaHist2 = await getChatHistory(anushaLogin2.token, anushaConvId);
  assertCheck(anushaHist2.status === 200, 'Anusha history re-fetched successfully');
  const anushaMsgs2 = anushaHist2.data.messages || [];

  const anushaHasHerMsg = anushaMsgs2.some((m: any) => m.content.includes('ANUSHA_PRIVATE_TEST_123'));
  assertCheck(anushaHasHerMsg, 'Anusha MUST see "ANUSHA_PRIVATE_TEST_123"');

  const anushaHasMuthuMsg = anushaMsgs2.some((m: any) => m.content.includes('MUTHUMAYIL_PRIVATE_TEST_456'));
  assertCheck(!anushaHasMuthuMsg, 'Anusha MUST NOT see "MUTHUMAYIL_PRIVATE_TEST_456"');

  console.log('>>> SECTION 22 PASSED: ZERO LEAKAGE BETWEEN ANUSHA AND MUTHUMAYIL <<<\n');

  // ================================================================
  // SECTION 23: FOUR CITIZEN TEST
  // ================================================================
  console.log('--- SECTION 23: FOUR CITIZEN UNIQUE TOKEN TEST ---');
  const fourCitizenConvs: { [email: string]: { uid: string; convId: string; prompt: string } } = {};

  for (const c of CITIZENS) {
    console.log(`Testing ${c.name} with prompt "${c.prompt}"...`);
    const cAuth = await loginCitizen(c.email);
    const sendRes = await sendChatMessage(cAuth.token, c.prompt);
    assertCheck(sendRes.status === 200, `${c.name} message sent (200)`);
    const convId = sendRes.data.conversationId;
    fourCitizenConvs[c.email] = { uid: cAuth.uid, convId, prompt: c.prompt };

    const histRes = await getChatHistory(cAuth.token, convId);
    assertCheck(histRes.status === 200, `${c.name} history retrieved`);
    const msgs = histRes.data.messages || [];

    // Check citizen sees their own prompt
    assertCheck(msgs.some((m: any) => m.content.includes(c.prompt)), `${c.name} sees their own prompt "${c.prompt}"`);

    // Check citizen does NOT see any of the other 3 citizens' test tokens
    for (const other of CITIZENS) {
      if (other.email !== c.email) {
        assertCheck(!msgs.some((m: any) => m.content.includes(other.prompt)), `${c.name} DOES NOT see ${other.name}'s prompt "${other.prompt}"`);
      }
    }

    await logoutCitizen();
  }

  // Verify all 4 UIDs are distinct
  const uids = Object.values(fourCitizenConvs).map((x) => x.uid);
  const uniqueUids = new Set(uids);
  assertCheck(uniqueUids.size === 4, `All 4 citizens have distinct Firebase UIDs (count: ${uniqueUids.size})`);

  // Verify all 4 conversation IDs are distinct
  const convs = Object.values(fourCitizenConvs).map((x) => x.convId);
  const uniqueConvs = new Set(convs);
  assertCheck(uniqueConvs.size === 4, `All 4 citizens have distinct conversation IDs (count: ${uniqueConvs.size})`);

  console.log('>>> SECTION 23 PASSED: ALL FOUR CITIZENS ARE COMPLETELY ISOLATED <<<\n');

  // ================================================================
  // SECTION 24: ADVERSARIAL TEST
  // ================================================================
  console.log('--- SECTION 24: ADVERSARIAL BOUNDARY SECURITY TESTS ---');

  // Muthumayil attempts to access Anusha's conversation ID
  const muthuAuthAdversary = await loginCitizen('muthumayil@mahasetu.gov.in');

  console.log(`Adversarial Test 1: Muthumayil queries GET /api/v1/ai/history?conversationId=${anushaConvId}...`);
  const adversaryGet = await getChatHistory(muthuAuthAdversary.token, anushaConvId);
  assertCheck(
    adversaryGet.status === 403,
    `Cross-user GET history correctly returns HTTP 403 Forbidden (got: ${adversaryGet.status})`
  );

  console.log(`Adversarial Test 2: Muthumayil sends POST /api/v1/ai/chat with conversationId=${anushaConvId}...`);
  const adversaryPost = await sendChatMessage(muthuAuthAdversary.token, 'Attacking Anusha conversation', anushaConvId);
  assertCheck(
    adversaryPost.status === 403,
    `Cross-user POST chat correctly returns HTTP 403 Forbidden (got: ${adversaryPost.status})`
  );

  console.log('Adversarial Test 3: Muthumayil attempts to alter userId in request body to Anusha UID...');
  const adversarySpoof = await sendChatMessage(muthuAuthAdversary.token, 'Spoofing userId', undefined, {
    userId: uidA,
  });
  assertCheck(adversarySpoof.status === 200, 'Request processed without crash');
  // Confirm conversation is assigned to Muthumayil, NOT Anusha!
  assertCheck(
    adversarySpoof.data.conversationId.includes(uidB),
    `Backend IGNORED spoofed client userId and bound conversation to Muthumayil UID (${uidB})`
  );

  await logoutCitizen();

  console.log('\n================================================================');
  console.log(`ALL SPECIFICATION TESTS PASSED: ${passed}/${total} ASSERTIONS SUCCEEDED!`);
  console.log('================================================================');
}

runExactTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST ERROR:', err);
    process.exit(1);
  });
