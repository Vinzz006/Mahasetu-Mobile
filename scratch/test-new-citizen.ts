import * as dotenv from 'dotenv';
dotenv.config();

import { auth } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { DEMO_PASSWORD } from '../constants/demoData';

const BASE_URL = 'http://127.0.0.1:8000';

async function testNewCitizen() {
  console.log('--- TESTING NEW CITIZEN REGISTRATION & AUTOMATIC ISOLATION ---');
  const newEmail = `citizen_test_${Date.now()}@mahasetu.gov.in`;
  console.log(`Creating new citizen account: ${newEmail}...`);

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, newEmail, DEMO_PASSWORD);
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      cred = await signInWithEmailAndPassword(auth, newEmail, DEMO_PASSWORD);
    } else {
      throw err;
    }
  }

  const newUid = cred.user.uid;
  const token = await cred.user.getIdToken(true);
  console.log(`New citizen authenticated. Real UID: ${newUid}`);

  // Fetch history: must be empty
  const histResp = await fetch(`${BASE_URL}/api/v1/ai/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const histData = await histResp.json();
  console.log(`Initial history messages count: ${(histData.messages || []).length}`);
  if ((histData.messages || []).length !== 0) {
    throw new Error('New citizen history is NOT empty!');
  }
  console.log('  [PASS] New citizen history is completely clean and empty (0 messages).');

  // Send message
  const chatResp = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message: 'NEW_CITIZEN_ISOLATED_TEST' }),
  });
  const chatData = await chatResp.json();
  console.log(`Chat response status: ${chatResp.status}, conversationId: ${chatData.conversationId}`);
  if (chatResp.status !== 200) {
    throw new Error(`Chat send failed with status ${chatResp.status}`);
  }
  if (!chatData.conversationId.includes(newUid)) {
    throw new Error(`ConversationId ${chatData.conversationId} is not scoped to new UID ${newUid}`);
  }
  console.log('  [PASS] New citizen message processed and conversationId is scoped to new UID.');

  // Check history again: only contains new citizen's message
  const updatedHistResp = await fetch(`${BASE_URL}/api/v1/ai/history?conversationId=${encodeURIComponent(chatData.conversationId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const updatedHistData = await updatedHistResp.json();
  const msgs = updatedHistData.messages || [];
  console.log(`Updated history messages count: ${msgs.length}`);
  const hasOnlyNew = msgs.every((m: any) => m.content.includes('NEW_CITIZEN') || m.role === 'assistant');
  if (!hasOnlyNew) {
    throw new Error('Foreign messages found in new citizen history!');
  }
  console.log('  [PASS] New citizen history contains ONLY their own prompt and response.');

  await signOut(auth);
  console.log('>>> NEW CITIZEN TEST PASSED: AUTOMATIC ISOLATION VERIFIED <<<\n');
}

testNewCitizen()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('New citizen test failed:', err);
    process.exit(1);
  });
