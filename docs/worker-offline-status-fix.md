# Worker Offline Status Fix - Summary

## Overview

This document summarizes the comprehensive fix for the issue where workers showed as "online" in the UI even after going offline.

## Problems Addressed

### 1. Stale Worker Detection
**Problem**: When workers crashed or lost connectivity, they stopped sending heartbeats but remained marked as "online" indefinitely.

**Solution**: Implemented automated stale worker detection:
- Cron job runs every 2 minutes
- Detects workers with heartbeats older than 90 seconds
- Automatically marks them as offline
- Updates machine status accordingly

### 2. Graceful Shutdown
**Problem**: Workers didn't properly handle termination signals, leaving them marked as "online" after shutdown.

**Solution**: Enhanced signal handling:
- Comprehensive signal handlers (SIGTERM, SIGINT, SIGQUIT, SIGHUP)
- Proper cleanup of chat sessions
- Immediate database update to mark worker offline
- 10-second timeout to force exit if cleanup hangs
- Uncaught exception/rejection handlers

## Implementation Details

### Backend Changes

#### `services/backend/convex/cleanupTasks.ts`

**New Function**: `detectStaleWorkers()`
```typescript
export const detectStaleWorkers = internalMutation({
  args: {},
  handler: async (ctx, _args): Promise<StaleWorkersCleanupResult>
})
```

**What it does**:
1. Queries all workers with status="online"
2. Filters for stale heartbeats (>90 seconds old)
3. Marks stale workers as offline
4. Triggers machine status updates

**Cron Schedule**: Every 2 minutes

**Timing Configuration**:
- Worker heartbeat interval: 30 seconds
- Stale threshold: 90 seconds (3x heartbeat)
- Cleanup interval: 2 minutes
- Max offline detection: ~3.5 minutes worst case

### Worker Service Changes

#### `services/worker/src/application/ChatSessionManager.ts`

**New Function**: `disconnectAll()`
```typescript
async disconnectAll(): Promise<void>
```

**What it does**:
1. Closes all active chat sessions
2. Cleans up opencode client
3. Logs progress for each session

#### `services/worker/src/application/stateHandlers/ShutdownHandler.ts`

**Updated**: Now calls `chatManager.disconnectAll()`
- Proper cleanup order: sessions → convex → exit
- Best-effort cleanup with error logging

#### `services/worker/src/index.ts`

**Enhanced shutdown function**:
```typescript
const shutdown = async (signal: string) => {
  // Prevent duplicate shutdowns
  // Set 10-second timeout
  // Clean up resources
  // Exit with appropriate code
}
```

**Signal Handlers Added**:
- `SIGINT` - Ctrl+C in terminal
- `SIGTERM` - Kill command
- `SIGQUIT` - Quit with core dump
- `SIGHUP` - Terminal closed
- `uncaughtException` - Unhandled sync errors
- `unhandledRejection` - Unhandled async errors

**Features**:
- Prevents multiple concurrent shutdown attempts
- 10-second timeout forces exit if cleanup hangs
- Logs which signal triggered shutdown
- Proper exit codes (0 = success, 1 = error)

## Offline Detection Comparison

| Scenario | Before | After | Detection Time |
|----------|--------|-------|----------------|
| Graceful shutdown (Ctrl+C) | Never | Immediate | <2 seconds |
| Kill command | Never | Immediate | <2 seconds |
| Terminal closed | Never | Immediate | <2 seconds |
| Process crash | Never | Stale detection | 2-3.5 minutes |
| Force kill (SIGKILL) | Never | Stale detection | 2-3.5 minutes |
| Network loss | Never | Stale detection | 2-3.5 minutes |

## Testing

### Manual Test Cases

1. **Normal Shutdown (Ctrl+C)**
   ```bash
   pnpm start
   # Wait for startup
   # Press Ctrl+C
   # ✅ Should see "Graceful shutdown completed"
   # ✅ UI should show worker offline immediately
   ```

2. **Kill Command**
   ```bash
   pnpm start &
   PID=$!
   kill $PID
   # ✅ Should see graceful shutdown in logs
   # ✅ Worker offline immediately
   ```

3. **Force Kill** (uses stale detection)
   ```bash
   pnpm start &
   PID=$!
   kill -9 $PID  # Cannot be caught
   # Wait 2-3 minutes
   # ✅ Stale detection marks worker offline
   ```

4. **Crash Simulation**
   ```bash
   # Start worker
   # Force a crash (e.g., invalid operation)
   # Wait 2-3 minutes
   # ✅ Stale detection marks worker offline
   ```

### Verification Steps

After each test:
1. Check UI shows correct worker status
2. Check machine status updates correctly
3. Verify no orphaned processes remain
4. Confirm database shows correct status

## Architecture Benefits

### Defense in Depth

Two complementary mechanisms ensure accurate status:

1. **Primary**: Graceful shutdown with signal handlers
   - Fast response (<2 seconds)
   - Handles most common scenarios
   - Clean resource cleanup

2. **Fallback**: Stale detection with cron job
   - Catches cases where signals can't be sent
   - Automatically recovers from crashes
   - No user intervention needed

### Reliability Improvements

- **Before**: Workers could be stuck "online" indefinitely
- **After**: Maximum offline detection time is 3.5 minutes
- **User Experience**: UI accurately reflects worker state
- **System Health**: No resource leaks from improper shutdown

## Files Changed

### Backend
- ✅ `services/backend/convex/cleanupTasks.ts` - Added stale detection

### Worker
- ✅ `services/worker/src/index.ts` - Enhanced signal handling
- ✅ `services/worker/src/application/ChatSessionManager.ts` - Added disconnectAll
- ✅ `services/worker/src/application/stateHandlers/ShutdownHandler.ts` - Updated cleanup

### Documentation
- ✅ `codemaps/worker-stale-detection.codemap.md` - Stale detection design
- ✅ `codemaps/worker-graceful-shutdown.codemap.md` - Shutdown design
- ✅ `docs/worker-stale-detection.md` - Implementation summary
- ✅ `docs/worker-offline-status-fix.md` - This document

## Monitoring & Observability

### Metrics Available

The `detectStaleWorkers` function returns:
```typescript
{
  success: boolean;
  markedOfflineCount: number;  // Number of workers marked offline
  affectedMachineIds: string[]; // Which machines were affected
}
```

### What to Monitor

1. **Stale worker frequency**: High numbers indicate crashes/network issues
2. **Affected machines**: Identify problematic machines
3. **Graceful shutdown success rate**: Should be >95% in healthy systems
4. **Timeout occurrences**: Should be rare, indicates hanging cleanup

## Future Enhancements

### Stale Detection
1. Configurable thresholds per deployment
2. Alerts when workers frequently crash
3. Health dashboard showing worker uptime
4. Prometheus metrics for monitoring

### Graceful Shutdown
1. Configurable shutdown timeout
2. Plugin system for custom cleanup hooks
3. Send "shutting down" message to active chats
4. Health check endpoint during shutdown

## Related Documentation

- [Worker Stale Detection Codemap](../codemaps/worker-stale-detection.codemap.md)
- [Worker Graceful Shutdown Codemap](../codemaps/worker-graceful-shutdown.codemap.md)
- [Worker FSM Lifecycle](../codemaps/worker-fsm-lifecycle.codemap.md)
- [Worker Token Authentication](../codemaps/worker-token-authentication.codemap.md)






