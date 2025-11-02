import { v } from 'convex/values';
import { SessionIdArg } from 'convex-helpers/server/sessions';
import { getAuthUserOptional } from '../modules/auth/getAuthUser';
import { internalMutation, mutation, query } from './_generated/server';

/**
 * Create a new machine registration.
 * Called from the web UI when user adds a new machine.
 * Note: Machines no longer have authentication tokens - workers authenticate individually.
 *
 * @param machineId - Client-generated nanoid
 * @param name - User-friendly machine name
 * @returns Machine registration info
 */
export const create = mutation({
  args: {
    ...SessionIdArg,
    machineId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      throw new Error('Unauthorized: Must be logged in to create a machine');
    }

    // Check if machine ID already exists
    const existing = await ctx.db
      .query('machines')
      .withIndex('by_machine_id', (q) => q.eq('machineId', args.machineId))
      .first();

    if (existing) {
      throw new Error('Machine ID already exists. Please try again.');
    }

    // Create machine record
    await ctx.db.insert('machines', {
      machineId: args.machineId,
      name: args.name,
      status: 'offline',
      lastHeartbeat: Date.now(),
      userId: user._id,
    });

    // Return registration info
    return {
      machineId: args.machineId,
      name: args.name,
    };
  },
});

/**
 * Update machine status based on worker activity.
 * Machine status is automatically derived from worker states.
 * This is called internally when workers update their status.
 *
 * @param machineId - Machine identifier
 */
export const updateMachineStatus = internalMutation({
  args: {
    machineId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find machine by ID
    const machine = await ctx.db
      .query('machines')
      .withIndex('by_machine_id', (q) => q.eq('machineId', args.machineId))
      .first();

    if (!machine) {
      return; // Machine doesn't exist, nothing to update
    }

    // Check if any workers are online
    const workers = await ctx.db
      .query('workers')
      .withIndex('by_machine_id', (q) => q.eq('machineId', args.machineId))
      .collect();

    const hasOnlineWorkers = workers.some((w) => w.status === 'online');

    // Update machine status
    await ctx.db.patch(machine._id, {
      status: hasOnlineWorkers ? 'online' : 'offline',
      lastHeartbeat: Date.now(),
    });
  },
});

/**
 * Delete a machine by ID.
 * Only the owner can delete their machine.
 *
 * @param machineId - ID of the machine to delete
 */
export const deleteMachine = mutation({
  args: {
    ...SessionIdArg,
    machineId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      throw new Error('Unauthorized: Must be logged in to delete a machine');
    }

    // Find the machine
    const machine = await ctx.db
      .query('machines')
      .withIndex('by_machine_id', (q) => q.eq('machineId', args.machineId))
      .first();

    if (!machine) {
      throw new Error('Machine not found');
    }

    // Verify ownership
    if (machine.userId !== user._id) {
      throw new Error('Unauthorized: You can only delete your own machines');
    }

    // Delete the machine
    await ctx.db.delete(machine._id);
  },
});

/**
 * List all machines for the current user.
 * Returns machines with their status and basic info.
 *
 * @returns Array of machines owned by the current user
 */
export const list = query({
  args: {
    ...SessionIdArg,
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      return [];
    }

    // Get all machines for this user
    const machines = await ctx.db
      .query('machines')
      .withIndex('by_user_id', (q) => q.eq('userId', user._id))
      .collect();

    // Get worker counts for each machine
    const machinesWithCounts = await Promise.all(
      machines.map(async (machine) => {
        const workers = await ctx.db
          .query('workers')
          .withIndex('by_machine_id', (q) => q.eq('machineId', machine.machineId))
          .collect();

        // Count workers by status
        const onlineCount = workers.filter((w) => w.status === 'online').length;
        const offlineCount = workers.filter((w) => w.status === 'offline').length;
        const pendingCount = workers.filter((w) => w.approvalStatus === 'pending').length;

        return {
          machineId: machine.machineId,
          name: machine.name,
          status: machine.status,
          lastSeen: machine.lastHeartbeat,
          assistantCount: workers.length, // Keep for backward compatibility
          workerCounts: {
            online: onlineCount,
            offline: offlineCount,
            pending: pendingCount,
          },
        };
      })
    );

    return machinesWithCounts;
  },
});
