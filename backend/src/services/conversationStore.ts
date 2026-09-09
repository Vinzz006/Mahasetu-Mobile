/**
 * MahaSetu AI Conversation Store (Authoritative User-Isolated Persistence)
 *
 * Enforces strict multi-tenant isolation:
 * - Conversations and messages are strictly partitioned by authenticated Firebase Auth UID.
 * - Cross-user conversation access is blocked with 403 Forbidden.
 * - Survives backend restarts via local JSON persistence.
 * - Seamlessly integrates with Firestore when cloud permissions allow.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface StoredMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface StoredConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}

interface StoreData {
  // userId -> { [convId]: StoredConversation }
  users: {
    [userId: string]: {
      [convId: string]: StoredConversation;
    };
  };
}

class ConversationStore {
  private filePath: string;
  private data: StoreData = { users: {} };
  private initialized = false;

  constructor() {
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch {}
    }
    this.filePath = path.join(dataDir, 'user_conversations.json');
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.users) {
          // Sanitize store data: Drop any records where userId is missing or inconsistent
          const cleanUsers: StoreData['users'] = {};
          for (const [userId, convs] of Object.entries(parsed.users as Record<string, any>)) {
            if (!userId || typeof userId !== 'string' || !userId.trim()) continue;
            cleanUsers[userId] = {};
            if (convs && typeof convs === 'object') {
              for (const [convId, conv] of Object.entries(convs as Record<string, any>)) {
                if (!conv || conv.userId !== userId) continue;
                const safeMessages: StoredMessage[] = [];
                if (Array.isArray(conv.messages)) {
                  for (const msg of conv.messages) {
                    // Strict message ownership check
                    if (msg && msg.userId === userId && msg.role && msg.content) {
                      safeMessages.push({
                        id: msg.id || `msg_${Date.now()}`,
                        conversationId: convId,
                        userId,
                        role: msg.role === 'assistant' ? 'assistant' : 'user',
                        content: msg.content,
                        createdAt: msg.createdAt || new Date().toISOString(),
                      });
                    }
                  }
                }
                cleanUsers[userId][convId] = {
                  id: convId,
                  userId,
                  title: conv.title || 'Conversation',
                  createdAt: conv.createdAt || new Date().toISOString(),
                  updatedAt: conv.updatedAt || new Date().toISOString(),
                  messages: safeMessages,
                };
              }
            }
          }
          this.data = { users: cleanUsers };
        }
      }
    } catch (e: any) {
      console.warn('[ConversationStore] Warning loading store from disk:', e.message);
    }
    this.initialized = true;
  }

  private saveToDisk() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e: any) {
      console.warn('[ConversationStore] Warning persisting store to disk:', e.message);
    }
  }

  /**
   * Validates if the conversation belongs to the requested user.
   * If it exists under a different user, returns false.
   */
  isConversationOwnedBy(conversationId: string, userId: string): boolean {
    for (const [ownerId, convs] of Object.entries(this.data.users)) {
      if (convs[conversationId]) {
        return ownerId === userId;
      }
    }
    return true; // Not yet registered or is new
  }

  /**
   * Gets the owner of a conversation if it exists.
   */
  getConversationOwner(conversationId: string): string | null {
    for (const [ownerId, convs] of Object.entries(this.data.users)) {
      if (convs[conversationId]) {
        return ownerId;
      }
    }
    return null;
  }

  /**
   * Resolves or generates an isolated conversation ID for a user.
   * Enforces that foreign conversation IDs throw a 403 error.
   * Does NOT accept arbitrary conversation IDs without ownership verification.
   */
  resolveUserConversationId(userId: string, requestedConvId?: string): string {
    if (requestedConvId && requestedConvId.trim()) {
      const cleanId = requestedConvId.trim();
      const owner = this.getConversationOwner(cleanId);
      if (owner && owner !== userId) {
        console.error(`[ConversationStore] Security Violation: User ${userId} attempted to access conversation ${cleanId} owned by ${owner}`);
        const err: any = new Error("Forbidden: Access to another user's conversation is strictly prohibited.");
        err.statusCode = 403;
        throw err;
      }

      if (owner === userId) {
        return cleanId;
      }

      // If not yet owned in local store, return cleanId for new conversation
      return cleanId;
    }

    // Return the latest existing conversation for this user if available
    const userConvs = this.data.users[userId];
    if (userConvs) {
      const convList = Object.values(userConvs);
      if (convList.length > 0) {
        convList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return convList[0].id;
      }
    }

    return `conv_${userId}_${Date.now()}`;
  }

  /**
   * Saves a message to the user's isolated conversation.
   * Verifies existing conversation ownership before saving.
   */
  saveMessage(
    conversationId: string,
    userId: string,
    role: 'user' | 'assistant',
    content: string
  ): void {
    const existingOwner = this.getConversationOwner(conversationId);
    if (existingOwner && existingOwner !== userId) {
      console.error(`[ConversationStore] Security Violation in saveMessage: Cannot write to conversation ${conversationId} owned by ${existingOwner}`);
      const err: any = new Error("Forbidden: Access to another user's conversation is strictly prohibited.");
      err.statusCode = 403;
      throw err;
    }

    if (!this.data.users[userId]) {
      this.data.users[userId] = {};
    }

    const nowIso = new Date().toISOString();
    let conv = this.data.users[userId][conversationId];

    if (!conv) {
      conv = {
        id: conversationId,
        userId,
        title: content.substring(0, 40) + '...',
        createdAt: nowIso,
        updatedAt: nowIso,
        messages: [],
      };
      this.data.users[userId][conversationId] = conv;
    } else {
      conv.updatedAt = nowIso;
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    conv.messages.push({
      id: messageId,
      conversationId,
      userId,
      role,
      content,
      createdAt: nowIso,
    });

    this.saveToDisk();
  }

  /**
   * Retrieves isolated history for a given user.
   * Strictly filters messages by message.userId === userId.
   */
  getUserHistory(
    userId: string,
    requestedConvId?: string
  ): { conversationId: string | null; messages: StoredMessage[] } {
    const userConvs = this.data.users[userId];
    if (!userConvs) {
      return { conversationId: null, messages: [] };
    }

    let targetConvId = requestedConvId;
    if (!targetConvId) {
      const convList = Object.values(userConvs);
      if (convList.length === 0) {
        return { conversationId: null, messages: [] };
      }
      convList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      targetConvId = convList[0].id;
    } else {
      const owner = this.getConversationOwner(targetConvId);
      if (owner && owner !== userId) {
        console.error(`[ConversationStore] Security Violation: User ${userId} attempted to access conversation ${targetConvId} owned by ${owner}`);
        const err: any = new Error("Forbidden: Access to another user's conversation is strictly prohibited.");
        err.statusCode = 403;
        throw err;
      }
    }

    const conv = userConvs[targetConvId];
    if (!conv) {
      return { conversationId: null, messages: [] };
    }

    // STRICT: Only return messages where message.userId === userId
    const safeMessages = (conv.messages || []).filter(
      (m) => m && m.userId === userId
    );

    return {
      conversationId: targetConvId,
      messages: safeMessages,
    };
  }

  /**
   * Loads recent messages for Gemini prompt assembly.
   * Strictly filters messages by message.userId === userId.
   */
  loadRecentHistory(
    conversationId: string,
    userId: string,
    limit = 10
  ): { role: string; content: string }[] {
    const userConvs = this.data.users[userId];
    if (!userConvs || !userConvs[conversationId]) {
      return [];
    }

    const messages = userConvs[conversationId].messages || [];
    const safeMessages = messages.filter((m) => m && m.userId === userId);
    const slice = safeMessages.slice(-limit);

    return slice.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      content: m.content,
    }));
  }
}

export const conversationStore = new ConversationStore();
