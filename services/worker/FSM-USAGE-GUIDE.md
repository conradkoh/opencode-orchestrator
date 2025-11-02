# Worker FSM Usage Guide

## Quick Start

The worker now uses a Finite State Machine (FSM) to manage its lifecycle. This guide shows you how to use it.

## Basic Usage

### Starting the Worker

```typescript
import { MachineServer } from './presentation/MachineServer';

const server = new MachineServer();

// Start the worker
await server.start({
  convexUrl: 'https://your-deployment.convex.cloud',
  machineId: 'machine_xxx',
  workerId: 'worker_yyy',
  secret: 'secret_zzz',
});

// Worker automatically transitions through states:
// UNINITIALIZED → REGISTERING → CONNECTING → READY
```

### Checking Worker State

```typescript
// Get current state
const state = server.getState();
console.log('Current state:', state);
// Output: "READY"

// Check if ready to process messages
if (server.isReady()) {
  console.log('Worker is ready!');
}

// Check if running
if (server.isRunning()) {
  console.log('Worker is active');
}
```

### Getting Detailed Status

```typescript
const status = server.getStatus();

console.log('State:', status.state);
console.log('Ready:', status.isReady);
console.log('Error:', status.error); // null if no error
console.log('History:', status.history); // Last 10 transitions

// Example output:
// {
//   state: 'READY',
//   isReady: true,
//   error: undefined,
//   history: [
//     { from: 'UNINITIALIZED', to: 'REGISTERING', event: 'START', timestamp: 1699... },
//     { from: 'REGISTERING', to: 'CONNECTING', event: 'REGISTERED', timestamp: 1699... },
//     { from: 'CONNECTING', to: 'READY', event: 'CONNECTED', timestamp: 1699... }
//   ]
// }
```

### Stopping the Worker

```typescript
// Graceful shutdown
await server.stop();
// Worker transitions: READY → STOPPING → STOPPED
```

## State Reference

### All States

| State | Description | Can Process Messages? |
|-------|-------------|----------------------|
| `UNINITIALIZED` | Initial state before start | ❌ No |
| `REGISTERING` | Registering with Convex | ❌ No |
| `WAITING_APPROVAL` | Waiting for admin approval | ❌ No |
| `CONNECTING` | Connecting to OpenCode | ❌ No |
| `READY` | Ready to process messages | ✅ Yes |
| `ERROR` | Error occurred | ❌ No |
| `STOPPING` | Shutting down gracefully | ❌ No |
| `STOPPED` | Shut down complete | ❌ No |

### State Transitions

```
UNINITIALIZED
    ↓ (start called)
REGISTERING
    ↓ (if approved) or ↓ (if pending)
CONNECTING      WAITING_APPROVAL
    ↓                ↓ (approved)
    ↓ ←──────────────┘
    ↓
READY
    ↓ (stop called)
STOPPING
    ↓
STOPPED

ERROR (can occur from most states)
    ↓ (if recoverable)
REGISTERING (retry)
```

## Common Scenarios

### Scenario 1: First-Time Registration (Needs Approval)

```typescript
const server = new MachineServer();
await server.start(config);

// Worker will:
// 1. UNINITIALIZED → REGISTERING
// 2. REGISTERING → WAITING_APPROVAL (needs approval)
// 3. Poll every 5 seconds for approval
// 4. WAITING_APPROVAL → CONNECTING (once approved)
// 5. CONNECTING → READY

// You'll see:
console.log('⏳ Waiting for authorization approval...');
console.log('   Please approve this worker in the web UI');
// ... (polling) ...
console.log('✅ Worker approved! Continuing...');
console.log('✅ Worker is ready and connected');
```

### Scenario 2: Already Approved Worker

```typescript
const server = new MachineServer();
await server.start(config);

// Worker will:
// 1. UNINITIALIZED → REGISTERING
// 2. REGISTERING → CONNECTING (already approved)
// 3. CONNECTING → READY

// You'll see:
console.log('✅ Worker already approved');
console.log('✅ Worker is ready and connected');
```

### Scenario 3: Error Recovery

```typescript
const server = new MachineServer();

try {
  await server.start(config);
} catch (error) {
  // If error is recoverable (e.g., network error):
  // Worker will:
  // 1. Current State → ERROR
  // 2. ERROR → REGISTERING (automatic recovery)
  // 3. REGISTERING → CONNECTING → READY
  
  // If error is fatal (e.g., config error):
  // Worker will:
  // 1. Current State → ERROR
  // 2. ERROR → STOPPING → STOPPED
  
  console.error('Worker failed:', error);
}
```

### Scenario 4: Graceful Shutdown During Approval

```typescript
const server = new MachineServer();
await server.start(config);

// If worker is waiting for approval, you can still stop it:
if (server.getState() === 'WAITING_APPROVAL') {
  await server.stop();
  // Worker will: WAITING_APPROVAL → STOPPING → STOPPED
}
```

## Advanced Usage

### Accessing the FSM Directly

```typescript
const server = new MachineServer();
await server.start(config);

// Get the lifecycle manager's FSM
const fsm = server.getStatus().history; // Via status
// or access through server internals (not recommended)

// Check state history
const history = server.getStatus().history;
for (const transition of history) {
  console.log(`${transition.from} → ${transition.to} via ${transition.event}`);
  console.log(`  at ${new Date(transition.timestamp).toISOString()}`);
  if (transition.error) {
    console.log(`  error: ${transition.error.message}`);
  }
}
```

### Monitoring State Changes

```typescript
const server = new MachineServer();

// Poll for state changes
const checkState = setInterval(() => {
  const state = server.getState();
  console.log('Current state:', state);
  
  if (state === 'READY') {
    console.log('Worker is ready!');
    clearInterval(checkState);
  }
}, 1000);

await server.start(config);
```

### Error Handling

```typescript
const server = new MachineServer();

try {
  await server.start(config);
} catch (error) {
  const status = server.getStatus();
  
  if (status.error) {
    console.error('Worker error:', status.error);
    console.error('State:', status.state);
    console.error('History:', status.history);
  }
  
  // Check if worker is in ERROR state
  if (server.getState() === 'ERROR') {
    console.log('Worker is in error state');
    // FSM will automatically attempt recovery if error is recoverable
  }
}
```

## Debugging Tips

### 1. Check State History

```typescript
const status = server.getStatus();
console.log('State history:');
for (const t of status.history) {
  console.log(`  ${t.from} → ${t.to} (${t.event}) at ${new Date(t.timestamp).toLocaleString()}`);
}
```

### 2. Monitor State Transitions

```typescript
// Before starting
console.log('Initial state:', server.getState()); // UNINITIALIZED

await server.start(config);

// After starting
console.log('Final state:', server.getState()); // READY (if successful)
```

### 3. Check for Errors

```typescript
const status = server.getStatus();
if (status.error) {
  console.error('Error message:', status.error);
  
  // Check which state the error occurred in
  const errorTransition = status.history.find(t => t.error);
  if (errorTransition) {
    console.error('Error occurred during:', errorTransition.from, '→', errorTransition.to);
  }
}
```

### 4. Verify State Before Operations

```typescript
// Always check if ready before assuming worker can process messages
if (!server.isReady()) {
  console.warn('Worker is not ready yet. Current state:', server.getState());
  return;
}

// Now safe to process messages
```

## Best Practices

### 1. Always Check `isReady()` Before Processing

```typescript
// ❌ Bad
await processMessage(sessionId, messageId, content);

// ✅ Good
if (server.isReady()) {
  await processMessage(sessionId, messageId, content);
} else {
  console.warn('Worker not ready, current state:', server.getState());
}
```

### 2. Handle Errors Gracefully

```typescript
// ✅ Good
try {
  await server.start(config);
} catch (error) {
  console.error('Failed to start worker:', error);
  
  // Check if we can recover
  const state = server.getState();
  if (state === 'ERROR') {
    console.log('Worker is attempting recovery...');
    // FSM handles recovery automatically
  } else {
    console.log('Worker stopped due to fatal error');
    process.exit(1);
  }
}
```

### 3. Use Status for Debugging

```typescript
// ✅ Good
const status = server.getStatus();
console.log('Worker Status:');
console.log('  State:', status.state);
console.log('  Ready:', status.isReady);
console.log('  Error:', status.error || 'none');
console.log('  Recent transitions:', status.history.length);
```

### 4. Graceful Shutdown

```typescript
// ✅ Good
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await server.stop();
  process.exit(0);
});
```

## Troubleshooting

### Worker Stuck in WAITING_APPROVAL

**Problem**: Worker stays in `WAITING_APPROVAL` state indefinitely.

**Solution**: Approve the worker in the admin UI. The worker polls every 5 seconds and will automatically progress once approved.

```typescript
// Check if stuck
if (server.getState() === 'WAITING_APPROVAL') {
  console.log('Worker is waiting for approval in the admin UI');
}
```

### Worker Enters ERROR State

**Problem**: Worker transitions to `ERROR` state.

**Solution**: Check the error message and history to understand what went wrong.

```typescript
const status = server.getStatus();
console.error('Error:', status.error);
console.error('State history:', status.history);

// FSM will automatically attempt recovery if error is recoverable
// Otherwise, it will transition to STOPPING → STOPPED
```

### Worker Won't Start

**Problem**: `server.start()` throws an error.

**Solution**: Check configuration and ensure Convex URL is correct.

```typescript
try {
  await server.start(config);
} catch (error) {
  console.error('Start failed:', error);
  
  // Check config
  console.log('Config:', {
    convexUrl: config.convexUrl,
    machineId: config.machineId,
    workerId: config.workerId,
  });
}
```

## Migration from Old Code

If you have existing code using the old `MachineServer`, here's how to migrate:

### Before (Old Code)

```typescript
const server = new MachineServer();
await server.start(config);

// Check if running
if (server.isRunning()) {
  // ...
}
```

### After (New FSM Code)

```typescript
const server = new MachineServer();
await server.start(config);

// Check if ready (more specific than isRunning)
if (server.isReady()) {
  // ...
}

// Or check state explicitly
if (server.getState() === 'READY') {
  // ...
}
```

The external API is mostly the same, but you now have more detailed state information available!

## Related Documentation

- **Full Codemap**: `/codemaps/worker-fsm-lifecycle.codemap.md`
- **Visual Diagram**: `/docs/worker-fsm-diagram.md`
- **Implementation Summary**: `/services/worker/FSM-IMPLEMENTATION-SUMMARY.md`
- **Quick Reference**: `/codemaps/worker-fsm-quick-reference.md`

