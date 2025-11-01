'use client';

import { api } from '@workspace/backend/convex/_generated/api';
import { useSessionQuery } from 'convex-helpers/react/sessions';
import type { WorkersData } from '../types';

/**
 * Hook for fetching all workers for a machine from Convex backend.
 * Automatically subscribes to real-time updates.
 *
 * @param machineId - ID of the machine to fetch workers for
 * @returns WorkersData with workers array and loading state
 * @example
 * ```typescript
 * const { workers, loading, error } = useWorkers("machine_abc123");
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 * return <div>{workers?.length} workers</div>;
 * ```
 */
export function useWorkers(machineId: string): WorkersData {
  const workers = useSessionQuery(api.workers.list, { machineId }) ?? undefined;
  const loading = workers === undefined;

  return {
    workers,
    loading,
    error: null,
  };
}
