/**
 * Worker Models Management
 * Handles storing and retrieving available AI models for each worker.
 */

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

/**
 * Update the list of available models for a worker.
 * Called by worker when opencode client initializes.
 */
export const updateModels = mutation({
  args: {
    workerId: v.string(),
    models: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        provider: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    console.log('[updateModels] Updating models for worker:', args.workerId);
    console.log('[updateModels] Models:', JSON.stringify(args.models, null, 2));

    // Check if worker exists
    const worker = await ctx.db
      .query('workers')
      .withIndex('by_worker_id', (q) => q.eq('workerId', args.workerId))
      .first();

    if (!worker) {
      throw new Error(`Worker ${args.workerId} not found`);
    }

    // Check if models record exists
    const existing = await ctx.db
      .query('workerModels')
      .withIndex('by_worker_id', (q) => q.eq('workerId', args.workerId))
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        models: args.models,
        updatedAt: Date.now(),
      });
      console.log('[updateModels] Updated existing models record');
    } else {
      // Create new record
      await ctx.db.insert('workerModels', {
        workerId: args.workerId,
        models: args.models,
        updatedAt: Date.now(),
      });
      console.log('[updateModels] Created new models record');
    }

    return { success: true };
  },
});

/**
 * Get available models for a worker.
 * Used by frontend to populate model selector.
 */
export const getModels = query({
  args: {
    workerId: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query('workerModels')
      .withIndex('by_worker_id', (q) => q.eq('workerId', args.workerId))
      .first();

    if (!record) {
      return null;
    }

    return {
      models: record.models,
      updatedAt: record.updatedAt,
    };
  },
});

/**
 * Subscribe to model updates for a worker.
 * Real-time subscription for frontend.
 */
export const subscribeToModels = query({
  args: {
    workerId: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query('workerModels')
      .withIndex('by_worker_id', (q) => q.eq('workerId', args.workerId))
      .first();

    if (!record) {
      return null;
    }

    return {
      models: record.models,
      updatedAt: record.updatedAt,
    };
  },
});
