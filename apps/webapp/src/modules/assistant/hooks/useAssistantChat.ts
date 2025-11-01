'use client';

import { api } from '@workspace/backend/convex/_generated/api';
import { useSessionMutation, useSessionQuery } from 'convex-helpers/react/sessions';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AssistantChatReturn, ChatMessage, ChatSession } from '../types';

/**
 * Hook for managing chat sessions with a worker.
 * Handles session lifecycle (start, restore, end) and message sending with streaming support.
 *
 * @param workerId - ID of the worker to chat with, or null if none selected
 * @returns AssistantChatReturn with session management, messaging, and state
 * @example
 * ```typescript
 * const { session, startSession, sendMessage, messages } = useAssistantChat("worker_001");
 *
 * // Start a new session
 * await startSession("claude-sonnet-4-5");
 *
 * // Send a message
 * await sendMessage("Hello!");
 * ```
 */
export function useAssistantChat(workerId: string | null): AssistantChatReturn {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Mutations
  const startSessionMutation = useSessionMutation(api.chat.startSession);
  const endSessionMutation = useSessionMutation(api.chat.endSession);
  const sendMessageMutation = useSessionMutation(api.chat.sendMessage);

  // Queries
  const sessionData = useSessionQuery(
    api.chat.getSession,
    activeSessionId ? { sessionId: activeSessionId } : 'skip'
  );

  const messagesData = useSessionQuery(
    api.chat.subscribeToMessages,
    activeSessionId ? { sessionId: activeSessionId } : 'skip'
  );

  // Convert session data to ChatSession type
  const session = useMemo<ChatSession | null>(() => {
    console.log('[useAssistantChat] Session data:', { activeSessionId, sessionData });
    if (!sessionData) return null;
    return {
      sessionId: sessionData.sessionId,
      workerId: sessionData.workerId,
      model: sessionData.model,
      status: sessionData.status,
      createdAt: sessionData.createdAt,
      lastActivity: sessionData.lastActivity,
    };
  }, [sessionData, activeSessionId]);

  // Convert messages data to ChatMessage type and handle streaming
  const messages = useMemo<ChatMessage[]>(() => {
    if (!messagesData) return [];

    return messagesData.map((msg) => ({
      id: msg.id,
      sessionId: msg.sessionId,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      completed: msg.completed,
      isStreaming: !msg.completed && msg.role === 'assistant',
    }));
  }, [messagesData]);

  // Subscribe to chunks for streaming messages
  const streamingMessage = useMemo(() => {
    return messages.find((msg) => msg.isStreaming);
  }, [messages]);

  const chunksData = useSessionQuery(
    api.chat.subscribeToChunks,
    streamingMessage && activeSessionId
      ? { sessionId: activeSessionId, messageId: streamingMessage.id }
      : 'skip'
  );

  // Update streaming message content with chunks
  const messagesWithChunks = useMemo<ChatMessage[]>(() => {
    if (!streamingMessage || !chunksData || chunksData.length === 0) {
      return messages;
    }

    // Assemble chunks into content
    const chunkContent = chunksData.map((c) => c.chunk).join('');

    return messages.map((msg) =>
      msg.id === streamingMessage.id ? { ...msg, content: chunkContent } : msg
    );
  }, [messages, streamingMessage, chunksData]);

  /**
   * Starts a new chat session with the specified model.
   */
  const startSession = useCallback(
    async (model: string): Promise<string> => {
      if (!workerId) throw new Error('No worker selected');

      setIsLoading(true);
      setError(null);

      try {
        console.log('[useAssistantChat] Starting session with:', { workerId, model });
        const sessionId = await startSessionMutation({ workerId, model });
        console.log('[useAssistantChat] Session started:', sessionId);
        setActiveSessionId(sessionId);
        return sessionId;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[useAssistantChat] Error starting session:', error);
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [workerId, startSessionMutation]
  );

  /**
   * Restores an existing session by its ID.
   * Loads previous messages and reactivates the session.
   */
  const restoreSession = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!workerId) throw new Error('No worker selected');

      setIsLoading(true);
      setError(null);

      try {
        // Just set the active session ID - queries will load the data
        setActiveSessionId(sessionId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [workerId]
  );

  /**
   * Ends the current active session and clears messages.
   */
  const endSession = useCallback(async () => {
    if (!activeSessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      await endSessionMutation({ sessionId: activeSessionId });
      setActiveSessionId(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId, endSessionMutation]);

  /**
   * Sends a message to the active session.
   * The response will be streamed via subscriptions.
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeSessionId) throw new Error('No active session');

      setIsLoading(true);
      setError(null);

      try {
        // Send message - backend will create user message and assistant placeholder
        await sendMessageMutation({ sessionId: activeSessionId, content });
        // Worker will receive notification and start processing
        // Chunks will arrive via subscribeToChunks subscription
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [activeSessionId, sendMessageMutation]
  );

  // Clear active session when worker changes
  useEffect(() => {
    if (workerId) {
      setActiveSessionId(null);
    }
  }, [workerId]);

  return {
    session,
    startSession,
    restoreSession,
    endSession,
    messages: messagesWithChunks,
    sendMessage,
    isLoading,
    error,
  };
}
