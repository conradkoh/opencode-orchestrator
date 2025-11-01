'use client';

import { useSessionQuery } from 'convex-helpers/react/sessions';
import { api } from '@/convex/_generated/api';
import type { MachinesData } from '../types';

/**
 * Hook for fetching machines for the current user from Convex.
 * Uses real-time subscription to automatically update when machines change.
 *
 * @returns MachinesData containing machines array, loading state, and error
 * @example
 * ```typescript
 * const { machines, loading, error } = useMachines();
 * if (loading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 * return <MachineList machines={machines} />;
 * ```
 */
export function useMachines(): MachinesData {
  const machines = useSessionQuery(api.machines.list) ?? undefined;
  const loading = machines === undefined;

  return {
    machines,
    loading,
    error: null,
  };
}
