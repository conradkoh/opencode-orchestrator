'use client';

import { api } from '@workspace/backend/convex/_generated/api';
import { useSessionMutation } from 'convex-helpers/react/sessions';
import { useCallback, useState } from 'react';
import type { ApproveWorkerReturn } from '../types';

/**
 * Hook for approving pending worker authorization requests.
 *
 * @returns ApproveWorkerReturn with approveWorker function and loading state
 * @example
 * ```typescript
 * const { approveWorker, isApproving, error } = useApproveWorker();
 * const handleApprove = async (workerId: string) => {
 *   try {
 *     await approveWorker(workerId);
 *     console.log("Worker approved");
 *   } catch (err) {
 *     console.error("Failed:", err);
 *   }
 * };
 * ```
 */
export function useApproveWorker(): ApproveWorkerReturn {
  const approveWorkerMutation = useSessionMutation(api.workers.approve);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Approves a pending worker authorization request.
   */
  const approveWorker = useCallback(
    async (workerId: string): Promise<void> => {
      setIsApproving(true);
      setError(null);

      try {
        await approveWorkerMutation({ workerId });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to approve worker');
        setError(error);
        throw error;
      } finally {
        setIsApproving(false);
      }
    },
    [approveWorkerMutation]
  );

  return {
    approveWorker,
    isApproving,
    error,
  };
}
