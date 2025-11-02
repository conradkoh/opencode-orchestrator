/**
 * Hook to request worker connection and opencode initialization.
 * Call this when user selects a worker to trigger opencode startup.
 */

import { api } from '@workspace/backend/convex/_generated/api';
import { useMutation } from 'convex/react';
import { useCallback } from 'react';

/**
 * Hook to connect a worker (initialize opencode and fetch models).
 *
 * @returns Function to request worker connection
 */
export function useConnectWorker() {
  const connectMutation = useMutation(api.workers.requestConnect);

  const connectWorker = useCallback(
    async (workerId: string) => {
      try {
        console.log('[useConnectWorker] Requesting connection for worker:', workerId);
        const result = await connectMutation({ workerId });
        console.log('[useConnectWorker] Connection requested:', result);
        return result;
      } catch (error) {
        console.error('[useConnectWorker] Failed to request connection:', error);
        throw error;
      }
    },
    [connectMutation]
  );

  return { connectWorker };
}
