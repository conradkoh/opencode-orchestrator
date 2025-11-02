/**
 * Hook to subscribe to available models for a worker.
 * Returns the list of AI models that the worker can use.
 */

import { api } from '@workspace/backend/convex/_generated/api';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';
import type { WorkerModelsData } from '../types';

/**
 * Subscribe to available models for a worker.
 * Models are fetched from opencode when the worker starts up.
 *
 * @param workerId - ID of the worker to get models for
 * @returns Worker models data with loading state
 */
export function useWorkerModels(workerId: string | null): WorkerModelsData {
  const data = useQuery(api.workerModels.subscribeToModels, workerId ? { workerId } : 'skip');

  // Log when models are received
  useEffect(() => {
    if (data?.models) {
      console.log(
        `[useWorkerModels] Received ${data.models.length} models for worker ${workerId}:`
      );
      for (const model of data.models) {
        console.log(`[useWorkerModels]   - ${model.id} (${model.provider}): ${model.name}`);
      }
    }
  }, [data?.models, workerId]);

  return {
    models: data?.models ?? null,
    updatedAt: data?.updatedAt ?? null,
    loading: data === undefined,
  };
}
