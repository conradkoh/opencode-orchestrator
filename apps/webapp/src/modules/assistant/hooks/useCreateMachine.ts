'use client';

import { useSessionMutation } from 'convex-helpers/react/sessions';
import { nanoid } from 'nanoid';
import { useCallback, useState } from 'react';
import { api } from '@/convex/_generated/api';
import type { CreateMachineReturn, MachineRegistration } from '../types';

/**
 * Hook for creating new machines using Convex backend.
 * Generates machine ID and secret client-side using nanoid.
 *
 * @returns CreateMachineReturn with createMachine function and loading state
 * @example
 * ```typescript
 * const { createMachine, isCreating, error } = useCreateMachine();
 * const handleCreate = async () => {
 *   try {
 *     const registration = await createMachine("My Machine");
 *     console.log("Token:", registration.token);
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
   * Generates a machine ID and secret, then returns the registration token.
   */
  const createMachine = useCallback(
    async (name: string): Promise<MachineRegistration> => {
      setIsCreating(true);
      setError(null);

      try {
        // Generate machine ID and secret client-side
        const machineId = nanoid();
        const secret = nanoid();

        // Call Convex mutation
        const result = await createMachineMutation({
          machineId,
          secret,
          name,
        });

        return {
          machineId: result.machineId,
          token: result.token,
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
