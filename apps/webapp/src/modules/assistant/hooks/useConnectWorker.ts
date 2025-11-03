/**
 * Hook to request worker connection and opencode initialization.
 * Call this when user selects a worker to trigger opencode startup.
 */

import { api } from '@workspace/backend/convex/_generated/api';
import { useMutation } from 'convex/react';
import { useCallback, useState } from 'react';

export type WorkerConnectionError = {
  code: 'WORKER_OFFLINE' | 'UNKNOWN';
  message: string;
};

export type WorkerConnectionResult = {
  success: boolean;
  error?: WorkerConnectionError;
};

/**
 * Hook to connect a worker (initialize opencode and fetch models).
 *
 * @returns Function to request worker connection and connection state
 */
export function useConnectWorker() {
  const connectMutation = useMutation(api.workers.requestConnect);
  const [connectionError, setConnectionError] = useState<WorkerConnectionError | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWorker = useCallback(
    async (workerId: string): Promise<WorkerConnectionResult> => {
      try {
        setIsConnecting(true);
        setConnectionError(null);
        console.log('[useConnectWorker] Requesting connection for worker:', workerId);
        const result = await connectMutation({ workerId });
        console.log('[useConnectWorker] Connection requested:', result);

        // Check if backend returned an error response (graceful failure)
        if ('success' in result && !result.success && 'error' in result) {
          const error: WorkerConnectionError = {
            code: result.error as 'WORKER_OFFLINE',
            message: result.message || 'Failed to connect to worker',
          };
          setConnectionError(error);
          return { success: false, error };
        }

        // Success
        setConnectionError(null);
        return { success: true };
      } catch (error) {
        console.error('[useConnectWorker] Failed to request connection:', error);
        const workerError: WorkerConnectionError = {
          code: 'UNKNOWN',
          message: error instanceof Error ? error.message : 'Failed to connect to worker',
        };
        setConnectionError(workerError);
        return { success: false, error: workerError };
      } finally {
        setIsConnecting(false);
      }
    },
    [connectMutation]
  );

  const clearError = useCallback(() => {
    setConnectionError(null);
  }, []);

  return { connectWorker, connectionError, isConnecting, clearError };
}
