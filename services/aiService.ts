import { api } from './api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  userId?: string;
  isError?: boolean;
}

export interface ChatResponse {
  message: string;
  conversationId: string;
  usage?: {
    model: string;
  };
  rateLimited?: boolean;
}

export const aiService = {
  /**
   * Sends a chat prompt to the trusted backend /api/v1/ai/chat
   * Automatically passes Firebase Auth Bearer token via ApiClient
   */
  async sendMessage(message: string, conversationId?: string): Promise<ChatResponse> {
    const trimmed = message.trim();
    if (!trimmed) {
      throw new Error('Message cannot be empty.');
    }

    try {
      const response = await api.post<ChatResponse>('/api/v1/ai/chat', {
        message: trimmed,
        conversationId,
      });
      return response;
    } catch (err: any) {
      console.warn('[aiService] Chat request failed:', err?.message);
      const msg = err?.message || 'MahaSetu AI is temporarily unavailable. Please try again shortly.';
      throw new Error(msg);
    }
  },

  /**
   * Fetches isolated chat history for the authenticated user from the backend
   */
  async getHistory(conversationId?: string): Promise<{ conversationId: string | null; messages: ChatMessage[] }> {
    try {
      const endpoint = conversationId
        ? `/api/v1/ai/history?conversationId=${encodeURIComponent(conversationId)}`
        : '/api/v1/ai/history';
      const res = await api.get<{ conversationId: string | null; messages: any[] }>(endpoint);
      return {
        conversationId: res.conversationId,
        messages: (res.messages || []).map((m: any) => ({
          id: m.id || `msg_${Date.now()}_${Math.random()}`,
          role: m.role,
          content: m.content,
          createdAt: new Date(m.createdAt),
          userId: m.userId,
        })),
      };
    } catch (err: any) {
      console.warn('[aiService] Failed to load chat history:', err?.message);
      return { conversationId: null, messages: [] };
    }
  },
};
