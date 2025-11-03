# Worker Stale Detection - Implementation Summary

## Problem

When a worker process goes offline unexpectedly (crash, network loss, force kill), it stops sending heartbeats but the database still shows it as "online". This causes the UI to incorrectly display workers and machines as online even though they are not.

## Root Cause

1. Workers send heartbeats every 30 seconds to maintain online status
2. When workers crash or lose connectivity, they can't send the final "setOffline" signal
3. There was NO automated cleanup job to detect stale heartbeats and mark workers offline
4. The UI queries show whatever status is in the database, which remains "online" indefinitely

## Solution

Implemented an automated cron job that:
- Runs every 2 minutes
- Detects workers with stale heartbeats (>90 seconds old)
- Marks them as offline in the database
- Updates machine status accordingly

## Implementation Details

### Timing Configuration

| Parameter | Value | Reasoning |
|-----------|-------|-----------|
| Heartbeat interval | 30 seconds | Balance between responsiveness and server load |
| Stale threshold | 90 seconds | 3x heartbeat interval to allow for network delays |
| Cleanup interval | 2 minutes | Fast enough detection without excessive queries |
| Max offline detection time | 3.5 minutes | Worst case: 90s threshold + 120s cleanup interval |

### Code Changes

**File**: `services/backend/convex/cleanupTasks.ts`

1. **Added new interface** `StaleWorkersCleanupResult`:
   - Tracks number of workers marked offline
   - Lists affected machine IDs for status updates

2. **New function** `detectStaleWorkers()`:
   - Queries all workers with status="online"
   - Filters for stale heartbeats (>90 seconds old)
   - Marks stale workers as offline
   - Triggers machine status updates for affected machines

3. **Updated** `runAllCleanupTasks()`:
   - Now includes stale worker detection in cleanup cycle

4. **Added cron job**:
   - Runs `detectStaleWorkers` every 2 minutes
   - Independent from the main cleanup cycle (10 minutes)

### Edge Cases Handled

1. **Worker with no lastHeartbeat**: Treated as stale and marked offline
2. **Multiple workers per machine**: Machine only marked offline when ALL workers are offline
3. **Worker restarts during cleanup window**: Fresh heartbeat prevents marking as stale
4. **Graceful shutdown**: Workers still call `setOffline` immediately, no need to wait for cleanup

## Testing

### Manual Testing Steps

1. Start a worker process and verify it shows as online
2. Force kill the worker (kill -9 or Ctrl+C)
3. Wait 2-3 minutes
4. Verify worker shows as offline in UI
5. If it was the last worker, verify machine also shows as offline

### Expected Behavior

- **Before**: Workers remained online indefinitely after crash
- **After**: Workers automatically marked offline within 2-3.5 minutes of last heartbeat

## Monitoring

The `detectStaleWorkers` function returns:
```typescript
{
  success: boolean;
  deletedCount: 0; // Not deleting, just updating status
  markedOfflineCount: number; // How many workers marked offline
  affectedMachineIds: string[]; // Which machines had status updates
}
```

This data can be logged or monitored to track:
- How often workers go stale (indicates crashes/network issues)
- Which machines are affected most frequently
- Overall worker reliability metrics

## Related Documentation

- [Worker FSM Lifecycle](../codemaps/worker-fsm-lifecycle.codemap.md)
- [Worker Token Authentication](../codemaps/worker-token-authentication.codemap.md)
- [Worker Stale Detection Codemap](../codemaps/worker-stale-detection.codemap.md)
- [Worker Graceful Shutdown](../codemaps/worker-graceful-shutdown.codemap.md)

## Future Improvements

1. **Configurable thresholds**: Make stale timeout configurable per deployment
2. **Alerts**: Notify users when workers frequently crash
3. **Health dashboard**: Track worker uptime and reliability
4. **Metrics**: Expose prometheus metrics for monitoring

