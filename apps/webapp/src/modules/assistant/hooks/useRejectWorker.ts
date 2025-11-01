'use client';

import { api } from '@workspace/backend/convex/_generated/api';
import { useSessionMutation } from 'convex-helpers/react/sessions';
import { useCallback, useState } from 'react';
import type { RejectWorkerReturn } from '../types';

/**
 * Hook for rejecting pending worker authorization requests.
 *
 * @returns RejectWorkerReturn with rejectWorker function and loading state
 * @example
 * ```typescript
 * const { rejectWorker, isRejecting, error } = useRejectWorker();
 * const handleReject = async (workerId: string) => {
 *   try {
 *     await rejectWorker(workerId);
 *     console.log("Worker rejected");
 *   } catch (err) {
 *     console.error("Failed:", err);
 *   }
 * };
 * ```
 */
export function useRejectWorker(): RejectWorkerReturn {
  const rejectWorkerMutation = useSessionMutation(api.workers.reject);
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Rejects a pending worker authorization request.
   */
  const rejectWorker = useCallback(
    async (workerId: string): Promise<void> => {
      setIsRejecting(true);
      setError(null);

      try {
        await rejectWorkerMutation({ workerId });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to reject worker');
        setError(error);
        throw error;
      } finally {
        setIsRejecting(false);
      }
    },
    [rejectWorkerMutation]
  );

  return {
    rejectWorker,
    isRejecting,
    error,
  };
}
