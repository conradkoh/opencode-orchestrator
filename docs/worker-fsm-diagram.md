# Worker Finite State Machine - Visual Guide

## State Machine Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Worker Lifecycle FSM                             │
└─────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │UNINITIALIZED │
                              └──────┬───────┘
                                     │ START
                                     ▼
                              ┌──────────────┐
                              │ REGISTERING  │◄─────────┐
                              └──────┬───────┘          │
                                     │                  │
                    ┌────────────────┴────────────┐     │
                    │                             │     │
            WAIT_APPROVAL                   REGISTERED  │
                    │                             │     │
                    ▼                             ▼     │
            ┌───────────────┐              ┌──────────────┐
            │WAITING_APPROVAL│              │  CONNECTING  │
            └───────┬───────┘              └──────┬───────┘
                    │                             │
                 APPROVED                    CONNECTED
                    │                             │
                    └──────────────┬──────────────┘
                                   ▼
                            ┌──────────────┐
                            │    READY     │
                            └──────┬───────┘
                                   │
                              STOP │
                                   ▼
                            ┌──────────────┐
                            │   STOPPING   │
                            └──────┬───────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │   STOPPED    │
                            └──────────────┘

                    ┌──────────────┐
                    │    ERROR     │◄──── ERROR (from any state)
                    └──────┬───────┘
                           │
                      ┌────┴────┐
                  RECOVER    STOP
                      │          │
                      ▼          ▼
                 REGISTERING  STOPPING
```

## State Descriptions

### UNINITIALIZED
**Description**: Initial state before worker starts  
**Entry Actions**: None  
**Exit Actions**: None  
**Valid Transitions**: → REGISTERING (via START)  
**Can Process Messages**: ❌ No

### REGISTERING
**Description**: Registering with Convex backend  
**Entry Actions**:
- Create Convex client
- Send registration request
- Check approval status

**Exit Actions**: None  
**Valid Transitions**:
- → CONNECTING (via REGISTERED, if already approved)
- → WAITING_APPROVAL (via WAIT_APPROVAL, if pending)
- → ERROR (via ERROR)

**Can Process Messages**: ❌ No

### WAITING_APPROVAL
**Description**: Waiting for admin to approve worker  
**Entry Actions**:
- Start approval polling (every 5 seconds)
- Display waiting message

**Exit Actions**:
- Stop approval polling

**Valid Transitions**:
- → CONNECTING (via APPROVED)
- → STOPPING (via STOP)
- → ERROR (via ERROR)

**Can Process Messages**: ❌ No

### CONNECTING
**Description**: Connecting to OpenCode and initializing  
**Entry Actions**:
- Start heartbeat
- Start Convex subscriptions
- Initialize ChatSessionManager
- Connect OpenCode client
- Fetch and publish models
- Mark worker as connected

**Exit Actions**: None  
**Valid Transitions**:
- → READY (via CONNECTED)
- → ERROR (via ERROR)

**Can Process Messages**: ❌ No

### READY
**Description**: Worker is ready to process messages  
**Entry Actions**:
- Log ready status
- Enable message processing

**Exit Actions**: None  
**Valid Transitions**:
- → STOPPING (via STOP)
- → ERROR (via ERROR)

**Can Process Messages**: ✅ Yes

### ERROR
**Description**: Worker encountered an error  
**Entry Actions**:
- Log error details
- Capture error in FSM
- Determine recovery strategy

**Exit Actions**:
- Clear error if recovering

**Valid Transitions**:
- → REGISTERING (via RECOVER, if recoverable)
- → STOPPING (via STOP, if fatal)

**Can Process Messages**: ❌ No

### STOPPING
**Description**: Worker is shutting down gracefully  
**Entry Actions**:
- Disconnect all chat sessions
- Stop heartbeat
- Stop subscriptions
- Set worker offline in Convex
- Close Convex connection

**Exit Actions**: None  
**Valid Transitions**: None (terminal transition to STOPPED)  
**Can Process Messages**: ❌ No

### STOPPED
**Description**: Worker has stopped  
**Entry Actions**:
- Log stopped status
- Clean up resources

**Exit Actions**: None  
**Valid Transitions**: None (terminal state)  
**Can Process Messages**: ❌ No

## Event Descriptions

### START
**Trigger**: User calls `worker.start(config)`  
**From States**: UNINITIALIZED  
**To State**: REGISTERING  
**Purpose**: Begin worker initialization

### REGISTERED
**Trigger**: Registration succeeds and worker is already approved  
**From States**: REGISTERING  
**To State**: CONNECTING  
**Purpose**: Skip approval waiting if already approved

### WAIT_APPROVAL
**Trigger**: Registration succeeds but worker needs approval  
**From States**: REGISTERING  
**To State**: WAITING_APPROVAL  
**Purpose**: Enter approval waiting state

### APPROVED
**Trigger**: Admin approves worker (detected by polling)  
**From States**: WAITING_APPROVAL  
**To State**: CONNECTING  
**Purpose**: Proceed to connection after approval

### CONNECTED
**Trigger**: OpenCode connection and initialization complete  
**From States**: CONNECTING  
**To State**: READY  
**Purpose**: Worker is fully initialized and ready

### STOP
**Trigger**: User calls `worker.stop()` or SIGTERM/SIGINT  
**From States**: WAITING_APPROVAL, READY, ERROR  
**To State**: STOPPING  
**Purpose**: Begin graceful shutdown

### ERROR
**Trigger**: Unhandled exception in any operation  
**From States**: REGISTERING, WAITING_APPROVAL, CONNECTING, READY  
**To State**: ERROR  
**Purpose**: Handle error and determine recovery

### RECOVER
**Trigger**: Error handler determines error is recoverable  
**From States**: ERROR  
**To State**: REGISTERING  
**Purpose**: Attempt to recover by re-registering

## State Transition Examples

### Happy Path (Already Approved)
```
UNINITIALIZED
    ↓ user calls start()
REGISTERING
    ↓ registration succeeds, already approved
CONNECTING
    ↓ opencode connects, models published
READY
    ↓ user calls stop()
STOPPING
    ↓ cleanup complete
STOPPED
```

### First-Time Registration (Needs Approval)
```
UNINITIALIZED
    ↓ user calls start()
REGISTERING
    ↓ registration succeeds, needs approval
WAITING_APPROVAL
    ↓ admin approves in UI
CONNECTING
    ↓ opencode connects, models published
READY
    ↓ user calls stop()
STOPPING
    ↓ cleanup complete
STOPPED
```

### Error Recovery
```
READY
    ↓ network error occurs
ERROR
    ↓ error handler determines recoverable
REGISTERING
    ↓ re-registration succeeds
CONNECTING
    ↓ reconnection succeeds
READY
```

### Fatal Error
```
CONNECTING
    ↓ opencode fails to initialize
ERROR
    ↓ error handler determines fatal
STOPPING
    ↓ cleanup complete
STOPPED
```

## State Guards

State guards prevent invalid operations:

```typescript
// Example: Can only process messages in READY state
async processMessage(sessionId: string, messageId: string, content: string) {
  this.fsm.assertState(WorkerState.READY);
  // ... process message
}

// Example: Can only start from UNINITIALIZED
async start(config: WorkerConfig) {
  if (!this.fsm.is(WorkerState.UNINITIALIZED)) {
    throw new Error('Worker already started');
  }
  this.fsm.transition(WorkerEvent.START);
  // ... continue startup
}
```

## State History Tracking

The FSM tracks all state transitions for debugging:

```typescript
interface StateTransition {
  from: WorkerState;
  to: WorkerState;
  event: WorkerEvent;
  timestamp: number;
  error?: Error;
}

// Example history
const history = fsm.getHistory();
// [
//   { from: 'UNINITIALIZED', to: 'REGISTERING', event: 'START', timestamp: 1699... },
//   { from: 'REGISTERING', to: 'CONNECTING', event: 'REGISTERED', timestamp: 1699... },
//   { from: 'CONNECTING', to: 'READY', event: 'CONNECTED', timestamp: 1699... },
// ]
```

## Monitoring and Metrics

Potential metrics to collect per state:

- **Time in state**: How long worker spends in each state
- **Transition counts**: How often each transition occurs
- **Error rates**: Frequency of ERROR state entries
- **Recovery success rate**: RECOVER → READY vs RECOVER → ERROR

## Implementation Notes

### State Entry/Exit Hooks

Each state can have entry and exit hooks:

```typescript
interface StateActionHooks {
  onEnter?: (context: StateContext) => Promise<void>;
  onExit?: (context: StateContext) => Promise<void>;
}

// Example: CONNECTING state hooks
{
  onEnter: async (context) => {
    await startHeartbeat();
    await startSubscriptions();
    await initializeChatManager();
  },
  onExit: async (context) => {
    // Cleanup if needed
  }
}
```

### Error Handling Strategy

```typescript
enum ErrorHandlingStrategy {
  RECOVER = 'RECOVER',  // Try to recover by re-registering
  STOP = 'STOP',        // Fatal error, shut down
  IGNORE = 'IGNORE',    // Log but continue
}

// Error handler determines strategy based on error type
function determineStrategy(error: Error, state: WorkerState): ErrorHandlingStrategy {
  if (error instanceof NetworkError && state !== WorkerState.STOPPING) {
    return ErrorHandlingStrategy.RECOVER;
  }
  if (error instanceof ConfigurationError) {
    return ErrorHandlingStrategy.STOP;
  }
  return ErrorHandlingStrategy.IGNORE;
}
```

## Benefits Recap

### Development
- ✅ Explicit state management
- ✅ Clear transition rules
- ✅ Easy to test each state

### Operations
- ✅ Predictable behavior
- ✅ Clear error recovery
- ✅ Observable state changes

### Debugging
- ✅ State history for troubleshooting
- ✅ Know exactly what state worker is in
- ✅ Understand how it got there

## Related Documents

- [Full Codemap](../codemaps/worker-fsm-lifecycle.codemap.md) - Complete implementation details
- [Summary](../codemaps/worker-fsm-lifecycle-summary.md) - High-level overview
- [Worker README](../services/worker/README.md) - Current implementation

