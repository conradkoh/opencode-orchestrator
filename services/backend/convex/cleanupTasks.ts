import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';

// Public interfaces and types
export interface CleanupResult {
  success: boolean;
  deletedCount: number;
}

export interface LoginRequestsCleanupResult extends CleanupResult {
  deletedLoginCount: number;
  deletedConnectCount: number;
}

export interface StaleWorkersCleanupResult extends CleanupResult {
  markedOfflineCount: number;
  affectedMachineIds: string[];
}

export interface AllCleanupResults {
  success: boolean;
  results: {
    loginRequests: LoginRequestsCleanupResult;
    loginCodes: CleanupResult;
    staleWorkers: StaleWorkersCleanupResult;
  };
}

/**
 * Cleanup task for expired login requests.
 * This can be called periodically to clean up expired OAuth login requests.
 */
export const cleanupExpiredLoginRequests = internalMutation({
  args: {},
  handler: async (ctx, _args): Promise<LoginRequestsCleanupResult> => {
    const now = Date.now();

    // Find expired login requests that haven't been completed
    const expiredLoginRequests = await ctx.db
      .query('auth_loginRequests')
      .filter((q) => q.and(q.lt(q.field('expiresAt'), now), q.neq(q.field('status'), 'completed')))
      .collect();

    // Find expired connect requests that haven't been completed
    const expiredConnectRequests = await ctx.db
      .query('auth_connectRequests')
      .filter((q) => q.and(q.lt(q.field('expiresAt'), now), q.neq(q.field('status'), 'completed')))
      .collect();

    // Delete expired login requests
    let deletedLoginCount = 0;
    for (const request of expiredLoginRequests) {
      await ctx.db.delete(request._id);
      deletedLoginCount++;
    }

    // Delete expired connect requests
    let deletedConnectCount = 0;
    for (const request of expiredConnectRequests) {
      await ctx.db.delete(request._id);
      deletedConnectCount++;
    }

    const totalDeleted = deletedLoginCount + deletedConnectCount;

    return {
      success: true,
      deletedCount: totalDeleted,
      deletedLoginCount,
      deletedConnectCount,
    };
  },
});

/**
 * Cleanup task for expired connect requests.
 * This can be called periodically to clean up expired OAuth connect requests.
 *
 * @deprecated Use cleanupExpiredLoginRequests instead - it now handles both login and connect requests
 */
export const cleanupExpiredConnectRequests = internalMutation({
  args: {},
  handler: async (ctx, _args): Promise<CleanupResult> => {
    const now = Date.now();

    // Find expired connect requests that haven't been completed
    const expiredConnectRequests = await ctx.db
      .query('auth_connectRequests')
      .filter((q) => q.and(q.lt(q.field('expiresAt'), now), q.neq(q.field('status'), 'completed')))
      .collect();

    // Delete expired connect requests
    let deletedCount = 0;
    for (const request of expiredConnectRequests) {
      await ctx.db.delete(request._id);
      deletedCount++;
    }

    return {
      success: true,
      deletedCount,
    };
  },
});

/**
 * Cleanup task for expired login codes.
 * This can be called periodically to clean up expired login codes.
 */
export const cleanupExpiredLoginCodes = internalMutation({
  args: {},
  handler: async (ctx, _args): Promise<CleanupResult> => {
    const now = Date.now();

    // Find expired login codes
    const expiredCodes = await ctx.db
      .query('loginCodes')
      .filter((q) => q.lt(q.field('expiresAt'), now))
      .collect();

    // Delete expired codes
    let deletedCount = 0;
    for (const code of expiredCodes) {
      await ctx.db.delete(code._id);
      deletedCount++;
    }

    return {
      success: true,
      deletedCount,
    };
  },
});

/**
 * Detect workers with stale heartbeats and mark them offline.
 * A worker is considered stale if its lastHeartbeat is older than 90 seconds.
 * This is 3x the heartbeat interval (30s) to allow for network delays.
 */
export const detectStaleWorkers = internalMutation({
  args: {},
  handler: async (ctx, _args): Promise<StaleWorkersCleanupResult> => {
    const now = Date.now();
    const STALE_THRESHOLD_MS = 90_000; // 90 seconds
    const staleTimestamp = now - STALE_THRESHOLD_MS;

    // Find workers marked as online with stale heartbeats
    const staleWorkers = await ctx.db
      .query('workers')
      .filter((q) =>
        q.and(
          q.eq(q.field('status'), 'online'),
          q.or(
            // lastHeartbeat is too old
            q.lt(q.field('lastHeartbeat'), staleTimestamp),
            // lastHeartbeat doesn't exist (shouldn't happen but handle it)
            q.eq(q.field('lastHeartbeat'), undefined)
          )
        )
      )
      .collect();

    const affectedMachineIds = new Set<string>();
    let markedOfflineCount = 0;

    // Mark stale workers as offline
    for (const worker of staleWorkers) {
      await ctx.db.patch(worker._id, {
        status: 'offline',
        lastHeartbeat: now, // Update timestamp to prevent repeated processing
      });
      affectedMachineIds.add(worker.machineId);
      markedOfflineCount++;
    }

    // Update machine statuses for all affected machines
    for (const machineId of affectedMachineIds) {
      await ctx.scheduler.runAfter(0, internal.machines.updateMachineStatus, {
        machineId,
      });
    }

    return {
      success: true,
      deletedCount: 0, // Not deleting, just updating status
      markedOfflineCount,
      affectedMachineIds: Array.from(affectedMachineIds),
    };
  },
});

/**
 * Master cleanup function that runs all cleanup tasks.
 */
export const runAllCleanupTasks = internalMutation({
  args: {},
  handler: async (ctx, _args): Promise<AllCleanupResults> => {
    const results = {
      loginRequests: await ctx.runMutation(internal.cleanupTasks.cleanupExpiredLoginRequests, {}),
      loginCodes: await ctx.runMutation(internal.cleanupTasks.cleanupExpiredLoginCodes, {}),
      staleWorkers: await ctx.runMutation(internal.cleanupTasks.detectStaleWorkers, {}),
    };

    return {
      success: true,
      results,
    };
  },
});

// Internal helper functions
/**
 * Registers cron jobs for automatic cleanup of expired authentication data.
 */
const _registerCleanupCronJobs = (): typeof cleanupCronJobs => {
  const cleanupCronJobs = cronJobs();

  // Run cleanup every 10 minutes
  cleanupCronJobs.interval(
    'cleanup expired auth data',
    { minutes: 10 },
    internal.cleanupTasks.runAllCleanupTasks
  );

  // Run stale worker detection every 2 minutes for faster offline detection
  cleanupCronJobs.interval(
    'detect stale workers',
    { minutes: 2 },
    internal.cleanupTasks.detectStaleWorkers
  );

  return cleanupCronJobs;
};

// Register cron jobs for automatic cleanup
const cleanupCronJobs = _registerCleanupCronJobs();

export default cleanupCronJobs;
