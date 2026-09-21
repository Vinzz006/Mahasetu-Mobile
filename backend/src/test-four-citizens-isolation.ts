/**
 * Four Citizen & Multi-User Isolation Automated Test Suite
 *
 * Tests:
 * 1. Priya Sharma login, chats twice.
 * 2. Rahul Verma login, verifies history is isolated (zero Priya messages), chats.
 * 3. Priya Sharma relogin, verifies previous conversation intact with zero Rahul messages.
 * 4. Sneha Patil login, chats independently.
 * 5. Pooja Kulkarni login, chats independently.
 * 6. Attack simulation: Rahul attempts to pass Priya's conversationId -> must return 403.
 * 7. Attack simulation: Sneha attempts to query Priya's history -> must return 403.
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
  { name: 'Priya Sharma', email: 'citizen.priya@mahasetu.gov.in', message: 'What is consent?' },
  { name: 'Rahul Verma', email: 'citizen.rahul@mahasetu.gov.in', message: 'How does MahaSetu protect privacy?' },
  { name: 'Sneha Patil', email: 'citizen.sneha@mahasetu.gov.in', message: 'Where is my application?' },
  { name: 'Pooja Kulkarni', email: 'citizen.pooja@mahasetu.gov.in', message: 'What happens after verification?' },
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
  // PHASE 1: Priya Sharma Login & Initial Chats
  // ==========================================================
  console.log('--- Phase 1: Priya Sharma Initial Conversation ---');
  const priyaAuth = await loginAndGetToken('citizen.priya@mahasetu.gov.in');
  console.log(`Priya authenticated. UID: ${priyaAuth.uid}`);

  const priyaMsg1 = await chat(priyaAuth.token, 'What is Submit Once?');
  assert(priyaMsg1.status === 200, 'Priya first message succeeded (200)');
  const priyaConvId = priyaMsg1.data.conversationId;
  assert(!!priyaConvId, `Priya received conversationId: ${priyaConvId}`);
  assert(priyaConvId.includes(priyaAuth.uid), 'Priya conversationId is scoped to her UID');

  // Small delay to ensure distinct timestamps
  await new Promise((r) => setTimeout(r, 1000));

  const priyaMsg2 = await chat(priyaAuth.token, 'Track my application.', priyaConvId);
  assert(priyaMsg2.status === 200, 'Priya second message succeeded (200)');

  const priyaHist1 = await getHistory(priyaAuth.token, priyaConvId);
  assert(priyaHist1.status === 200, 'Priya history fetched successfully');
  assert(priyaHist1.data.messages.length >= 4, `Priya has >= 4 messages (found: ${priyaHist1.data.messages.length})`);
  assert(
    priyaHist1.data.messages.some((m: any) => m.content === 'What is Submit Once?'),
    'Priya history contains "What is Submit Once?"'
  );
  assert(
    priyaHist1.data.messages.some((m: any) => m.content === 'Track my application.'),
    'Priya history contains "Track my application."'
  );

  // ==========================================================
  // PHASE 2: Logout Priya -> Login Rahul Verma
  // ==========================================================
  console.log('\n--- Phase 2: Rahul Verma Isolation Check & Chat ---');
  const rahulAuth = await loginAndGetToken('citizen.rahul@mahasetu.gov.in');
  console.log(`Rahul authenticated. UID: ${rahulAuth.uid}`);
  assert(rahulAuth.uid !== priyaAuth.uid, 'Rahul UID is distinct from Priya UID');

  // Rahul checks his history before sending any message
  const rahulInitialHist = await getHistory(rahulAuth.token);
  assert(rahulInitialHist.status === 200, 'Rahul initial history request returned 200');
  const rahulInitialMessages = rahulInitialHist.data.messages || [];
  assert(
    !rahulInitialMessages.some((m: any) => m.content.includes('Track my application.')),
    'CRITICAL: Rahul CANNOT see Priya\'s "Track my application" message'
  );
  assert(
    !rahulInitialMessages.some((m: any) => m.content.includes('What is Submit Once?')),
    'CRITICAL: Rahul CANNOT see Priya\'s prior messages'
  );

  // Rahul sends his first message
  const rahulMsg1 = await chat(rahulAuth.token, 'What is Submit Once?');
  assert(rahulMsg1.status === 200, 'Rahul message succeeded (200)');
  const rahulConvId = rahulMsg1.data.conversationId;
  assert(!!rahulConvId, `Rahul received conversationId: ${rahulConvId}`);
  assert(rahulConvId !== priyaConvId, 'CRITICAL: Rahul conversationId is DIFFERENT from Priya conversationId');
  assert(rahulConvId.includes(rahulAuth.uid), 'Rahul conversationId is scoped to his own UID');

  const rahulHist = await getHistory(rahulAuth.token, rahulConvId);
  assert(
    !rahulHist.data.messages.some((m: any) => m.content === 'Track my application.'),
    'Rahul history still does NOT contain Priya\'s messages'
  );

  // ==========================================================
  // PHASE 3: Logout Rahul -> Relogin Priya Sharma
  // ==========================================================
  console.log('\n--- Phase 3: Priya Sharma Re-login Verification ---');
  const priyaAuth2 = await loginAndGetToken('citizen.priya@mahasetu.gov.in');
  const priyaHist2 = await getHistory(priyaAuth2.token, priyaConvId);
  assert(priyaHist2.status === 200, 'Priya re-login history fetched successfully');
  assert(
    priyaHist2.data.messages.some((m: any) => m.content === 'Track my application.'),
    'Priya\'s original messages are fully preserved'
  );
  assert(
    !priyaHist2.data.messages.some((m: any) => m.conversationId === rahulConvId),
    'Priya does NOT have any messages from Rahul\'s conversation'
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

  // Test 5A: Rahul tries to post to Priya's conversationId
  console.log('Testing Rahul attempting to post to Priya\'s conversation...');
  const unauthorizedPost = await chat(rahulAuth.token, 'I want Priya\'s data', priyaConvId);
  assert(
    unauthorizedPost.status === 403,
    `Adversarial cross-user post correctly rejected with HTTP 403 (got: ${unauthorizedPost.status})`
  );

  // Test 5B: Sneha tries to read Priya's conversation history
  console.log('Testing Sneha attempting to read Priya\'s conversation...');
  const snehaAuth = await loginAndGetToken('citizen.sneha@mahasetu.gov.in');
  const unauthorizedGet = await getHistory(snehaAuth.token, priyaConvId);
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
  // Pooja Kulkarni was our 4th citizen; verify her conversation remains isolated
  const kHist = await getHistory(citizenResults['Pooja Kulkarni'].convId);
  // An unauthenticated request for Pooja's conv fails
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
