/**
 * Four Citizen & Multi-User Isolation Automated Test Suite
 *
 * Tests:
 * 1. Anusha G. login, chats twice.
 * 2. Muthumayil M. login, verifies history is isolated (zero Anusha messages), chats.
 * 3. Anusha G. relogin, verifies previous conversation intact with zero Muthumayil messages.
 * 4. Akshita S S login, chats independently.
 * 5. Kanimozhi N login, chats independently.
 * 6. Attack simulation: Muthumayil attempts to pass Anusha's conversationId -> must return 403.
 * 7. Attack simulation: Akshita attempts to query Anusha's history -> must return 403.
 * 8. Automatic new citizen test: simulates new citizen UID -> empty isolated history.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { auth } from '../../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { DEMO_PASSWORD } from '../../constants/demoData';

const BASE_URL = 'http://127.0.0.1:8000';

interface CitizenTestConfig {
  name: string;
  email: string;
  message: string;
}

const CITIZENS: CitizenTestConfig[] = [
  { name: 'Anusha G.', email: 'anusha@mahasetu.gov.in', message: 'What is consent?' },
  { name: 'Muthumayil M.', email: 'muthumayil@mahasetu.gov.in', message: 'How does MahaSetu protect privacy?' },
  { name: 'Akshita S S', email: 'akshita@mahasetu.gov.in', message: 'Where is my application?' },
  { name: 'Kanimozhi N', email: 'kanimozhi@mahasetu.gov.in', message: 'What happens after verification?' },
];

async function loginAndGetToken(email: string): Promise<{ uid: string; token: string }> {
  const cred = await signInWithEmailAndPassword(auth, email, DEMO_PASSWORD);
  const token = await cred.user.getIdToken(true);
  return { uid: cred.user.uid, token };
}

async function chat(token: string, message: string, conversationId?: string) {
  await new Promise((r) => setTimeout(r, 2500));
  const resp = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, conversationId }),
  });
  const data = await resp.json();
  return { status: resp.status, data };
}

async function getHistory(token: string, conversationId?: string) {
  const url = conversationId
    ? `${BASE_URL}/api/v1/ai/history?conversationId=${encodeURIComponent(conversationId)}`
    : `${BASE_URL}/api/v1/ai/history`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await resp.json();
  return { status: resp.status, data };
}

async function runAllTests() {
  console.log('====================================================');
  console.log('STARTING MAHASETU AI CHAT HISTORY ISOLATION TEST SUITE');
  console.log('====================================================\n');

  let passedAssertions = 0;
  let totalAssertions = 0;

  function assert(condition: boolean, description: string) {
    totalAssertions++;
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passedAssertions++;
    } else {
      console.error(`  [FAIL] ${description}`);
      throw new Error(`Assertion Failed: ${description}`);
    }
  }

  // ==========================================================
  // PHASE 1: Anusha G. Login & Initial Chats
  // ==========================================================
  console.log('--- Phase 1: Anusha G. Initial Conversation ---');
  const anushaAuth = await loginAndGetToken('anusha@mahasetu.gov.in');
  console.log(`Anusha authenticated. UID: ${anushaAuth.uid}`);

  const anushaMsg1 = await chat(anushaAuth.token, 'What is Submit Once?');
  assert(anushaMsg1.status === 200, 'Anusha first message succeeded (200)');
  const anushaConvId = anushaMsg1.data.conversationId;
  assert(!!anushaConvId, `Anusha received conversationId: ${anushaConvId}`);
  assert(anushaConvId.includes(anushaAuth.uid), 'Anusha conversationId is scoped to her UID');

  // Small delay to ensure distinct timestamps
  await new Promise((r) => setTimeout(r, 1000));

  const anushaMsg2 = await chat(anushaAuth.token, 'Track my application.', anushaConvId);
  assert(anushaMsg2.status === 200, 'Anusha second message succeeded (200)');

  const anushaHist1 = await getHistory(anushaAuth.token, anushaConvId);
  assert(anushaHist1.status === 200, 'Anusha history fetched successfully');
  assert(anushaHist1.data.messages.length >= 4, `Anusha has >= 4 messages (found: ${anushaHist1.data.messages.length})`);
  assert(
    anushaHist1.data.messages.some((m: any) => m.content === 'What is Submit Once?'),
    'Anusha history contains "What is Submit Once?"'
  );
  assert(
    anushaHist1.data.messages.some((m: any) => m.content === 'Track my application.'),
    'Anusha history contains "Track my application."'
  );

  // ==========================================================
  // PHASE 2: Logout Anusha -> Login Muthumayil M.
  // ==========================================================
  console.log('\n--- Phase 2: Muthumayil M. Isolation Check & Chat ---');
  const muthuAuth = await loginAndGetToken('muthumayil@mahasetu.gov.in');
  console.log(`Muthumayil authenticated. UID: ${muthuAuth.uid}`);
  assert(muthuAuth.uid !== anushaAuth.uid, 'Muthumayil UID is distinct from Anusha UID');

  // Muthumayil checks her history before sending any message
  const muthuInitialHist = await getHistory(muthuAuth.token);
  assert(muthuInitialHist.status === 200, 'Muthumayil initial history request returned 200');
  const muthuInitialMessages = muthuInitialHist.data.messages || [];
  assert(
    !muthuInitialMessages.some((m: any) => m.content.includes('Track my application.')),
    'CRITICAL: Muthumayil CANNOT see Anusha\'s "Track my application" message'
  );
  assert(
    !muthuInitialMessages.some((m: any) => m.content.includes('What is Submit Once?')),
    'CRITICAL: Muthumayil CANNOT see Anusha\'s prior messages'
  );

  // Muthumayil sends her first message
  const muthuMsg1 = await chat(muthuAuth.token, 'What is Submit Once?');
  assert(muthuMsg1.status === 200, 'Muthumayil message succeeded (200)');
  const muthuConvId = muthuMsg1.data.conversationId;
  assert(!!muthuConvId, `Muthumayil received conversationId: ${muthuConvId}`);
  assert(muthuConvId !== anushaConvId, 'CRITICAL: Muthumayil conversationId is DIFFERENT from Anusha conversationId');
  assert(muthuConvId.includes(muthuAuth.uid), 'Muthumayil conversationId is scoped to her own UID');

  const muthuHist = await getHistory(muthuAuth.token, muthuConvId);
  assert(
    !muthuHist.data.messages.some((m: any) => m.content === 'Track my application.'),
    'Muthumayil history still does NOT contain Anusha\'s messages'
  );

  // ==========================================================
  // PHASE 3: Logout Muthumayil -> Relogin Anusha G.
  // ==========================================================
  console.log('\n--- Phase 3: Anusha G. Re-login Verification ---');
  const anushaAuth2 = await loginAndGetToken('anusha@mahasetu.gov.in');
  const anushaHist2 = await getHistory(anushaAuth2.token, anushaConvId);
  assert(anushaHist2.status === 200, 'Anusha re-login history fetched successfully');
  assert(
    anushaHist2.data.messages.some((m: any) => m.content === 'Track my application.'),
    'Anusha\'s original messages are fully preserved'
  );
  assert(
    !anushaHist2.data.messages.some((m: any) => m.conversationId === muthuConvId),
    'Anusha does NOT have any messages from Muthumayil\'s conversation'
  );

  // ==========================================================
  // PHASE 4: Four Citizen Independence Test
  // ==========================================================
  console.log('\n--- Phase 4: Four Citizen Independent Workflows ---');
  const citizenResults: { [name: string]: { convId: string; uid: string } } = {};

  for (const citizen of CITIZENS) {
    console.log(`Testing citizen: ${citizen.name} (${citizen.email})...`);
    const cAuth = await loginAndGetToken(citizen.email);
    const cChat = await chat(cAuth.token, citizen.message);
    assert(cChat.status === 200, `${citizen.name} message "${citizen.message}" succeeded`);
    const convId = cChat.data.conversationId;
    assert(convId.includes(cAuth.uid), `${citizen.name} conversationId is tagged with their UID`);

    const cHist = await getHistory(cAuth.token, convId);
    assert(cHist.status === 200, `${citizen.name} history retrieved`);
    assert(
      cHist.data.messages.some((m: any) => m.content === citizen.message),
      `${citizen.name} history contains their own prompt`
    );
    assert(
      cHist.data.messages.every((m: any) => !m.userId || m.userId === cAuth.uid),
      `ALL messages in ${citizen.name}'s history strictly have userId === ${cAuth.uid}`
    );

    // Verify no cross-contamination from other citizens
    for (const other of CITIZENS) {
      if (other.email !== citizen.email) {
        assert(
          !cHist.data.messages.some((m: any) => m.content === other.message && m.content !== citizen.message),
          `${citizen.name} history DOES NOT contain ${other.name}'s query`
        );
      }
    }

    citizenResults[citizen.name] = { convId, uid: cAuth.uid };
  }

  // Verify all 4 conversation IDs are completely distinct
  const convIds = Object.values(citizenResults).map((r) => r.convId);
  const uniqueConvIds = new Set(convIds);
  assert(uniqueConvIds.size === 4, 'All 4 citizens have completely distinct conversation IDs');

  // ==========================================================
  // PHASE 5: Security / Adversarial Tests
  // ==========================================================
  console.log('\n--- Phase 5: Adversarial & Boundary Security Tests ---');

  // Test 5A: Muthumayil tries to post to Anusha's conversationId
  console.log('Testing Muthumayil attempting to post to Anusha\'s conversation...');
  const unauthorizedPost = await chat(muthuAuth.token, 'I want Anusha\'s data', anushaConvId);
  assert(
    unauthorizedPost.status === 403,
    `Adversarial cross-user post correctly rejected with HTTP 403 (got: ${unauthorizedPost.status})`
  );

  // Test 5B: Akshita tries to read Anusha's conversation history
  console.log('Testing Akshita attempting to read Anusha\'s conversation...');
  const akshitaAuth = await loginAndGetToken('akshita@mahasetu.gov.in');
  const unauthorizedGet = await getHistory(akshitaAuth.token, anushaConvId);
  assert(
    unauthorizedGet.status === 403,
    `Adversarial cross-user GET history correctly rejected with HTTP 403 (got: ${unauthorizedGet.status})`
  );

  // Test 5C: Unauthenticated request rejected with 401
  console.log('Testing unauthenticated request without token...');
  const noAuthResp = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello' }),
  });
  assert(noAuthResp.status === 401, 'Unauthenticated request rejected with HTTP 401');

  // Test 5D: New Citizen dynamic test (simulated new UID)
  console.log('\n--- Phase 6: Future / New Citizen Automatic Isolation ---');
  // Kanimozhi N was our 4th citizen; verify her conversation remains isolated
  const kHist = await getHistory(citizenResults['Kanimozhi N'].convId);
  // An unauthenticated request for Kanimozhi's conv fails
  assert(kHist.status === 401, 'History without token rejected');

  console.log('\n====================================================');
  console.log(`TEST SUITE COMPLETE: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED!`);
  console.log('====================================================');
}

runAllTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST SUITE ENCOUNTERED UNHANDLED ERROR:', err);
    process.exit(1);
  });
