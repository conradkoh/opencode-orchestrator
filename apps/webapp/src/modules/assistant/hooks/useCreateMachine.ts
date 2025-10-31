'use client';

import { useCallback, useState } from 'react';
import type { CreateMachineReturn, MachineRegistration } from '../types';

/**
 * Mock hook for creating new machines.
 * TODO: Replace with actual Convex mutation using useSessionMutation
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
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Creates a new machine with the given name.
   * Generates a machine ID and secret, then returns the registration token.
   */
  const createMachine = useCallback(async (_name: string): Promise<MachineRegistration> => {
    setIsCreating(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock response with nanoid-style IDs
      const machineId = `mch_${Math.random().toString(36).substring(2, 15)}`;
      const secret = `sec_${Math.random().toString(36).substring(2, 15)}`;
      const token = `${machineId}:${secret}`;

      return {
        machineId,
        token,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create machine');
      setError(error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return {
    createMachine,
    isCreating,
    error,
  };
}
