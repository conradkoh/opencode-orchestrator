'use client';

import { api } from '@workspace/backend/convex/_generated/api';
import { useSessionQuery } from 'convex-helpers/react/sessions';
import type { ChatSession } from '../types';

/**
 * Return type for useAssistantSessions hook.
 */
interface _AssistantSessionsReturn {
  /** Array of chat sessions for the worker */
  sessions: ChatSession[];
  /** Whether the fetch operation is in progress */
  loading: boolean;
}

/**
 * Hook for fetching chat sessions for a worker.
 * Returns all sessions (active, idle, terminated) that belong to the worker.
 *
 * @param workerId - ID of the worker to fetch sessions for, or null to fetch none
 * @returns Object containing sessions array and loading state
 * @example
 * ```typescript
 * const { sessions, loading } = useAssistantSessions("worker_001");
 * if (loading) return <Loading />;
 * return <SessionList sessions={sessions} />;
 * ```
 */
export function useAssistantSessions(workerId: string | null): _AssistantSessionsReturn {
  const sessions = useSessionQuery(api.chat.listSessions, workerId ? { workerId } : 'skip');

  return {
    sessions: sessions ?? [],
    loading: sessions === undefined,
  };
}
