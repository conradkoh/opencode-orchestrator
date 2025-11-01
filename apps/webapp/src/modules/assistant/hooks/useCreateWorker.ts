'use client';

import { api } from '@workspace/backend/convex/_generated/api';
import { useSessionMutation } from 'convex-helpers/react/sessions';
import { nanoid } from 'nanoid';
import { useCallback, useState } from 'react';
import type { CreateWorkerReturn, WorkerRegistration } from '../types';

/**
 * Hook for creating new workers using Convex backend.
 * Generates worker ID client-side using nanoid.
 *
 * @returns CreateWorkerReturn with createWorker function and loading state
 * @example
 * ```typescript
 * const { createWorker, isCreating, error } = useCreateWorker();
 * const handleCreate = async () => {
 *   try {
 *     const registration = await createWorker("machine_abc123", "My Worker");
 *     console.log("Worker token:", registration.token);
 *   } catch (err) {
 *     console.error("Failed:", err);
 *   }
 * };
 * ```
 */
export function useCreateWorker(): CreateWorkerReturn {
  const createWorkerMutation = useSessionMutation(api.workers.create);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Creates a new worker for the specified machine.
   * Generates a worker ID client-side and returns the worker token.
   */
  const createWorker = useCallback(
    async (machineId: string, name?: string): Promise<WorkerRegistration> => {
      setIsCreating(true);
      setError(null);

      try {
        // Generate worker ID client-side
        const workerId = nanoid();

        // Call Convex mutation
        const result = await createWorkerMutation({
          machineId,
          workerId,
          name,
        });

        return {
          workerId: result.workerId,
          token: result.token,
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create worker');
        setError(error);
        throw error;
      } finally {
        setIsCreating(false);
      }
    },
    [createWorkerMutation]
  );

  return {
    createWorker,
    isCreating,
    error,
  };
}
