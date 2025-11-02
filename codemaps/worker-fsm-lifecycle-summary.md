# Worker FSM Lifecycle Refactoring - Summary

## Overview

This document provides a high-level summary of the finite state machine (FSM) refactoring plan for the worker runtime. For complete implementation details, see [worker-fsm-lifecycle.codemap.md](./worker-fsm-lifecycle.codemap.md).

## Current Problems

The worker currently has several issues with lifecycle management:

1. **Implicit State**: State is scattered across multiple classes (`MachineServer`, `ConvexClientAdapter`, `ChatSessionManager`)
2. **Unclear Transitions**: No explicit definition of valid state transitions
3. **Hard to Test**: State verification requires inspecting multiple objects
4. **Error Handling**: No clear recovery paths from error states
5. **Debugging Difficulty**: Hard to understand what state the worker is in and how it got there

## Proposed Solution

Introduce an explicit Finite State Machine that:

- Defines 8 clear states: `UNINITIALIZED`, `REGISTERING`, `WAITING_APPROVAL`, `CONNECTING`, `READY`, `STOPPING`, `STOPPED`, `ERROR`
- Enforces valid transitions between states
- Provides hooks for state entry/exit actions
- Tracks state history for debugging
- Centralizes lifecycle logic in `WorkerLifecycleManager`

## State Diagram

```
UNINITIALIZED
    ↓ START
REGISTERING
    ↓ REGISTERED (if approved)
    ↓ WAIT_APPROVAL (if pending)
WAITING_APPROVAL
    ↓ APPROVED
CONNECTING
    ↓ CONNECTED
READY ←→ ERROR (with RECOVER)
    ↓ STOP
STOPPING
    ↓
STOPPED
```

## Key Components

### 1. WorkerStateMachine (Domain Entity)
- Core FSM logic
- State transition validation
- State history tracking
- Error capture

### 2. WorkerLifecycleManager (Application Layer)
- Orchestrates FSM with infrastructure
- Registers state entry/exit hooks
- Manages Convex client and chat manager
- Handles approval polling

### 3. State Handlers (Application Layer)
- `RegistrationHandler`: Handles worker registration
- `ConnectionHandler`: Handles opencode connection
- `ShutdownHandler`: Handles graceful shutdown
- `ErrorHandler`: Determines recovery strategy

### 4. Updated MachineServer (Presentation Layer)
- Simplified to delegate to `WorkerLifecycleManager`
- Exposes state information
- Provides status with history

## Migration Strategy

### Phase 1: Create FSM Infrastructure ✅ Safe
Create all FSM components without touching existing code:
- `WorkerStateMachine` entity
- `StateMachineConfig` value object
- State handler classes
- `WorkerLifecycleManager`
- Comprehensive tests

### Phase 2: Parallel Integration ✅ Safe
Run FSM alongside existing implementation:
- Add feature flag
- Test both implementations
- Verify behavior matches

### Phase 3: Migrate and Cleanup ⚠️ Breaking
Switch to FSM and remove old code:
- Enable FSM by default
- Remove old state management
- Simplify infrastructure classes

### Phase 4: Enhance 🚀 New Features
Add FSM-enabled features:
- State transition logging
- Metrics per state
- Recovery strategies
- State visualization

## Benefits

### For Development
- **Clearer Code**: State logic is explicit and centralized
- **Easier Testing**: Can test state transitions independently
- **Better Debugging**: State history shows how worker got to current state

### For Operations
- **Predictable Behavior**: FSM guarantees valid state flows
- **Better Error Handling**: Clear recovery paths from error states
- **Improved Monitoring**: Can track time in each state, transition rates

### For Maintenance
- **Easy to Extend**: Adding new states has clear process
- **Less Coupling**: State logic separated from infrastructure
- **Self-Documenting**: State machine serves as documentation

## Example Usage

```typescript
// Create lifecycle manager
const lifecycleManager = new WorkerLifecycleManager();

// Start worker (FSM handles all transitions)
await lifecycleManager.start(config);
// FSM: UNINITIALIZED → REGISTERING → CONNECTING → READY

// Check state
if (lifecycleManager.isReady()) {
  console.log('Worker ready to process messages');
}

// Get detailed status
const status = lifecycleManager.getStateMachine().getHistory();
console.log('State transitions:', status);

// Stop worker
await lifecycleManager.stop();
// FSM: READY → STOPPING → STOPPED
```

## Testing Strategy

### Unit Tests (Fast, Isolated)
- Test FSM transitions
- Test state handlers independently
- Test lifecycle manager with mocks

### Integration Tests (Real Infrastructure)
- Test FSM with real Convex client
- Test state transitions with real services
- Test error scenarios

### E2E Tests (Complete Flows)
- Test startup to shutdown
- Test approval waiting
- Test crash recovery

## Implementation Timeline

### Week 1: Foundation
- [ ] Create `WorkerStateMachine` entity
- [ ] Create `StateMachineConfig`
- [ ] Write unit tests for FSM
- [ ] Create state handler interfaces

### Week 2: Application Layer
- [ ] Implement state handlers
- [ ] Create `WorkerLifecycleManager`
- [ ] Write unit tests for lifecycle manager
- [ ] Write integration tests

### Week 3: Integration
- [ ] Update `MachineServer` to use lifecycle manager
- [ ] Add feature flag for gradual rollout
- [ ] Test parallel implementation
- [ ] Write E2E tests

### Week 4: Migration
- [ ] Enable FSM by default
- [ ] Remove old state management code
- [ ] Simplify infrastructure classes
- [ ] Update documentation

## Risks and Mitigations

### Risk: Breaking Existing Behavior
**Mitigation**: Phase 2 runs both implementations in parallel to verify behavior matches

### Risk: Increased Complexity
**Mitigation**: FSM actually reduces complexity by making state explicit. Comprehensive tests ensure correctness.

### Risk: Performance Overhead
**Mitigation**: FSM is lightweight (just state tracking). No significant performance impact expected.

## Success Criteria

- [ ] All existing tests pass
- [ ] New FSM tests have >90% coverage
- [ ] State transitions are logged and observable
- [ ] Error recovery works as expected
- [ ] Documentation is updated
- [ ] Team understands FSM approach

## Questions to Consider

1. **Should we persist state history?** Could be useful for debugging crashes
2. **Should we add metrics?** Track time in each state, transition counts
3. **Should we visualize the FSM?** Generate diagrams from code
4. **Should we add state timeouts?** Prevent getting stuck in states
5. **Should we support sub-states?** For more granular control

## Next Steps

1. Review this plan with the team
2. Get approval for the approach
3. Start Phase 1 implementation
4. Set up CI/CD for FSM tests
5. Begin implementation following the codemap

## Resources

- **Full Codemap**: [worker-fsm-lifecycle.codemap.md](./worker-fsm-lifecycle.codemap.md)
- **Current Implementation**: `services/worker/src/presentation/MachineServer.ts`
- **FSM Pattern**: [State Pattern](https://refactoring.guru/design-patterns/state)
- **Testing Guide**: `services/worker/README.md`

