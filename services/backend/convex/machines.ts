import { v } from 'convex/values';
import { SessionIdArg } from 'convex-helpers/server/sessions';
import { getAuthUserOptional } from '../modules/auth/getAuthUser';
import { mutation, query } from './_generated/server';

/**
 * Create a new machine registration.
 * Called from the web UI when user adds a new machine.
 *
 * @param machineId - Client-generated nanoid
 * @param secret - Client-generated nanoid for authentication
 * @param name - User-friendly machine name
 * @returns Machine registration info with combined token
 */
export const create = mutation({
  args: {
    ...SessionIdArg,
    machineId: v.string(),
    secret: v.string(),
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
      secret: args.secret,
      name: args.name,
      status: 'offline',
      lastHeartbeat: Date.now(),
      userId: user._id,
    });

    // Return registration info
    return {
      machineId: args.machineId,
      token: `${args.machineId}:${args.secret}`,
    };
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
    const machines = await ctx.db.query('machines').collect();

    // Filter by userId (TODO: add index for better performance)
    const userMachines = machines.filter((m) => m.userId === user._id);

    // Map to frontend format
    return userMachines.map((machine) => ({
      machineId: machine.machineId,
      name: machine.name,
      status: machine.status,
      lastSeen: machine.lastHeartbeat,
      assistantCount: 0, // TODO: Count from workers table when implemented
    }));
  },
});
