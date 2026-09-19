import * as dotenv from 'dotenv';
dotenv.config();

import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { DEMO_PASSWORD } from '../constants/demoData';

const BASE_URL = 'http://127.0.0.1:8000';

const CITIZENS = [
  { name: 'Priya Sharma', email: 'citizen.priya@mahasetu.gov.in', prompt: 'PRIYA_PRIVATE_TEST_123' },
  { name: 'Rahul Verma', email: 'citizen.rahul@mahasetu.gov.in', prompt: 'RAHUL_PRIVATE_TEST_456' },
  { name: 'Sneha Patil', email: 'citizen.sneha@mahasetu.gov.in', prompt: 'SNEHA_PRIVATE_TEST_789' },
  { name: 'Pooja Kulkarni', email: 'citizen.pooja@mahasetu.gov.in', prompt: 'POOJA_PRIVATE_TEST_999' },
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
  // SECTION 22: TEST THE ACTUAL BUG (Priya -> Rahul -> Priya)
  // ================================================================
  console.log('--- SECTION 22: THE ACTUAL BUG REPRODUCTION TEST ---');

  // STEP 1: Login as Priya
  console.log('Step 1: Logging in as Priya Sharma....');
  const priyaLogin1 = await loginCitizen('citizen.priya@mahasetu.gov.in');
  const uidA = priyaLogin1.uid;
  assertCheck(auth.currentUser?.uid === uidA, `Firebase auth.currentUser.uid is UID_A (${uidA})`);

  console.log('Sending: PRIYA_PRIVATE_TEST_123');
  const priyaSend = await sendChatMessage(priyaLogin1.token, 'PRIYA_PRIVATE_TEST_123');
  assertCheck(priyaSend.status === 200, 'Priya message successfully sent (200)');
  const priyaConvId = priyaSend.data.conversationId;
  assertCheck(!!priyaConvId, `Priya conversation ID obtained: ${priyaConvId}`);

  // STEP 2: Logout
  console.log('Step 2: Logging out...');
  await logoutCitizen();
  assertCheck(auth.currentUser === null, 'Firebase auth.currentUser == null');

  // STEP 3: Login as Rahul
  console.log('Step 3: Logging in as Rahul Verma....');
  const rahulLogin1 = await loginCitizen('citizen.rahul@mahasetu.gov.in');
  const uidB = rahulLogin1.uid;
  assertCheck(auth.currentUser?.uid === uidB, `Firebase auth.currentUser.uid is UID_B (${uidB})`);
  assertCheck(uidA !== uidB, `UID_A (${uidA}) !== UID_B (${uidB})`);

  // Open AI assistant: Rahul must NOT see Priya's message
  console.log('Fetching Rahul chat history...');
  const rahulHist1 = await getChatHistory(rahulLogin1.token);
  assertCheck(rahulHist1.status === 200, 'Rahul history query succeeded');
  const rahulMsgs1 = rahulHist1.data.messages || [];
  const hasPriyaSecret = rahulMsgs1.some((m: any) => m.content.includes('PRIYA_PRIVATE_TEST_123'));
  assertCheck(!hasPriyaSecret, 'CRITICAL: Rahul MUST NOT see "PRIYA_PRIVATE_TEST_123"');

  // STEP 4: Rahul sends "RAHUL_PRIVATE_TEST_456"
  console.log('Step 4: Rahul sends "RAHUL_PRIVATE_TEST_456"...');
  const rahulSend = await sendChatMessage(rahulLogin1.token, 'RAHUL_PRIVATE_TEST_456');
  assertCheck(rahulSend.status === 200, 'Rahul message successfully sent (200)');
  const rahulConvId = rahulSend.data.conversationId;
  assertCheck(rahulConvId !== priyaConvId, 'Rahul conversationId !== Priya conversationId');

  // STEP 5: Logout
  console.log('Step 5: Logging out Rahul...');
  await logoutCitizen();
  assertCheck(auth.currentUser === null, 'Firebase auth.currentUser == null after logout');

  // STEP 6: Login Priya again
  console.log('Step 6: Logging in as Priya Sharma again...');
  const priyaLogin2 = await loginCitizen('citizen.priya@mahasetu.gov.in');
  assertCheck(auth.currentUser?.uid === uidA, `Priya UID re-verified as UID_A (${uidA})`);

  const priyaHist2 = await getChatHistory(priyaLogin2.token, priyaConvId);
  assertCheck(priyaHist2.status === 200, 'Priya history re-fetched successfully');
  const priyaMsgs2 = priyaHist2.data.messages || [];

  const priyaHasHerMsg = priyaMsgs2.some((m: any) => m.content.includes('PRIYA_PRIVATE_TEST_123'));
  assertCheck(priyaHasHerMsg, 'Priya MUST see "PRIYA_PRIVATE_TEST_123"');

  const priyaHasRahulMsg = priyaMsgs2.some((m: any) => m.content.includes('RAHUL_PRIVATE_TEST_456'));
  assertCheck(!priyaHasRahulMsg, 'Priya MUST NOT see "RAHUL_PRIVATE_TEST_456"');

  console.log('>>> SECTION 22 PASSED: ZERO LEAKAGE BETWEEN PRIYA AND RAHUL <<<\n');

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

  // Rahul attempts to access Priya's conversation ID
  const rahulAuthAdversary = await loginCitizen('citizen.rahul@mahasetu.gov.in');

  console.log(`Adversarial Test 1: Rahul queries GET /api/v1/ai/history?conversationId=${priyaConvId}...`);
  const adversaryGet = await getChatHistory(rahulAuthAdversary.token, priyaConvId);
  assertCheck(
    adversaryGet.status === 403,
    `Cross-user GET history correctly returns HTTP 403 Forbidden (got: ${adversaryGet.status})`
  );

  console.log(`Adversarial Test 2: Rahul sends POST /api/v1/ai/chat with conversationId=${priyaConvId}...`);
  const adversaryPost = await sendChatMessage(rahulAuthAdversary.token, 'Attacking Priya conversation', priyaConvId);
  assertCheck(
    adversaryPost.status === 403,
    `Cross-user POST chat correctly returns HTTP 403 Forbidden (got: ${adversaryPost.status})`
  );

  console.log('Adversarial Test 3: Rahul attempts to alter userId in request body to Priya UID...');
  const adversarySpoof = await sendChatMessage(rahulAuthAdversary.token, 'Spoofing userId', undefined, {
    userId: uidA,
  });
  assertCheck(adversarySpoof.status === 200, 'Request processed without crash');
  // Confirm conversation is assigned to Rahul, NOT Priya!
  assertCheck(
    adversarySpoof.data.conversationId.includes(uidB),
    `Backend IGNORED spoofed client userId and bound conversation to Rahul UID (${uidB})`
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
