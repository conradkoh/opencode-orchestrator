# Worker Architecture Clarification

**Date**: 2025-01-03  
**Status**: ✅ Architecture Verified Correct

## TL;DR

✅ **The architecture is CORRECT!**  
- One OpenCode server per worker
- Multiple OpenCode sessions in that one server
- Sessions are just data, not processes

❌ **The problem is NOT the architecture**  
- It's inefficient API usage (90 redundant model fetches)
- And unbounded data loading (255 sessions at once)

## Architecture Deep Dive

### What Actually Happens

```
┌─────────────────────────────────────────────────────────────┐
│ Worker Process (One per machine/directory)                   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ WorkerLifecycleManager                                │   │
│  │  - FSM state management                               │   │
│  │  - Convex connection                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                    │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ChatSessionManager                                    │   │
│  │  - opencodeClient: IOpencodeInstance (ONE)            │   │
│  │  - activeSessions: Map<ChatSessionId, SessionInfo>    │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                    │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ OpenCode Server (ONE per worker)                      │   │
│  │  - Port: 8599 (or random available)                   │   │
│  │  - HTTP server at http://127.0.0.1:8599               │   │
│  │                                                        │   │
│  │  ┌──────────────────────────────────────────┐        │   │
│  │  │ OpenCode Sessions (Multiple)              │        │   │
│  │  │  - ses_5b6e9e748ffe5R9NKemc3VVY9K        │        │   │
│  │  │  - ses_5b6e9e634ffehVa0jqvkjFMd98        │        │   │
│  │  │  - ses_5b6e9cfddffeqDuw85f9UagH6W        │        │   │
│  │  │  - ... 342 more sessions ...               │        │   │
│  │  │                                             │        │   │
│  │  │  Each session is just a conversation        │        │   │
│  │  │  with an AI model. They share the same      │        │   │
│  │  │  OpenCode server process.                   │        │   │
│  │  └──────────────────────────────────────────┘        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Code Evidence

#### 1. ONE Server Per Worker ✅

```typescript
// ChatSessionManager.connect() - Called ONCE per worker
async connect(): Promise<void> {
  // Initialize opencode client if not already done
  if (!this.opencodeClient) {  // ← This check ensures ONE server
    console.log(`🔧 Connecting opencode client for directory: ${this.workingDirectory}`);
    this.opencodeClient = await this.opencodeAdapter.createClient(this.workingDirectory);
    //                          ↑
    //                          Creates ONE OpenCode server
    console.log('✅ Opencode client initialized');
  }
}
```

#### 2. Multiple Sessions in ONE Server ✅

```typescript
// ChatSessionManager.startSession() - Called for EACH chat session
async startSession(chatSessionId: ChatSessionId, model: string): Promise<void> {
  await this.ensureOpencodeClient();  // ← Reuses existing server
  
  // Create opencode session (NOT a new server!)
  const opencodeSession = await this.opencodeAdapter.createSession(
    this.opencodeClient,  // ← Same server for all sessions
    model
  );
}
```

#### 3. Log Evidence

From your production logs:

```
Line 30: 🔌 Starting opencode server on port 8599
Line 31: ✅ Opencode server started at http://127.0.0.1:8599

[ONE SERVER CREATED - No more "Starting opencode server" messages]

Line 102-357: ✅ Restoring session [ID] with existing OpenCode session ses_...
              ✅ Restoring session [ID] with existing OpenCode session ses_...
              ✅ Restoring session [ID] with existing OpenCode session ses_...
              (255 times - all using the SAME server)
```

**Conclusion**: Only ONE "Starting opencode server" message! ✅

## The REAL Problems

### Problem 1: Redundant Model Fetching

**What's happening**:
```typescript
// During sync, for EACH new session being created:
createSyncedSession: async (opencodeSessionId, title) => {
  // Fetch models to get default model
  const models = await this.opencodeAdapter.listModels(this.opencodeClient!);
  //                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                   Calls `opencode models` CLI command
  //                   This is called 90 TIMES in parallel!
  
  const defaultModel = models.length > 0 ? models[0].id : "unknown";
  // ... use defaultModel
}
```

**Why it's a problem**:
- Models don't change between calls
- Each CLI call takes ~100-200ms
- 90 parallel processes = CPU spike

**Solution**: Cache models in memory (already proposed in investigation plan)

### Problem 2: Unbounded Session Restoration

**What's happening**:
```typescript
// On worker startup:
const convexSessions = await this.convexClient.getActiveSessions();
// ↑ Returns ALL 255 active sessions

for (const convexSession of convexSessions) {
  // Process every single session
  this.activeSessions.set(chatSessionId, sessionInfo);
}
```

**Why it's a problem**:
- O(N) memory usage
- O(N) startup time
- Will break at ~1000+ sessions

**Solution**: Pagination or lazy loading (already proposed in investigation plan)

### Problem 3: Incomplete Message Retry

**What's happening**:
```typescript
// On worker startup, before worker is ready:
const incompleteAssistantMessages = messages.filter(
  (m) => m.role === "assistant" && !m.completed
);

for (const msg of incompleteAssistantMessages) {
  // Try to process - but worker not ready!
  this.messageCallback(msg.sessionId, msg.messageId, msg.content);
  // ❌ Fails with "worker is not ready"
}
```

**Why it's a problem**:
- Messages attempted before initialization complete
- Same messages retried on every restart
- Never cleaned up

**Solution**: Skip old incomplete messages (already proposed in investigation plan)

## Revised Investigation Plan

### Quick Wins (Same as before, now with correct understanding)

1. **Cache Models** ⭐ Highest Impact
   - Store models in memory after first fetch
   - Reuse for all session creations
   - **Impact**: 90 CLI calls → 1 CLI call

2. **Skip Incomplete Messages** ⭐ Easy Fix
   - Don't retry old incomplete messages
   - Only process new messages after startup
   - **Impact**: 0 failed retry attempts

3. **Paginate Session Restoration** ⭐ Good Scalability
   - Restore max 50 most recent sessions
   - Lazy-load others on demand
   - **Impact**: Constant startup time

### Architecture Improvements (Future)

The architecture is sound, but we can optimize:

1. **Lazy Session Loading**
   - Don't restore ANY sessions on startup
   - Restore when first message arrives
   - **Benefit**: <2s startup time regardless of session count

2. **Incremental Sync**
   - Only sync sessions modified since last sync
   - Use timestamps for delta detection
   - **Benefit**: Reduce sync overhead

3. **Session Pooling**
   - Keep only N most active sessions in memory
   - LRU eviction for inactive sessions
   - **Benefit**: Constant memory usage

## Misconceptions Clarified

### ❌ Myth: "One OpenCode process per session"
**Reality**: One OpenCode process per WORKER, multiple sessions in it

### ❌ Myth: "Session restoration creates new servers"
**Reality**: Session restoration just loads metadata into memory

### ❌ Myth: "90 processes = 90 OpenCode servers"
**Reality**: 90 processes = 90 CLI calls to query models from 1 server

### ✅ Fact: Architecture is correct
**The problem**: Inefficient use of the correct architecture

## Next Steps

1. ✅ Keep the existing architecture (it's correct!)
2. ✅ Implement the 3 quick wins from investigation plan
3. ✅ Focus on API efficiency, not architectural changes
4. ⏭️ Consider lazy loading as Phase 2 optimization

## References

- Investigation Plan: `docs/worker-sync-investigation-plan.md`
- Sequence Diagram: `codemaps/worker-session-sync.codemap.md`
- OpenCode SDK: Uses one server per directory/port

