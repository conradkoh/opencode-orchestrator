'use client';

import { api } from '@workspace/backend/convex/_generated/api';
import { useSessionMutation } from 'convex-helpers/react/sessions';
import { nanoid } from 'nanoid';
import { useCallback, useState } from 'react';
import type { CreateMachineReturn, MachineRegistration } from '../types';

/**
 * Hook for creating new machines using Convex backend.
 * Generates machine ID client-side using nanoid.
 * Note: Machines no longer have authentication tokens - workers authenticate individually.
 *
 * @returns CreateMachineReturn with createMachine function and loading state
 * @example
 * ```typescript
 * const { createMachine, isCreating, error } = useCreateMachine();
 * const handleCreate = async () => {
 *   try {
 *     const registration = await createMachine("My Machine");
 *     console.log("Machine created:", registration.machineId);
 *   } catch (err) {
 *     console.error("Failed:", err);
 *   }
 * };
 * ```
 */
export function useCreateMachine(): CreateMachineReturn {
  const createMachineMutation = useSessionMutation(api.machines.create);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Creates a new machine with the given name.
   * Generates a machine ID client-side.
   */
  const createMachine = useCallback(
    async (name: string): Promise<MachineRegistration> => {
      setIsCreating(true);
      setError(null);

      try {
        // Generate machine ID client-side
        const machineId = nanoid();

        // Call Convex mutation
        const result = await createMachineMutation({
          machineId,
          name,
        });

        return {
          machineId: result.machineId,
          name: result.name,
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create machine');
        setError(error);
        throw error;
      } finally {
        setIsCreating(false);
      }
    },
    [createMachineMutation]
  );

  return {
    createMachine,
    isCreating,
    error,
  };
}
