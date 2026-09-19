import * as dotenv from 'dotenv';
dotenv.config();
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { aiService } from '../services/aiService';
import { DEMO_PASSWORD } from '../constants/demoData';
import { Config } from '../constants/config';

async function testAiIp() {
  console.log('Testing aiService network reachability...');
  console.log('Config.API_BASE_URL is:', Config.API_BASE_URL);

  const cred = await signInWithEmailAndPassword(auth, 'citizen.priya@mahasetu.gov.in', DEMO_PASSWORD);
  console.log('Authenticated UID:', cred.user.uid);

  // 1. Test getHistory
  console.log('Testing aiService.getHistory()...');
  const hist = await aiService.getHistory();
  console.log('Got history successfully! Messages count:', hist.messages.length);

  // 2. Test sendMessage
  console.log('Testing aiService.sendMessage()...');
  const resp = await aiService.sendMessage('Ping from mobile IP test');
  console.log('Got chat response successfully! ConversationId:', resp.conversationId);
  console.log('Response message snippet:', resp.message.substring(0, 80));

  console.log('>>> AISERVICE IP & NETWORK REACHABILITY TEST PASSED <<<');
}

testAiIp().then(() => process.exit(0)).catch((err) => { console.error('FAILED:', err); process.exit(1); });
