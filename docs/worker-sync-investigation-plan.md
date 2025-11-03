# Worker Session Sync - Investigation & Remediation Plan

**Created**: 2025-01-03  
**Status**: 🔴 Critical Issues Identified  
**Related**: `codemaps/worker-session-sync.codemap.md`

## Executive Summary

Analysis of production logs reveals **4 critical performance and correctness issues** in worker session sync:

1. ⛔ **Model Fetch Storm**: 90 parallel CLI calls during sync (lines 360-449)
2. ⛔ **Unbounded Session Restoration**: 255 sessions loaded at once (lines 100-357)
3. ⛔ **Incomplete Message Retry Loop**: Failed messages retried indefinitely (lines 87-96)
4. ⚠️ **Sync Overload**: 100 operations executed immediately on startup (line 359)

**Impact**:

- Startup time: ~30-60 seconds with 255 sessions
- CPU spike: 90+ parallel shell processes
- Memory: Unbounded growth with session count
- Reliability: Failed messages never cleared

## Observed Behavior from Logs

### Timeline Breakdown

```
Line 1-35:   Worker starts, OpenCode server initializes (✅ Good)
Line 35:     First model fetch - ONCE (✅ Good)
Line 85:     📋 Marked 277 existing sessions as seen
Line 86:     📋 Marked 65 existing messages as processed
Line 87-96:  ⚠️ 3 incomplete messages attempted, all fail "worker is not ready"
Line 100:    🔄 Restoring 255 active sessions (❌ No limits)
Line 101:    📋 Found 345 existing OpenCode sessions
Line 102-357: Restoring ALL 255 sessions one by one
Line 358:    📊 Sync state: 345 OpenCode vs 255 Convex
Line 359:    ⚡ Executing 100 operations (❌ All at once)
Line 360-449: 🔥 90 PARALLEL "opencode models" CLI calls (❌ CRITICAL)
Line 450-456: Name updates completing
```

### Problem 1: Model Fetch Storm 🔥

**What's Happening**:

```typescript
// In ChatSessionManager.syncSessionsWithOpencode()
createSyncedSession: async (opencodeSessionId, title) => {
  // Infer model (default to first available model)
  const models = await this.opencodeAdapter.listModels(this.opencodeClient!);
  //                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                     CALLED 90 TIMES IN PARALLEL!
  const defaultModel = models.length > 0 ? models[0].id : "unknown";
  // ... create session
};
```

**Root Cause**: `createSyncedSession` calls `listModels()` for every new session being synced.

**Evidence**: Lines 360-449 show 90 consecutive model fetch calls.

**Impact**:

- 90+ parallel shell processes (`opencode models`)
- Each takes ~100-200ms
- CPU spike, potential rate limiting
- Completely unnecessary - models don't change

### Problem 2: Unbounded Session Restoration 📈

**What's Happening**:

```typescript
// In ChatSessionManager.restoreActiveSessions()
const convexSessions = await this.convexClient.getActiveSessions();
//                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                     Returns ALL 255 sessions at once

for (const convexSession of convexSessions) {
  // Process EVERY session immediately
}
```

**Evidence**: Lines 100-357 show all 255 sessions being restored.

**Impact**:

- O(N) memory growth
- O(N) startup time
- Will fail at ~1000+ sessions
- No user feedback during long restoration

### Problem 3: Incomplete Message Retry Loop ♻️

**What's Happening**:

```typescript
// In ConvexClientAdapter.startChatSubscriptions()
if (!messagesInitialized) {
  // Check for any incomplete assistant messages that need processing
  const incompleteAssistantMessages = messages.filter(
    (m) => m.role === "assistant" && !m.completed
  );

  if (incompleteAssistantMessages.length > 0) {
    // ATTEMPTS TO REPROCESS - but worker is not ready yet!
  }
}
```

**Evidence**: Lines 87-96 show 3 incomplete messages all failing with "worker is not ready".

**Impact**:

- Messages attempted before worker is fully initialized
- All fail because sessions aren't restored yet
- Same messages will retry on EVERY restart
- No cleanup mechanism - these messages are "stuck"

### Problem 4: Parallel Sync Overload ⚡

**What's Happening**:

```typescript
// All operations run in parallel
const operations: Promise<void>[] = [];

for (const update of plan.nameUpdates) {
  operations.push(/* update */);
}
for (const deletion of plan.deletions) {
  operations.push(/* delete */);
}
for (const newSession of plan.newSessions) {
  operations.push(/* create */); // Each calls listModels()!
}

await Promise.allSettled(operations); // All 100 at once!
```

**Evidence**: Line 359 shows "Executing 100 operations" followed immediately by 90 model fetches.

**Impact**:

- 100 concurrent database operations
- 90 concurrent CLI processes
- Network saturation
- Poor error handling (some may silently fail)

## Investigation Phase

### Phase 1: Confirm Root Causes (1 hour)

**Goal**: Verify each issue and quantify impact.

#### Task 1.1: Add Performance Metrics

```typescript
// Add to ChatSessionManager.restoreActiveSessions()
const startTime = performance.now();
console.log(`⏱️ Starting session restoration...`);

// After restoration
const duration = performance.now() - startTime;
console.log(
  `⏱️ Restored ${this.activeSessions.size} sessions in ${duration.toFixed(0)}ms`
);
```

**Where**: `services/worker/src/application/ChatSessionManager.ts:258`

#### Task 1.2: Add Model Fetch Counter

```typescript
// Add to OpencodeClientAdapter.listModels()
private static modelFetchCount = 0;

async listModels(...) {
  OpencodeClientAdapter.modelFetchCount++;
  console.log(`[MODEL FETCH #${OpencodeClientAdapter.modelFetchCount}] Fetching models`);
  // ... existing code
}
```

**Where**: `services/worker/src/infrastructure/opencode/OpencodeClientAdapter.ts:131`

#### Task 1.3: Track Incomplete Messages

```typescript
// Add to ConvexClientAdapter.startChatSubscriptions()
if (incompleteAssistantMessages.length > 0) {
  console.log(
    `⚠️ Found ${incompleteAssistantMessages.length} incomplete messages:`
  );
  for (const msg of incompleteAssistantMessages) {
    console.log(
      `   - ${msg.messageId} in session ${msg.sessionId} (age: ${
        Date.now() - msg.timestamp
      }ms)`
    );
  }
}
```

**Where**: `services/worker/src/infrastructure/convex/ConvexClientAdapter.ts:307`

**Deliverable**: Run worker with instrumentation, collect metrics.

### Phase 2: Reproduce & Measure (30 minutes)

#### Test Scenarios

1. **Cold Start with Many Sessions**

   - Stop worker
   - Ensure 250+ active sessions in DB
   - Start worker
   - Measure: startup time, peak memory, model fetch count

2. **Incomplete Message Accumulation**

   - Create incomplete assistant message in DB
   - Restart worker 3 times
   - Verify: message attempted each time

3. **Sync Storm**
   - Create 50 sessions in OpenCode directly
   - Wait for next sync (30s)
   - Measure: concurrent operations, model fetches

**Deliverable**: Quantified metrics for each issue.

## Remediation Phase

### Phase 3: Quick Wins (2-4 hours)

#### Fix 3.1: Cache Models in Memory ✅ HIGH IMPACT

**Problem**: 90 parallel model fetches during sync.

**Solution**: Cache models in `ChatSessionManager`.

```typescript
// In ChatSessionManager
private cachedModels: Array<{id: string, name: string, provider: string}> | null = null;
private modelsCacheTimestamp: number = 0;
private readonly MODELS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

private async getCachedModels(): Promise<Array<{id: string, name: string, provider: string}>> {
  const now = Date.now();

  // Return cache if valid
  if (this.cachedModels && (now - this.modelsCacheTimestamp) < this.MODELS_CACHE_TTL) {
    return this.cachedModels;
  }

  // Fetch and cache
  if (!this.opencodeClient) {
    throw new Error('OpenCode client not initialized');
  }

  this.cachedModels = await this.opencodeAdapter.listModels(this.opencodeClient);
  this.modelsCacheTimestamp = now;

  return this.cachedModels;
}
```

**Changes**:

1. Add cache fields to `ChatSessionManager`
2. Replace all `listModels()` calls with `getCachedModels()`
3. Invalidate cache on `connect()`

**Impact**: 90 CLI calls → 1 CLI call  
**Files**: `services/worker/src/application/ChatSessionManager.ts`  
**Effort**: 1 hour  
**Risk**: Low

#### Fix 3.2: Skip Incomplete Message Reprocessing ✅ MEDIUM IMPACT

**Problem**: Incomplete messages retried indefinitely on every restart.

**Solution**: Don't reprocess messages older than 5 minutes.

```typescript
// In ConvexClientAdapter.startChatSubscriptions()
if (!messagesInitialized) {
  for (const message of messages) {
    const messageKey = `${message.sessionId}:${message.messageId}`;

    // Mark ALL messages as processed on first load
    // Don't retry old incomplete messages
    processedMessages.add(messageKey);
  }

  console.log(
    `📋 Marked ${processedMessages.size} existing messages as processed`
  );
  console.log(
    `ℹ️  Note: Incomplete messages from before restart are not reprocessed`
  );

  messagesInitialized = true;
  return; // Don't attempt to reprocess anything
}
```

**Alternative** (if we want selective retry):

```typescript
// Only retry incomplete messages from last 5 minutes
const RETRY_WINDOW = 5 * 60 * 1000;
const cutoffTime = Date.now() - RETRY_WINDOW;

const recentIncomplete = messages.filter(
  (m) => m.role === "assistant" && !m.completed && m.timestamp > cutoffTime
);
```

**Impact**: Eliminates failed retry attempts  
**Files**: `services/worker/src/infrastructure/convex/ConvexClientAdapter.ts:287-310`  
**Effort**: 30 minutes  
**Risk**: Low (these messages were failing anyway)

#### Fix 3.3: Add Sync Operation Throttling ✅ MEDIUM IMPACT

**Problem**: 100 operations executed in parallel.

**Solution**: Batch operations in groups of 10.

```typescript
// In OpencodeConvexSync.executeSync()
async function executeBatched<T>(
  operations: (() => Promise<T>)[],
  batchSize: number = 10
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map((op) => op()));
    results.push(
      ...batchResults.map((r) => (r.status === "fulfilled" ? r.value : null))
    );

    // Small delay between batches
    if (i + batchSize < operations.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

// Replace Promise.allSettled(operations) with:
await executeBatched(
  [
    ...plan.nameUpdates.map(
      (u) => () => deps.updateSessionName(u.chatSessionId, u.newName)
    ),
    ...plan.deletions.map(
      (d) => () => deps.markSessionDeleted(d.chatSessionId)
    ),
    ...plan.newSessions.map(
      (s) => () => deps.createSyncedSession(s.opencodeSessionId, s.title)
    ),
  ],
  10
);
```

**Impact**: 100 parallel ops → 10 at a time  
**Files**: `services/worker/src/application/OpencodeConvexSync.ts:224-281`  
**Effort**: 1 hour  
**Risk**: Low

### Phase 4: Structural Fixes (4-8 hours)

#### Fix 4.1: Add Session Restoration Pagination ⚠️ BREAKING CHANGE

**Problem**: All 255 sessions loaded at once.

**Solution**: Lazy-load sessions on demand, or paginate with max limit.

**Option A: Lazy Loading (Recommended)**

```typescript
// In ChatSessionManager.restoreActiveSessions()
private async restoreActiveSessions(): Promise<void> {
  try {
    console.log('🔄 Session restoration: Sessions will be restored on-demand');

    // Get count only
    const convexSessions = await this.convexClient.getActiveSessions();
    console.log(`📋 Found ${convexSessions.length} active session(s) in database`);
    console.log(`ℹ️  Sessions will be restored when first message arrives`);

    // Don't restore anything - let messages trigger restoration
  } catch (error) {
    console.error('❌ Failed to check sessions:', error);
  }
}

// Add lazy restoration on message receipt
async processMessage(chatSessionId: ChatSessionId, messageId: string, content: string): Promise<void> {
  let session = this.activeSessions.get(chatSessionId);

  // Lazy restore if not in memory
  if (!session) {
    console.log(`🔄 Lazy restoring session ${chatSessionId}`);
    await this.restoreSingleSession(chatSessionId);
    session = this.activeSessions.get(chatSessionId);
  }

  // ... process message
}
```

**Option B: Paginated with Max Limit**

```typescript
// In ChatSessionManager.restoreActiveSessions()
private async restoreActiveSessions(): Promise<void> {
  const MAX_SESSIONS_TO_RESTORE = 50;

  try {
    const allSessions = await this.convexClient.getActiveSessions();
    console.log(`📋 Found ${allSessions.length} active session(s) to restore`);

    // Restore only most recent N sessions
    const sessionsToRestore = allSessions
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, MAX_SESSIONS_TO_RESTORE);

    console.log(`📋 Restoring ${sessionsToRestore.length} most recent sessions (limit: ${MAX_SESSIONS_TO_RESTORE})`);

    // ... restore only these sessions
  } catch (error) {
    console.error('❌ Failed to restore sessions:', error);
  }
}
```

**Impact**: Instant startup regardless of session count  
**Files**: `services/worker/src/application/ChatSessionManager.ts:258-350`  
**Effort**: 3 hours  
**Risk**: Medium (changes session lifecycle)

**Recommendation**: Start with Option B (max limit), then migrate to Option A (lazy loading) in next iteration.

#### Fix 4.2: Add Backend Pagination Support

**Problem**: `getActiveSessions` returns all sessions with no pagination.

**Solution**: Add pagination to backend query.

```typescript
// In services/backend/convex/chat.ts
export const getActiveSessions = query({
  args: {
    workerId: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100; // Default to 100

    let query = ctx.db
      .query("chatSessions")
      .withIndex("by_worker_and_status", (q) =>
        q.eq("workerId", args.workerId).eq("status", "active")
      )
      .order("desc"); // Most recent first

    if (args.cursor) {
      // Implement cursor-based pagination
      // For now, simple limit
    }

    const sessions = await query.take(limit);

    return {
      sessions: sessions.map((session) => ({
        chatSessionId: session.sessionId as ChatSessionId,
        // ... other fields
      })),
      hasMore: sessions.length === limit,
      nextCursor:
        sessions.length > 0 ? sessions[sessions.length - 1]._id : undefined,
    };
  },
});
```

**Impact**: Database query scales with limit, not total sessions  
**Files**: `services/backend/convex/chat.ts:342-368`  
**Effort**: 2 hours  
**Risk**: Low (backward compatible if limit is optional)

### Phase 5: Monitoring & Validation (2 hours)

#### Add Health Metrics

```typescript
// In ChatSessionManager
export interface SessionManagerHealth {
  activeSessionCount: number;
  modelsCached: boolean;
  modelsCacheAge: number;
  lastSyncTimestamp: number;
  timeSinceLastSync: number;
}

getHealth(): SessionManagerHealth {
  return {
    activeSessionCount: this.activeSessions.size,
    modelsCached: this.cachedModels !== null,
    modelsCacheAge: Date.now() - this.modelsCacheTimestamp,
    lastSyncTimestamp: this.lastSyncTimestamp || 0,
    timeSinceLastSync: this.lastSyncTimestamp ? Date.now() - this.lastSyncTimestamp : -1,
  };
}
```

#### Add Startup Summary

```typescript
// In WorkerLifecycleManager after reaching READY state
console.log("");
console.log("📊 Worker Startup Summary:");
console.log(`   ✅ State: ${this.getState()}`);
console.log(
  `   ✅ Active Sessions: ${this.chatManager?.getActiveSessions().length || 0}`
);
const health = this.chatManager?.getHealth();
if (health) {
  console.log(`   ✅ Models Cached: ${health.modelsCached ? "Yes" : "No"}`);
  console.log(`   ✅ Total Startup Time: ${Date.now() - startupTimestamp}ms`);
}
console.log("");
```

## Implementation Plan

### Sprint 1: Quick Wins (Priority 1) - 1 Day

| Task                          | Priority | Effort | Risk | Files                  |
| ----------------------------- | -------- | ------ | ---- | ---------------------- |
| 3.1: Cache Models             | P0       | 1h     | Low  | ChatSessionManager.ts  |
| 3.2: Skip Incomplete Messages | P0       | 30m    | Low  | ConvexClientAdapter.ts |
| 3.3: Throttle Sync Ops        | P1       | 1h     | Low  | OpencodeConvexSync.ts  |
| Phase 5: Add Metrics          | P1       | 2h     | Low  | Multiple               |

**Goal**: Eliminate immediate performance issues, add visibility.

### Sprint 2: Structural Fixes (Priority 2) - 2 Days

| Task                               | Priority | Effort | Risk | Files                 |
| ---------------------------------- | -------- | ------ | ---- | --------------------- |
| 4.1: Session Pagination (Option B) | P1       | 3h     | Med  | ChatSessionManager.ts |
| 4.2: Backend Pagination            | P2       | 2h     | Low  | chat.ts               |
| Testing & Validation               | P1       | 3h     | -    | All                   |

**Goal**: Make system scale to 1000+ sessions.

### Sprint 3: Optimization (Priority 3) - 1 Day

| Task                         | Priority | Effort | Risk | Files                 |
| ---------------------------- | -------- | ------ | ---- | --------------------- |
| 4.1: Lazy Loading (Option A) | P2       | 3h     | Med  | ChatSessionManager.ts |
| Incremental Sync             | P2       | 4h     | Med  | OpencodeConvexSync.ts |
| Performance Testing          | P1       | 2h     | -    | All                   |

**Goal**: Zero-time startup, optimal resource usage.

## Success Metrics

### Before (Current State)

- Startup time: ~30-60s with 255 sessions
- Model fetches: 90+ parallel CLI calls
- Peak CPU: High (90+ processes)
- Memory: O(N) with all sessions
- Failed message retries: 3 per restart (infinite)

### After Sprint 1 (Quick Wins)

- Startup time: ~15-30s with 255 sessions ✅
- Model fetches: 1 CLI call ✅
- Peak CPU: Low (1 process) ✅
- Memory: O(N) with all sessions (unchanged)
- Failed message retries: 0 ✅

### After Sprint 2 (Structural Fixes)

- Startup time: ~5-10s regardless of session count ✅
- Model fetches: 1 CLI call ✅
- Peak CPU: Low ✅
- Memory: O(1) - constant, max 50 sessions ✅
- Failed message retries: 0 ✅
- Scale: Supports 1000+ sessions ✅

### After Sprint 3 (Optimization)

- Startup time: <2s ✅
- Model fetches: 1 CLI call ✅
- Peak CPU: Minimal ✅
- Memory: O(active) - only active sessions ✅
- Failed message retries: 0 ✅
- Scale: Unlimited sessions ✅

## Testing Strategy

### Unit Tests

- Model cache TTL behavior
- Batched operation execution
- Session restoration limits

### Integration Tests

- Cold start with 0, 10, 100, 500 sessions
- Incomplete message handling
- Sync operation throttling
- Memory leak detection (run for 1 hour)

### Load Tests

- 1000 sessions in database
- 100 new sessions in OpenCode
- 50 concurrent users sending messages

## Rollout Plan

### Phase 1: Canary Deployment

- Deploy to 1 test worker
- Monitor for 24 hours
- Validate metrics

### Phase 2: Gradual Rollout

- Deploy to 25% of workers
- Monitor for 48 hours
- Deploy to 100% if stable

### Phase 3: Monitoring

- Track startup times
- Track model fetch counts
- Alert on regressions

## Open Questions

1. **Session Limit**: What's the appropriate max session restore limit?

   - Proposal: 50 for Sprint 2, then remove limit with lazy loading in Sprint 3

2. **Incomplete Messages**: Should we ever retry them, or always skip?

   - Proposal: Always skip for now, add dedicated "retry failed message" UI action later

3. **Sync Frequency**: Is 30s too aggressive?

   - Proposal: Keep 30s, but add exponential backoff if no changes detected

4. **Model Cache TTL**: Is 5 minutes appropriate?
   - Proposal: 5 minutes is good, but add manual refresh in UI

## References

- Original Analysis: `codemaps/worker-session-sync.codemap.md`
- Production Logs: (attached to this document)
- Related Issues: Worker startup performance, session sync reliability
