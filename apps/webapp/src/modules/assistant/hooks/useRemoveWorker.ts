import { api } from '@workspace/backend/convex/_generated/api';
import { useSessionMutation } from 'convex-helpers/react/sessions';
import { useCallback, useState } from 'react';
import type { RemoveWorkerReturn } from '../types';

/**
 * Hook for removing a worker.
 *
 * @returns Object with removeWorker function, loading state, and error
 *
 * @example
 * ```typescript
 * const { removeWorker, isRemoving, error } = useRemoveWorker();
 *
 * const handleRemove = async () => {
 *   try {
 *     await removeWorker('worker_abc123');
 *   } catch (error) {
 *     console.error('Failed to remove worker:', error);
 *   }
 * };
 * ```
 */
export function useRemoveWorker(): RemoveWorkerReturn {
  const removeWorkerMutation = useSessionMutation(api.workers.remove);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const removeWorker = useCallback(
    async (workerId: string): Promise<void> => {
      setIsRemoving(true);
      setError(null);

      try {
        await removeWorkerMutation({ workerId });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsRemoving(false);
      }
    },
    [removeWorkerMutation]
  );

  return {
    removeWorker,
    isRemoving,
    error,
  };
}
