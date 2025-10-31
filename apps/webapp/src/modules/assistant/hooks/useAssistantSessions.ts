'use client';

import { useEffect, useState } from 'react';
import type { ChatSession } from '../types';

/**
 * Return type for useAssistantSessions hook.
 */
interface _AssistantSessionsReturn {
  /** Array of chat sessions for the assistant */
  sessions: ChatSession[];
  /** Whether the fetch operation is in progress */
  loading: boolean;
}

/**
 * Mock hook for fetching chat sessions for an assistant.
 * Returns all sessions (active, idle, terminated) that belong to the assistant.
 * TODO: Replace with actual Convex query using useSessionQuery
 *
 * @param assistantId - ID of the assistant to fetch sessions for, or null to fetch none
 * @returns Object containing sessions array and loading state
 * @example
 * ```typescript
 * const { sessions, loading } = useAssistantSessions("assistant_001");
 * if (loading) return <Loading />;
 * return <SessionList sessions={sessions} />;
 * ```
 */
export function useAssistantSessions(assistantId: string | null): _AssistantSessionsReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!assistantId) {
      setSessions([]);
      return;
    }

    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      // Mock data - return some existing sessions
      setSessions([
        {
          sessionId: 'session_abc123',
          assistantId,
          model: 'claude-sonnet-4-5',
          status: 'idle',
          createdAt: Date.now() - 3600000, // 1 hour ago
        },
        {
          sessionId: 'session_def456',
          assistantId,
          model: 'claude-opus-4',
          status: 'idle',
          createdAt: Date.now() - 86400000, // 1 day ago
        },
        {
          sessionId: 'session_ghi789',
          assistantId,
          model: 'gpt-4',
          status: 'terminated',
          createdAt: Date.now() - 172800000, // 2 days ago
        },
      ]);
      setLoading(false);
    }, 300);
  }, [assistantId]);

  return {
    sessions,
    loading,
  };
}
