import { v } from 'convex/values';
import { SessionIdArg } from 'convex-helpers/server/sessions';
import { getAuthUserOptional } from '../modules/auth/getAuthUser';
import { internal } from './_generated/api';
import { mutation, query } from './_generated/server';

/**
 * Create a new worker token.
 * Called from the web UI when user adds a new worker to a machine.
 *
 * @param machineId - Parent machine ID
 * @param workerId - Client-generated nanoid
 * @param name - Optional user-friendly name
 * @returns Worker registration info with token
 */
export const create = mutation({
  args: {
    ...SessionIdArg,
    machineId: v.string(),
    workerId: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      throw new Error('Unauthorized: Must be logged in to create a worker');
    }

    // Verify machine exists and user owns it
    const machine = await ctx.db
      .query('machines')
      .withIndex('by_machine_id', (q) => q.eq('machineId', args.machineId))
      .first();

    if (!machine) {
      throw new Error('Machine not found');
    }

    if (machine.userId !== user._id) {
      throw new Error('Unauthorized: You do not own this machine');
    }

    // Check if worker ID already exists
    const existing = await ctx.db
      .query('workers')
      .withIndex('by_machine_and_worker', (q) =>
        q.eq('machineId', args.machineId).eq('workerId', args.workerId)
      )
      .first();

    if (existing) {
      throw new Error('Worker ID already exists. Please try again.');
    }

    // Create worker record with pending approval status
    await ctx.db.insert('workers', {
      workerId: args.workerId,
      machineId: args.machineId,
      name: args.name,
      approvalStatus: 'pending',
      status: 'offline',
      createdAt: Date.now(),
    });

    // Return registration info
    return {
      workerId: args.workerId,
      token: `machine_${args.machineId}:worker_${args.workerId}`,
    };
  },
});

/**
 * Register a worker and check authorization status.
 * Called by the worker process on startup.
 *
 * @param machineId - Machine ID from token
 * @param workerId - Worker ID from token
 * @returns Authorization status and worker info
 */
export const register = mutation({
  args: {
    machineId: v.string(),
    workerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find worker by machine ID and worker ID
    const worker = await ctx.db
      .query('workers')
      .withIndex('by_machine_and_worker', (q) =>
        q.eq('machineId', args.machineId).eq('workerId', args.workerId)
      )
      .first();

    if (!worker) {
      throw new Error('Worker not found. Please check your worker token.');
    }

    // Check if already approved (approval status is independent of operational status)
    if (worker.approvalStatus === 'approved') {
      // Update to online
      await ctx.db.patch(worker._id, {
        status: 'online',
        lastHeartbeat: Date.now(),
      });

      // Update machine status
      await ctx.scheduler.runAfter(0, internal.machines.updateMachineStatus, {
        machineId: args.machineId,
      });

      return {
        approvalStatus: 'approved' as const,
        status: 'online' as const,
        approved: true,
        workerId: worker.workerId,
        name: worker.name,
      };
    }

    // Still pending authorization
    return {
      approvalStatus: 'pending' as const,
      status: 'offline' as const,
      approved: false,
      workerId: worker.workerId,
      name: worker.name,
    };
  },
});

/**
 * Approve a pending worker authorization request.
 * Called from the web UI when user approves a worker.
 *
 * @param workerId - Worker to approve
 */
export const approve = mutation({
  args: {
    ...SessionIdArg,
    workerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      throw new Error('Unauthorized: Must be logged in to approve workers');
    }

    // Find worker
    const worker = await ctx.db
      .query('workers')
      .withIndex('by_worker_id', (q) => q.eq('workerId', args.workerId))
      .first();

    if (!worker) {
      throw new Error('Worker not found');
    }

    // Verify user owns the machine
    const machine = await ctx.db
      .query('machines')
      .withIndex('by_machine_id', (q) => q.eq('machineId', worker.machineId))
      .first();

    if (!machine || machine.userId !== user._id) {
      throw new Error('Unauthorized: You do not own this machine');
    }

    // Update worker approval status to approved
    await ctx.db.patch(worker._id, {
      approvalStatus: 'approved',
      approvedAt: Date.now(),
      approvedBy: user._id,
    });

    return { success: true };
  },
});

/**
 * Reject a pending worker authorization request.
 * Called from the web UI when user rejects a worker.
 *
 * @param workerId - Worker to reject
 */
export const reject = mutation({
  args: {
    ...SessionIdArg,
    workerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      throw new Error('Unauthorized: Must be logged in to reject workers');
    }

    // Find worker
    const worker = await ctx.db
      .query('workers')
      .withIndex('by_worker_id', (q) => q.eq('workerId', args.workerId))
      .first();

    if (!worker) {
      throw new Error('Worker not found');
    }

    // Verify user owns the machine
    const machine = await ctx.db
      .query('machines')
      .withIndex('by_machine_id', (q) => q.eq('machineId', worker.machineId))
      .first();

    if (!machine || machine.userId !== user._id) {
      throw new Error('Unauthorized: You do not own this machine');
    }

    // Delete the worker
    await ctx.db.delete(worker._id);

    return { success: true };
  },
});

/**
 * List all workers for a machine.
 *
 * @param machineId - Machine ID to list workers for
 * @returns Array of workers
 */
export const list = query({
  args: {
    ...SessionIdArg,
    machineId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      return [];
    }

    // Verify user owns the machine
    const machine = await ctx.db
      .query('machines')
      .withIndex('by_machine_id', (q) => q.eq('machineId', args.machineId))
      .first();

    if (!machine || machine.userId !== user._id) {
      return [];
    }

    // Get all workers for this machine
    const workers = await ctx.db
      .query('workers')
      .withIndex('by_machine_id', (q) => q.eq('machineId', args.machineId))
      .collect();

    return workers.map((worker) => ({
      workerId: worker.workerId,
      machineId: worker.machineId,
      name: worker.name,
      approvalStatus: worker.approvalStatus,
      status: worker.status,
      createdAt: worker.createdAt,
      approvedAt: worker.approvedAt,
      lastHeartbeat: worker.lastHeartbeat,
    }));
  },
});

/**
 * List pending workers for a machine.
 *
 * @param machineId - Machine ID to list pending workers for
 * @returns Array of pending workers
 */
export const listPending = query({
  args: {
    ...SessionIdArg,
    machineId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      return [];
    }

    // Verify user owns the machine
    const machine = await ctx.db
      .query('machines')
      .withIndex('by_machine_id', (q) => q.eq('machineId', args.machineId))
      .first();

    if (!machine || machine.userId !== user._id) {
      return [];
    }

    // Get pending workers for this machine
    const workers = await ctx.db
      .query('workers')
      .withIndex('by_machine_and_approval_status', (q) =>
        q.eq('machineId', args.machineId).eq('approvalStatus', 'pending')
      )
      .collect();

    return workers.map((worker) => ({
      workerId: worker.workerId,
      machineId: worker.machineId,
      name: worker.name,
      approvalStatus: worker.approvalStatus as 'pending',
      status: worker.status,
      createdAt: worker.createdAt,
    }));
  },
});

/**
 * Update worker heartbeat to maintain online status.
 * Called periodically by the worker process.
 *
 * @param machineId - Machine ID from token
 * @param workerId - Worker ID from token
 */
export const heartbeat = mutation({
  args: {
    machineId: v.string(),
    workerId: v.string(),
  },
  handler: async (ctx, args) => {
    const worker = await ctx.db
      .query('workers')
      .withIndex('by_machine_and_worker', (q) =>
        q.eq('machineId', args.machineId).eq('workerId', args.workerId)
      )
      .first();

    if (!worker) {
      throw new Error('Unauthorized: Worker not found');
    }

    // Only update heartbeat if worker is approved
    if (worker.approvalStatus === 'approved') {
      await ctx.db.patch(worker._id, {
        status: 'online',
        lastHeartbeat: Date.now(),
      });

      // Update machine status
      await ctx.scheduler.runAfter(0, internal.machines.updateMachineStatus, {
        machineId: args.machineId,
      });
    }
  },
});

/**
 * Update worker status to offline.
 * Called by the worker process on graceful shutdown.
 *
 * @param machineId - Machine ID from token
 * @param workerId - Worker ID from token
 */
export const setOffline = mutation({
  args: {
    machineId: v.string(),
    workerId: v.string(),
  },
  handler: async (ctx, args) => {
    const worker = await ctx.db
      .query('workers')
      .withIndex('by_machine_and_worker', (q) =>
        q.eq('machineId', args.machineId).eq('workerId', args.workerId)
      )
      .first();

    if (!worker) {
      return; // Worker doesn't exist, nothing to update
    }

    // Update status to offline
    await ctx.db.patch(worker._id, {
      status: 'offline',
      lastHeartbeat: Date.now(),
    });

    // Update machine status
    await ctx.scheduler.runAfter(0, internal.machines.updateMachineStatus, {
      machineId: args.machineId,
    });
  },
});

/**
 * Delete a worker.
 * Called from the web UI when user removes a worker.
 *
 * @param workerId - Worker to delete
 */
export const remove = mutation({
  args: {
    ...SessionIdArg,
    workerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      throw new Error('Unauthorized: Must be logged in to remove workers');
    }

    // Find worker
    const worker = await ctx.db
      .query('workers')
      .withIndex('by_worker_id', (q) => q.eq('workerId', args.workerId))
      .first();

    if (!worker) {
      throw new Error('Worker not found');
    }

    // Verify user owns the machine
    const machine = await ctx.db
      .query('machines')
      .withIndex('by_machine_id', (q) => q.eq('machineId', worker.machineId))
      .first();

    if (!machine || machine.userId !== user._id) {
      throw new Error('Unauthorized: You do not own this machine');
    }

    // Delete worker
    await ctx.db.delete(worker._id);

    // Update machine status
    await ctx.scheduler.runAfter(0, internal.machines.updateMachineStatus, {
      machineId: worker.machineId,
    });

    return { success: true };
  },
});

/**
 * Signal that a worker should connect and initialize opencode.
 * Called from frontend when user selects a worker.
 * Sets a flag that the worker subscription will pick up.
 *
 * @param workerId - Worker ID to connect
 * @returns Success status
 */
export const requestConnect = mutation({
  args: {
    workerId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('[workers.requestConnect] Connect request for worker:', args.workerId);

    // Verify worker exists
    const worker = await ctx.db
      .query('workers')
      .withIndex('by_worker_id', (q) => q.eq('workerId', args.workerId))
      .first();

    if (!worker) {
      throw new Error('Worker not found');
    }

    // Verify worker is approved and online
    if (worker.approvalStatus !== 'approved') {
      throw new Error('Worker is not approved');
    }

    if (worker.status !== 'online') {
      throw new Error('Worker is not online');
    }

    // Update worker with connect request timestamp
    // Worker will see this and initialize opencode
    await ctx.db.patch(worker._id, {
      lastHeartbeat: Date.now(), // Trigger subscription update
    });

    console.log('[workers.requestConnect] Connect request sent');
    return { success: true, workerId: args.workerId };
  },
});
