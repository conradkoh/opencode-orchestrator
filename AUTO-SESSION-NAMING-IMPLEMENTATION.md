# Auto Session Naming - Implementation Summary

**Implemented**: 2025-01-04  
**Status**: ✅ Complete  
**Codemap**: `codemaps/auto-session-naming.codemap.md`

## Overview

Implemented automatic session naming that generates meaningful session titles from the first user message. Sessions are no longer named with timestamps but instead use the first 50 characters of the user's prompt.

## What Was Implemented

### 1. Backend - Convex Session Naming ✅

**File**: `services/backend/convex/chat.ts`

- Added `generateSessionName()` helper function
  - Takes first 50 characters of prompt
  - Cleans whitespace and newlines
  - Adds "..." if truncated
  - Defaults to "New Chat" for empty prompts

- Updated `sendMessage()` mutation
  - Detects first user message in a session
  - Automatically generates and sets session name
  - Updates immediately in Convex database

**Example Behavior**:
```typescript
// User sends: "Help me build a React component for a todo list"
// Session name becomes: "Help me build a React component for a todo list..."

// User sends: "   "
// Session name becomes: "New Chat"
```

### 2. Worker - OpenCode Session Renaming ✅

**File**: `services/worker/src/domain/interfaces/IOpencodeClient.ts`

- Added `renameSession()` method to interface
  - Takes OpenCode session ID and new title
  - Part of the OpenCode client contract

**File**: `services/worker/src/infrastructure/opencode/OpencodeClientAdapter.ts`

- Implemented `renameSession()` method
  - Wraps OpenCode SDK `client.session.patch()`
  - Handles errors gracefully
  - Logs successful renames

**Example Usage**:
```typescript
await opencodeAdapter.renameSession(
  client,
  "oc-session-123",
  "Help me build a React component for a todo list..."
);
```

### 3. Sync Infrastructure Integration ✅

**File**: `services/worker/src/application/OpencodeConvexSync.ts`

- Added `renameOpenCodeSession` to `SyncDependencies` interface
- Updated `executeSync()` to call OpenCode rename API
  - Finds OpenCode session ID from Convex session
  - Updates both Convex (source of truth) and OpenCode
  - Runs name updates in parallel with other sync operations

**File**: `services/worker/scripts/test-sync-idempotency.ts`

- Added `renameOpenCodeSession` mock implementation
- Test script now validates name sync in both directions

## How It Works

### Flow 1: User Creates New Session

```
1. User starts new chat session
   └─> Convex creates session with no name
   
2. User sends first message: "How do I use TypeScript generics?"
   └─> sendMessage() detects first user message
   └─> Generates name: "How do I use TypeScript generics?"
   └─> Writes name to Convex session immediately
   
3. Worker creates OpenCode session (lazy init on first message)
   └─> OpenCode session gets default timestamp title
   
4. Next sync cycle (within 30 seconds)
   └─> Sync detects name mismatch
   └─> Updates OpenCode session title to match Convex
   └─> Result: Both systems have "How do I use TypeScript generics?"
```

### Flow 2: Session Created Directly in OpenCode

```
1. User creates session directly in OpenCode CLI
   └─> OpenCode assigns its own title
   
2. Sync cycle detects new OpenCode session
   └─> Creates corresponding Convex session
   └─> Preserves OpenCode's title
   
3. User continues chat in UI
   └─> Convex name is NOT overwritten (respects OpenCode's title)
   └─> Only UI-created sessions get auto-naming from first message
```

## Implementation Status

### ✅ Completed

1. Name generation logic in Convex
2. First message detection and auto-naming
3. OpenCode rename API integration
4. Sync infrastructure plumbing
5. Test script updates
6. Codemap documentation
7. **UI Integration** - SessionList now displays session names
8. **Type Definitions** - ChatSession type updated with name field
9. **Backend Query** - listSessions returns name field

### ⏳ Pending Integration

The sync infrastructure is fully implemented and tested but not yet actively running in production. When periodic sync is integrated:

- Names will automatically propagate from Convex to OpenCode
- The `renameOpenCodeSession` dependency just needs to be wired up
- See codemap Step 4 for wiring instructions

## UI Update (2025-01-04)

Fixed issue where session names weren't displaying in the browser UI:

### Changes Made

1. **Updated `ChatSession` type** (`apps/webapp/src/modules/assistant/types.ts`)
   - Added `name?: string` field to interface

2. **Updated `listSessions` query** (`services/backend/convex/chat.ts`)
   - Now returns `name` field in session data

3. **Updated `SessionList` component** (`apps/webapp/src/modules/assistant/components/SessionList.tsx`)
   - Added `_getSessionDisplayName()` helper function
   - Displays `session.name` if available, otherwise falls back to timestamp format
   - Added `truncate` class to prevent long names from breaking layout
   - Added `flex-shrink-0` to status indicator dot

### Result

Session names now display correctly in the UI:
- New sessions show meaningful names like "Help me build a React component..."
- Old sessions without names show timestamp fallback "Session 05112025_003456"
- Long names are truncated with ellipsis to prevent layout issues

## OpenCode Immediate Rename (2025-01-04)

Fixed issue where OpenCode sessions weren't being renamed immediately:

### Changes Made

1. **Added `getSessionName` query** (`services/backend/convex/chat.ts`)
   - Worker-only query to get session name for authorization
   - Returns `string | null`

2. **Added `getSessionName` method** (`services/worker/src/infrastructure/convex/ConvexClientAdapter.ts`)
   - Wrapper around the new query

3. **Updated `processMessage`** (`services/worker/src/application/ChatSessionManager.ts`)
   - After creating OpenCode session, checks Convex session name
   - Immediately renames OpenCode session if name exists
   - Also checks on existing sessions to catch name updates
   - Rename errors are non-fatal (logged but don't fail message processing)

### Result

OpenCode sessions are now renamed immediately:
- When first message is sent, Convex sets the name
- Worker creates OpenCode session
- Worker immediately checks Convex name and renames OpenCode session
- OpenCode CLI now shows meaningful session names right away
- No need to wait for sync cycle

### Flow

```
1. User sends first message: "Help me build a React component"
   └─> Convex: Sets session name immediately
   
2. Worker processes message
   └─> Creates OpenCode session (if needed)
   └─> Checks Convex session name
   └─> Renames OpenCode session immediately
   
3. Result: Both Convex and OpenCode have "Help me build a React component..."
```

## Testing

### Manual Testing

1. **Start new session and send message**:
   ```
   Expected: Session list shows first 50 chars of message
   ```

2. **Send very long message**:
   ```
   Message: "I need help with a very long problem description that goes on and on and on..."
   Expected: "I need help with a very long problem description..."
   ```

3. **Send empty/whitespace message**:
   ```
   Message: "   "
   Expected: "New Chat"
   ```

4. **Send multi-line message**:
   ```
   Message: "Line 1\nLine 2\nLine 3"
   Expected: "Line 1 Line 2 Line 3" (newlines become spaces)
   ```

### Sync Testing

Run the idempotency test script:
```bash
cd services/worker
bun run scripts/test-sync-idempotency.ts
```

This validates:
- Name sync from Convex to OpenCode
- Sync is idempotent (no infinite loops)
- Both systems converge to same name

## Database Schema

No schema changes required. The `chatSessions` table already has:

```typescript
chatSessions: defineTable({
  sessionId: v.string(),
  opencodeSessionId: v.optional(v.string()),
  name: v.optional(v.string()), // ← Used for auto-generated names
  lastSyncedNameAt: v.optional(v.number()), // ← Tracks sync timing
  // ... other fields
})
```

## Edge Cases Handled

1. **Empty prompt** → "New Chat"
2. **Whitespace-only** → "New Chat"  
3. **Very long prompt** → Truncated to 50 chars + "..."
4. **Multi-line prompt** → Collapsed to single line
5. **Special characters** → Preserved as-is
6. **Resumed inactive session** → Name NOT changed (preserves history)
7. **Session already has name** → Not overwritten

## Performance Considerations

### Convex
- Name generation is O(1) string operation
- Single database patch per new session
- Negligible performance impact

### Worker
- OpenCode rename is async, non-blocking
- Runs in parallel with other sync operations
- Only happens once per session (idempotent)

### Sync Frequency
- Names sync within 30 seconds (typical sync interval)
- User sees name immediately in UI (Convex updates first)
- OpenCode sees name on next sync

## Future Enhancements

### Considered but Not Implemented

1. **AI-powered name generation**: Use LLM to generate semantic titles
   - Pros: More meaningful names
   - Cons: Latency, cost, complexity
   - Decision: Start simple, iterate based on feedback

2. **User manual rename**: Allow users to edit session names
   - Ready to implement when needed
   - Just add UI component and mutation

3. **Rename on resume**: Update name when session is resumed
   - Could lose context of original conversation
   - Better to preserve original name

4. **Localization**: Support non-English names
   - Works out of the box (just stores UTF-8 strings)

## Related Documentation

- **Codemap**: `codemaps/auto-session-naming.codemap.md` - Complete flow and contracts
- **Sync Architecture**: `services/worker/docs/SYNC_ARCHITECTURE.md` - How sync works
- **Worker Investigation**: `docs/worker-sync-investigation-plan.md` - Performance considerations

## Migration Notes

### Existing Sessions

Existing sessions without names will:
- Continue to work normally
- NOT be auto-named (only affects new sessions)
- Display with timestamp-based formatting in UI (fallback behavior)

### Rollback Plan

To disable auto-naming:
1. Comment out lines 212-226 in `services/backend/convex/chat.ts`
2. Sessions will continue to work, just without auto-naming
3. Existing named sessions keep their names

## Success Metrics

- ✅ Session naming logic is pure and testable
- ✅ No database schema changes required
- ✅ Backward compatible with existing sessions
- ✅ Sync infrastructure is idempotent
- ✅ Zero linting errors
- ✅ Minimal performance impact

## Conclusion

Auto session naming is fully implemented for Convex-side operations and will take effect immediately. The OpenCode sync integration is ready to go live when periodic sync is enabled in production.

Users will see meaningful session names based on their first message, making it easier to identify and navigate between conversations.

