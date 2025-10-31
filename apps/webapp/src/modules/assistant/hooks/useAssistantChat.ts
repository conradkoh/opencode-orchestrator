'use client';

import { useCallback, useState } from 'react';
import type { AssistantChatReturn, ChatMessage, ChatSession } from '../types';

/**
 * Mock hook for managing chat sessions with an assistant.
 * Handles session lifecycle (start, restore, end) and message sending with streaming support.
 * TODO: Replace with actual Convex queries and mutations
 *
 * @param assistantId - ID of the assistant to chat with, or null if none selected
 * @returns AssistantChatReturn with session management, messaging, and state
 * @example
 * ```typescript
 * const { session, startSession, sendMessage, messages } = useAssistantChat("assistant_001");
 *
 * // Start a new session
 * await startSession("claude-sonnet-4-5");
 *
 * // Send a message
 * await sendMessage("Hello!");
 * ```
 */
export function useAssistantChat(assistantId: string | null): AssistantChatReturn {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Starts a new chat session with the specified model.
   */
  const startSession = useCallback(
    async (model: string): Promise<string> => {
      if (!assistantId) throw new Error('No assistant selected');

      setIsLoading(true);
      try {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        const sessionId = `session_${Math.random().toString(36).substring(2, 15)}`;
        const newSession: ChatSession = {
          sessionId,
          assistantId,
          model,
          status: 'active',
          createdAt: Date.now(),
        };

        setSession(newSession);
        setMessages([
          {
            id: 'msg_system_001',
            role: 'system',
            content: `Session started with model ${model}. Ready to assist!`,
            timestamp: Date.now(),
          },
        ]);

        return sessionId;
      } finally {
        setIsLoading(false);
      }
    },
    [assistantId]
  );

  /**
   * Restores an existing session by its ID.
   * Loads previous messages and reactivates the session.
   */
  const restoreSession = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!assistantId) throw new Error('No assistant selected');

      setIsLoading(true);
      try {
        // Simulate API call to restore session
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Mock: restore session with some messages
        const restoredSession: ChatSession = {
          sessionId,
          assistantId,
          model: 'claude-sonnet-4-5', // Would come from API
          status: 'active',
          createdAt: Date.now() - 3600000, // Would come from API
        };

        setSession(restoredSession);
        // Mock: restore previous messages
        setMessages([
          {
            id: 'msg_restored_1',
            role: 'system',
            content: 'Session restored. Continuing previous conversation.',
            timestamp: Date.now() - 3600000,
          },
          {
            id: 'msg_restored_2',
            role: 'user',
            content: 'Previous message from this session...',
            timestamp: Date.now() - 3500000,
          },
          {
            id: 'msg_restored_3',
            role: 'assistant',
            content: 'Previous response from this session...',
            timestamp: Date.now() - 3400000,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [assistantId]
  );

  /**
   * Ends the current active session and clears messages.
   */
  const endSession = useCallback(async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 300));
      setSession(null);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Sends a message to the active session and streams the response.
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!session) throw new Error('No active session');

      setIsLoading(true);

      // Add user message
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        // Simulate streaming response
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Add assistant message with streaming effect
        const assistantMessageId = `msg_${Date.now()}_assistant`;
        const fullResponse =
          'This is a mock response. In the real implementation, this will be a streamed response from the assistant.';

        // Simulate streaming by adding chunks
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Stream characters
        for (let i = 0; i < fullResponse.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullResponse.slice(0, i + 1) }
                : msg
            )
          );
        }

        // Mark as complete
        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg))
        );
      } finally {
        setIsLoading(false);
      }
    },
    [session]
  );

  return {
    session,
    startSession,
    restoreSession,
    endSession,
    messages,
    sendMessage,
    isLoading,
    error: null,
  };
}
