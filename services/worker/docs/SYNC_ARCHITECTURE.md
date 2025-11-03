# OpenCode ↔ Convex Sync Architecture

## Overview

The sync system ensures OpenCode sessions and Convex sessions stay in sync, handling name updates, deletions, and new sessions created externally.

## Design Principles

1. **Idempotent** - Running sync multiple times produces the same result
2. **Explicit** - Clear sync plan shows what will happen before execution
3. **Testable** - Pure functions with comprehensive unit tests
4. **Simple** - No complex conditional logic, straightforward comparisons

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  ChatSessionManager                          │
│  (Infrastructure Layer - knows about adapters)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Dependency Injection
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│             OpencodeConvexSync Component                     │
│  (Pure Business Logic - no infrastructure dependencies)      │
│                                                              │
│  • calculateSyncPlan()    - Pure function                   │
│  • validateIdempotency()  - Pure function                   │
│  • executeSync()          - Orchestrator                    │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. Calculate Sync Plan (Pure Function)

```typescript
const plan = calculateSyncPlan(opencodeSessions, convexSessions);
// Returns: { nameUpdates, deletions, newSessions }
```

**Logic:**
- **Name Updates**: Session exists in both systems, but names differ
- **Deletions**: Session in Convex but not in OpenCode (and not already marked deleted)
- **New Sessions**: Session in OpenCode but not in Convex

### 2. Validate Idempotency (Pure Function)

```typescript
const isIdempotent = validateIdempotency(plan, opencodeSessions, convexSessions);
```

Simulates applying the plan and recalculating - should produce empty plan.

### 3. Execute Sync (Orchestrator)

```typescript
const result = await executeSync(syncDependencies);
// Returns: { nameUpdates: 3, deletions: 1, newSessions: 2, errors: [] }
```

Executes all operations in parallel using `Promise.allSettled`.

## Testing

### Unit Tests

```bash
cd services/worker
bun test src/application/__tests__/OpencodeConvexSync.test.ts
```

**Coverage:**
- ✅ Empty plan when states match
- ✅ Name updates detection
- ✅ Deletion detection
- ✅ New session detection
- ✅ Complex scenarios with all operation types
- ✅ Idempotency validation
- ✅ Multiple runs produce stable state

### Integration Test

```bash
cd services/worker
bun run scripts/test-sync-idempotency.ts
```

**Validates:**
- ✅ First sync: Operations execute correctly
- ✅ Second sync: No operations (idempotent)
- ✅ Third sync: Still no operations (stable)
- ✅ Immediate restart: No operations

## Example Output

### First Run (Initial Sync)
```
📊 Sync state: 5 OpenCode sessions, 4 Convex sessions
⚡ Executing 6 operations: 3 name updates, 1 deletions, 2 new sessions
📝 Updated: chat-1 → "Session 1762162810703"
📝 Updated: chat-2 → "Session 1762162810138"
📝 Updated: chat-3 → "Session 1762162809846"
🗑️  Marked deleted: chat-deleted
🆕 Created: chat-new-1 ← oc-new-1
🆕 Created: chat-new-2 ← oc-new-2
✅ Sync complete: 3 updated, 1 deleted, 2 created, 0 errors
```

### Subsequent Runs (Stable State)
```
📊 Sync state: 5 OpenCode sessions, 6 Convex sessions
✅ No changes detected - sync state is stable
```

## Key Benefits

### 1. Separation of Concerns
- Sync logic is pure and isolated
- Infrastructure adapters inject dependencies
- Easy to reason about and modify

### 2. Testability
- Pure functions → easy unit tests
- No mocking needed for core logic
- Integration tests prove real-world behavior

### 3. Debuggability
- Sync plan shows exactly what will happen
- Clear logging at each step
- Easy to reproduce issues

### 4. Maintainability
- ~200 LOC well-tested component
- Replaces ~150 LOC complex inline logic
- Clear contracts via TypeScript interfaces

### 5. Confidence
- **9/9 unit tests passing**
- **Integration test proves idempotency**
- No more "why is it syncing again?"

## Migration Notes

### Before (Complex Inline Logic)
- Mixed concerns: fetching, comparison, execution
- Hard to test (requires full infrastructure)
- Difficult to verify idempotency
- Unclear what operations will execute

### After (Clean Component)
- Separated: plan calculation → validation → execution
- Easy to test (pure functions)
- Proven idempotent (automated tests)
- Explicit sync plan before execution

## Future Enhancements

1. **Partial Sync**: Only fetch changed sessions if OpenCode supports timestamps
2. **Conflict Resolution**: Handle cases where both systems have changes
3. **Batch Operations**: Group operations for better performance
4. **Retry Logic**: Automatic retry on transient failures
5. **Metrics**: Track sync performance and error rates

## Troubleshooting

### "Sync keeps finding work to do"
- Check unit tests still pass
- Run integration test script
- Verify name comparison logic in `calculateSyncPlan`

### "Sessions not syncing"
- Check sync dependencies are properly injected
- Verify adapters return correct data format
- Check error logs in sync result

### "Performance issues"
- Operations already run in parallel
- Consider batching if > 1000 sessions
- Check Convex rate limits

