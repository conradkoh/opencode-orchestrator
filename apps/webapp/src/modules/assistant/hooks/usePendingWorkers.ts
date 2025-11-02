'use client';

import { api } from '@workspace/backend/convex/_generated/api';
import { useSessionQuery } from 'convex-helpers/react/sessions';
import type { PendingWorkersData } from '../types';

/**
 * Hook for fetching pending workers for a machine from Convex backend.
 * Automatically subscribes to real-time updates.
 *
 * @param machineId - ID of the machine to fetch pending workers for
 * @returns PendingWorkersData with pending workers array and loading state
 * @example
 * ```typescript
 * const { workers, loading, error } = usePendingWorkers("machine_abc123");
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 * return <div>{workers?.length} pending workers</div>;
 * ```
 */
export function usePendingWorkers(machineId: string): PendingWorkersData {
  const workersData = useSessionQuery(api.workers.listPending, { machineId });
  const loading = workersData === undefined;

  // Map the data to match PendingWorker type (status should always be 'offline' for pending workers)
  const workers =
    workersData?.map((w) => ({
      ...w,
      status: 'offline' as const,
    })) ?? undefined;

  return {
    workers,
    loading,
    error: null,
  };
}
