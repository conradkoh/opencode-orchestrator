'use client';

import { api } from '@workspace/backend/convex/_generated/api';
import { useSessionMutation } from 'convex-helpers/react/sessions';
import { useCallback, useState } from 'react';

/**
 * Return type for useDeleteMachine hook.
 */
export interface DeleteMachineReturn {
  /** Function to delete a machine by ID */
  deleteMachine: (machineId: string) => Promise<void>;
  /** Whether a delete operation is in progress */
  isDeleting: boolean;
  /** Error from last delete attempt, if any */
  error: Error | null;
}

/**
 * Hook for deleting machines using Convex backend.
 *
 * @returns DeleteMachineReturn with deleteMachine function and state
 * @example
 * ```typescript
 * const { deleteMachine, isDeleting, error } = useDeleteMachine();
 * const handleDelete = async (id: string) => {
 *   try {
 *     await deleteMachine(id);
 *     console.log("Machine deleted");
 *   } catch (err) {
 *     console.error("Failed:", err);
 *   }
 * };
 * ```
 */
export function useDeleteMachine(): DeleteMachineReturn {
  const deleteMachineMutation = useSessionMutation(api.machines.deleteMachine);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Deletes a machine by ID.
   */
  const deleteMachine = useCallback(
    async (machineId: string): Promise<void> => {
      setIsDeleting(true);
      setError(null);

      try {
        await deleteMachineMutation({ machineId });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete machine');
        setError(error);
        throw error;
      } finally {
        setIsDeleting(false);
      }
    },
    [deleteMachineMutation]
  );

  return {
    deleteMachine,
    isDeleting,
    error,
  };
}
