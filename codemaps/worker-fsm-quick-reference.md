# Worker FSM Refactoring - Quick Reference

## 📚 Documentation Index

### 1. [Full Codemap](./worker-fsm-lifecycle.codemap.md) 📖
**Purpose**: Complete implementation specification  
**Use When**: Implementing the FSM refactor  
**Contains**:
- Detailed sequence diagrams
- Complete type definitions
- All file locations and interfaces
- Testing strategy
- Migration phases

### 2. [Summary](./worker-fsm-lifecycle-summary.md) 📝
**Purpose**: High-level overview and planning  
**Use When**: Understanding the refactor approach  
**Contains**:
- Problem statement
- Solution overview
- Migration strategy
- Timeline and milestones
- Success criteria

### 3. [Visual Diagram](../docs/worker-fsm-diagram.md) 🎨
**Purpose**: Visual state machine reference  
**Use When**: Understanding state transitions  
**Contains**:
- ASCII state diagram
- State descriptions
- Event descriptions
- Transition examples
- Monitoring guidance

## 🚀 Quick Start

### For Implementers

1. **Read** the [Summary](./worker-fsm-lifecycle-summary.md) to understand the approach
2. **Review** the [Visual Diagram](../docs/worker-fsm-diagram.md) to understand states
3. **Follow** the [Full Codemap](./worker-fsm-lifecycle.codemap.md) for implementation
4. **Start** with Phase 1: Create FSM Infrastructure

### For Reviewers

1. **Check** the state diagram matches requirements
2. **Verify** all states and transitions are covered
3. **Review** error handling strategy
4. **Validate** testing approach

### For Operators

1. **Understand** the 8 states: `UNINITIALIZED`, `REGISTERING`, `WAITING_APPROVAL`, `CONNECTING`, `READY`, `STOPPING`, `STOPPED`, `ERROR`
2. **Monitor** state transitions in logs
3. **Check** state history for debugging
4. **Watch** for ERROR state entries

## 🎯 Key Concepts

### States (8 total)
```
UNINITIALIZED → REGISTERING → WAITING_APPROVAL → CONNECTING → READY
                                                              ↓
                                                          STOPPING
                                                              ↓
                                                          STOPPED

ERROR (can transition from any state, can RECOVER or STOP)
```

### Events (8 total)
- `START` - Begin worker initialization
- `REGISTERED` - Registration complete (already approved)
- `WAIT_APPROVAL` - Registration complete (needs approval)
- `APPROVED` - Admin approved worker
- `CONNECTED` - OpenCode connected successfully
- `STOP` - Begin graceful shutdown
- `ERROR` - Error occurred
- `RECOVER` - Attempt recovery from error

### Key Classes

```typescript
// Domain
WorkerStateMachine        // Core FSM logic
StateMachineConfig        // Transition rules

// Application
WorkerLifecycleManager    // Orchestrates FSM
RegistrationHandler       // Handles registration state
ConnectionHandler         // Handles connection state
ShutdownHandler          // Handles shutdown state
ErrorHandler             // Handles error state

// Presentation
MachineServer            // Updated to use lifecycle manager
```

## 📋 Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Create `WorkerStateMachine` entity
- [ ] Create `StateMachineConfig` value object
- [ ] Write FSM unit tests (>90% coverage)
- [ ] Create state handler interfaces

### Phase 2: Application Layer (Week 2)
- [ ] Implement `RegistrationHandler`
- [ ] Implement `ConnectionHandler`
- [ ] Implement `ShutdownHandler`
- [ ] Implement `ErrorHandler`
- [ ] Create `WorkerLifecycleManager`
- [ ] Write lifecycle manager tests
- [ ] Write integration tests

### Phase 3: Integration (Week 3)
- [ ] Update `MachineServer` to use lifecycle manager
- [ ] Add feature flag for gradual rollout
- [ ] Test both implementations in parallel
- [ ] Write E2E tests
- [ ] Verify behavior matches existing

### Phase 4: Migration (Week 4)
- [ ] Enable FSM by default
- [ ] Remove old state management code
- [ ] Simplify `ConvexClientAdapter`
- [ ] Update documentation
- [ ] Add state transition logging

## 🔍 Testing Strategy

### Unit Tests (Fast)
```bash
# Test FSM transitions
pnpm test WorkerStateMachine.test.ts

# Test state handlers
pnpm test stateHandlers/*.test.ts

# Test lifecycle manager
pnpm test WorkerLifecycleManager.test.ts
```

### Integration Tests (Medium)
```bash
# Test with real Convex client
pnpm test:integration WorkerLifecycle.test.ts
```

### E2E Tests (Slow)
```bash
# Test complete flows
pnpm test:e2e WorkerFSMFlow.test.ts
```

## 🐛 Debugging

### Check Current State
```typescript
const state = lifecycleManager.getState();
console.log('Current state:', state);
```

### View State History
```typescript
const history = lifecycleManager.getStateMachine().getHistory();
console.log('Last 10 transitions:', history.slice(-10));
```

### Check Error Details
```typescript
const fsm = lifecycleManager.getStateMachine();
if (fsm.error) {
  console.error('Error:', fsm.error.message);
  console.error('Stack:', fsm.error.stack);
}
```

## ⚠️ Common Issues

### Issue: Invalid Transition
**Symptom**: `Error: Invalid transition from X to Y`  
**Cause**: Attempting invalid state transition  
**Fix**: Check state diagram for valid transitions

### Issue: Stuck in WAITING_APPROVAL
**Symptom**: Worker never progresses past WAITING_APPROVAL  
**Cause**: Worker not approved in UI  
**Fix**: Approve worker in admin panel

### Issue: ERROR State
**Symptom**: Worker enters ERROR state  
**Cause**: Exception during operation  
**Fix**: Check error details, determine if recoverable

## 📊 Metrics to Monitor

### State Duration
- Time spent in each state
- Alert if stuck in non-terminal state

### Transition Counts
- Frequency of each transition
- Track ERROR state entries

### Recovery Success Rate
- RECOVER → READY (success)
- RECOVER → ERROR (failure)

## 🔗 Related Files

### Current Implementation
- `services/worker/src/presentation/MachineServer.ts`
- `services/worker/src/infrastructure/convex/ConvexClientAdapter.ts`
- `services/worker/src/application/ChatSessionManager.ts`

### New Files (to be created)
- `services/worker/src/domain/entities/WorkerStateMachine.ts`
- `services/worker/src/domain/valueObjects/StateMachineConfig.ts`
- `services/worker/src/application/WorkerLifecycleManager.ts`
- `services/worker/src/application/stateHandlers/*.ts`

### Tests (to be created)
- `services/worker/src/__tests__/domain/entities/WorkerStateMachine.test.ts`
- `services/worker/src/__tests__/application/WorkerLifecycleManager.test.ts`
- `services/worker/src/__tests__/integration/WorkerLifecycle.test.ts`
- `services/worker/src/__tests__/e2e/WorkerFSMFlow.test.ts`

## 💡 Tips

### For Implementation
1. Start with the FSM entity - it's the foundation
2. Write tests first (TDD approach)
3. Keep state handlers simple and focused
4. Use the codemap as your guide

### For Testing
1. Test invalid transitions are rejected
2. Test state history is tracked correctly
3. Test error recovery paths
4. Test complete lifecycle flows

### For Debugging
1. Enable state transition logging
2. Check state history for unexpected transitions
3. Verify state guards are working
4. Use FSM assertions liberally

## 🎓 Learning Resources

### State Machine Pattern
- [State Pattern (Refactoring Guru)](https://refactoring.guru/design-patterns/state)
- [Finite State Machines (Wikipedia)](https://en.wikipedia.org/wiki/Finite-state_machine)

### Clean Architecture
- Current worker follows Clean Architecture
- FSM fits in Domain layer
- Lifecycle manager in Application layer

## 📞 Support

### Questions?
- Review the [Full Codemap](./worker-fsm-lifecycle.codemap.md)
- Check the [Visual Diagram](../docs/worker-fsm-diagram.md)
- Read the [Summary](./worker-fsm-lifecycle-summary.md)

### Issues?
- Check state history for unexpected transitions
- Verify error details in FSM
- Review state handler implementations

## ✅ Success Criteria

- [ ] All existing tests pass
- [ ] FSM tests have >90% coverage
- [ ] State transitions are logged
- [ ] Error recovery works
- [ ] Documentation updated
- [ ] Team understands approach

## 🚦 Status

**Current Phase**: Planning Complete ✅  
**Next Phase**: Phase 1 - Foundation  
**Target Completion**: 4 weeks from start

---

**Last Updated**: 2025-11-02  
**Version**: 1.0  
**Status**: Ready for Implementation

