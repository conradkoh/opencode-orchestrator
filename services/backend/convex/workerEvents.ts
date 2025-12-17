import { query } from './_generated/server';

/**
 * Stream of events for the worker to process.
 * This is a simple table-based event stream that workers can subscribe to.
 */
export const workerEventStream = query({
  args: {},
  handler: async (_ctx) => {
    // For now, return an empty array
    // In the future, this will query from a workerEvents table
    return [];
  },
});
