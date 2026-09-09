import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useAuth } from '../../store/AuthContext';
import { aiService, ChatMessage } from '../../services/aiService';

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUICK_ACTIONS = [
  'Track my application',
  'What is Submit Once?',
  'Explain verification',
  'Explain consent',
  'What happens next?',
];

const INITIAL_GREETING =
  "Hello! I'm MahaSetu AI, your digital assistant.\n\nI can help you understand your application, verification progress, consent, and how MahaSetu connects government services.";

const getStorageKey = (uid: string) => `@mahasetu_chat_history_${uid}`;
const getConvKey = (uid: string) => `@mahasetu_chat_conv_${uid}`;

export const MahaSetuAIAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const generationRef = useRef<number>(0);

  // STRICT USER ISOLATION: Wipe in-memory state whenever authenticated user changes or logs out!
  useEffect(() => {
    const activeUid = user?.uid || null;

    if (activeUid !== loadedUserId) {
      // Increment generation to instantly cancel and invalidate any in-flight load operations
      const loadGeneration = ++generationRef.current;

      // 1. Immediately wipe previous user's chat state from UI
      setModalVisible(false);
      setIsThinking(false);
      setMessages([]);
      setConversationId(undefined);
      setErrorMessage(null);
      setInputText('');
      setLoadedUserId(activeUid);

      if (!activeUid) {
        // User logged out
        return;
      }

      // 2. Load this specific user's isolated history
      const loadUserChat = async () => {
        // Check user-scoped local storage first
        try {
          const cachedJson = await AsyncStorage.getItem(getStorageKey(activeUid));
          if (loadGeneration !== generationRef.current) return;

          const cachedConv = await AsyncStorage.getItem(getConvKey(activeUid));
          if (loadGeneration !== generationRef.current) return;

          if (cachedJson) {
            const parsed = JSON.parse(cachedJson);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Strictly verify every cached message belongs to activeUid
              const verified = parsed.filter(
                (m: any) => m && m.content && (m.userId === activeUid || m.id === `msg_welcome_${activeUid}`)
              );
              if (verified.length > 0) {
                setMessages(verified.map((m: any) => ({ ...m, userId: activeUid, createdAt: new Date(m.createdAt) })));
                if (cachedConv) setConversationId(cachedConv);
                return;
              }
            }
          }
        } catch (err) {
          console.warn('[MahaSetuAI] Cache load warning:', err);
        }

        if (loadGeneration !== generationRef.current) return;

        // Fetch from backend /api/v1/ai/history
        try {
          const remote = await aiService.getHistory();
          if (loadGeneration !== generationRef.current) return;

          if (remote.messages && remote.messages.length > 0) {
            // Strictly enforce that all messages carry activeUid
            const userScopedMessages = remote.messages.map((m) => ({
              ...m,
              userId: activeUid,
            }));
            setMessages(userScopedMessages);
            if (remote.conversationId) {
              setConversationId(remote.conversationId);
              await AsyncStorage.setItem(getConvKey(activeUid), remote.conversationId);
            }
            await AsyncStorage.setItem(getStorageKey(activeUid), JSON.stringify(userScopedMessages));
          } else {
            // Fresh user-specific welcome message
            const welcomeMsg: ChatMessage = {
              id: `msg_welcome_${activeUid}`,
              role: 'assistant',
              content: INITIAL_GREETING,
              createdAt: new Date(),
              userId: activeUid,
            };
            setMessages([welcomeMsg]);
            await AsyncStorage.setItem(getStorageKey(activeUid), JSON.stringify([welcomeMsg]));
          }
        } catch (remoteErr) {
          if (loadGeneration === generationRef.current) {
            const welcomeMsg: ChatMessage = {
              id: `msg_welcome_${activeUid}`,
              role: 'assistant',
              content: INITIAL_GREETING,
              createdAt: new Date(),
              userId: activeUid,
            };
            setMessages([welcomeMsg]);
          }
        }
      };

      loadUserChat();
    }
  }, [user?.uid, loadedUserId]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (modalVisible) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isThinking, modalVisible]);

  // Floating button is only accessible for authenticated users
  if (!user) {
    return null;
  }

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text || isThinking || !user?.uid) return;

    const currentUid = user.uid;
    const sendGeneration = generationRef.current;
    setErrorMessage(null);
    setInputText('');

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date(),
      userId: currentUid,
    };

    const updatedAfterUser = [...messages, userMessage];
    setMessages(updatedAfterUser);
    setIsThinking(true);

    try {
      const response = await aiService.sendMessage(text, conversationId);

      // IN-FLIGHT RACE CONDITION GUARD (Requirement 15):
      // If the user changed accounts or logged out while Gemini was generating, DISCARD stale response!
      if (user?.uid !== currentUid || generationRef.current !== sendGeneration) {
        console.log('[MahaSetuAI] User switched accounts while Gemini was responding. Discarding stale response.');
        return;
      }

      let newConvId = conversationId;
      if (response.conversationId) {
        newConvId = response.conversationId;
        setConversationId(newConvId);
        await AsyncStorage.setItem(getConvKey(currentUid), newConvId);
      }

      const aiMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: response.message,
        createdAt: new Date(),
        userId: currentUid,
      };

      const finalMessages = [...updatedAfterUser, aiMessage];
      setMessages(finalMessages);

      // Persist strictly to user-scoped cache
      await AsyncStorage.setItem(getStorageKey(currentUid), JSON.stringify(finalMessages));
    } catch (err: any) {
      // If user switched accounts during error, discard error state
      if (user?.uid !== currentUid || generationRef.current !== sendGeneration) {
        return;
      }

      const fallbackMsg =
        err?.message || 'MahaSetu AI is temporarily unavailable. Please try again shortly.';
      setErrorMessage(fallbackMsg);

      const errMessage: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: fallbackMsg,
        createdAt: new Date(),
        userId: currentUid,
        isError: true,
      };

      const withError = [...updatedAfterUser, errMessage];
      setMessages(withError);
      await AsyncStorage.setItem(getStorageKey(currentUid), JSON.stringify(withError));
    } finally {
      if (user?.uid === currentUid && generationRef.current === sendGeneration) {
        setIsThinking(false);
      }
    }
  };

  const handleQuickAction = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const handleRetry = () => {
    if (messages.length >= 2) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      if (lastUserMsg) {
        handleSendMessage(lastUserMsg.content);
      }
    }
  };

  return (
    <>
      {/* Floating Action Button (Same general location as previous simulator) */}
      <TouchableOpacity
        style={[styles.floatingLauncher, { bottom: 75 + insets.bottom }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.88}
        accessibilityLabel="Open MahaSetu AI Assistant"
        accessibilityRole="button"
      >
        <View style={styles.fabIconWrapper}>
          <Ionicons name="sparkles" size={17} color="#FDE68A" />
        </View>
        <Text style={styles.floatingLauncherText}>MahaSetu AI</Text>
      </TouchableOpacity>

      {/* AI Assistant Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarContainer}>
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              </View>
              <View>
                <View style={styles.titleRow}>
                  <Text style={styles.headerTitle}>MahaSetu AI Assistant</Text>
                  <View style={styles.onlineBadge}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>Official</Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitle}>Your intelligent guide to MahaSetu</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setModalVisible(false)}
              accessibilityLabel="Close Assistant"
            >
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Chat Messages */}
          <KeyboardAvoidingView
            style={styles.chatArea}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollArea}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: insets.bottom + 16 },
              ]}
              keyboardShouldPersistTaps="handled"
            >
              {/* Quick Prompts Carousel at Top */}
              <View style={styles.quickPromptsSection}>
                <Text style={styles.quickPromptsHeading}>QUICK TOPICS</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickPromptsScroll}
                >
                  {QUICK_ACTIONS.map((prompt, idx) => (
                    <TouchableOpacity
                      key={`quick_${idx}`}
                      style={styles.quickPromptPill}
                      onPress={() => handleQuickAction(prompt)}
                      disabled={isThinking}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={13}
                        color={Colors.primary}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={styles.quickPromptText}>{prompt}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Message History */}
              {messages.map((item) => {
                const isUser = item.role === 'user';
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.messageRow,
                      isUser ? styles.messageRowUser : styles.messageRowAi,
                    ]}
                  >
                    {!isUser && (
                      <View style={styles.aiMessageAvatar}>
                        <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
                      </View>
                    )}
                    <View
                      style={[
                        styles.messageBubble,
                        isUser
                          ? styles.messageBubbleUser
                          : item.isError
                          ? styles.messageBubbleError
                          : styles.messageBubbleAi,
                      ]}
                    >
                      {!isUser && (
                        <Text style={styles.aiSenderLabel}>
                          MahaSetu AI • {item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.messageText,
                          isUser ? styles.messageTextUser : styles.messageTextAi,
                        ]}
                      >
                        {item.content}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Thinking / Typing State */}
              {isThinking && (
                <View style={[styles.messageRow, styles.messageRowAi]}>
                  <View style={styles.aiMessageAvatar}>
                    <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                  </View>
                  <View style={[styles.messageBubble, styles.messageBubbleAi, styles.thinkingBubble]}>
                    <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.thinkingText}>MahaSetu AI is thinking...</Text>
                  </View>
                </View>
              )}

              {/* Retry Button if last message had error */}
              {errorMessage && !isThinking && (
                <View style={styles.retryContainer}>
                  <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                    <Ionicons name="refresh" size={14} color={Colors.primary} />
                    <Text style={styles.retryBtnText}>Retry last question</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            {/* Input Bar */}
            <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TextInput
                style={styles.textInput}
                placeholder="Ask MahaSetu anything..."
                placeholderTextColor={Colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={2000}
                editable={!isThinking}
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!inputText.trim() || isThinking) && styles.sendBtnDisabled,
                ]}
                onPress={() => handleSendMessage()}
                disabled={!inputText.trim() || isThinking}
                accessibilityLabel="Send message"
              >
                {isThinking ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingLauncher: {
    position: 'absolute',
    right: 16,
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 4,
    paddingHorizontal: Spacing.md,
    gap: 8,
    shadowColor: Colors.shadowColor,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  fabIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingLauncherText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  avatarContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: BorderRadius.sm,
  },
  chatArea: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  quickPromptsSection: {
    marginBottom: Spacing.md,
  },
  quickPromptsHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 2,
  },
  quickPromptsScroll: {
    gap: 8,
  },
  quickPromptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  quickPromptText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    alignItems: 'flex-end',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAi: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  aiMessageAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.lg,
  },
  messageBubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleAi: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  messageBubbleError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  aiSenderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  messageText: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 21,
  },
  messageTextUser: {
    color: '#FFFFFF',
  },
  messageTextAi: {
    color: Colors.textPrimary,
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  thinkingText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  retryContainer: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  retryBtnText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
});
