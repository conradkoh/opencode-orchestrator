import { beforeEach, describe, expect, it } from 'vitest';
import { WorkerEvent, WorkerState, WorkerStateMachine } from './WorkerStateMachine';

describe('WorkerStateMachine', () => {
  let fsm: WorkerStateMachine;

  beforeEach(() => {
    fsm = WorkerStateMachine.create();
  });

  describe('initialization', () => {
    it('should start in UNINITIALIZED state', () => {
      expect(fsm.currentState).toBe(WorkerState.UNINITIALIZED);
    });

    it('should have no previous state initially', () => {
      expect(fsm.previousState).toBeNull();
    });

    it('should have no error initially', () => {
      expect(fsm.error).toBeNull();
    });

    it('should have empty history initially', () => {
      expect(fsm.getHistory()).toEqual([]);
    });

    it('should accept custom max history size', () => {
      const customFsm = WorkerStateMachine.create(10);
      expect(customFsm).toBeDefined();
    });
  });

  describe('state checking', () => {
    it('should correctly check if in a specific state', () => {
      expect(fsm.is(WorkerState.UNINITIALIZED)).toBe(true);
      expect(fsm.is(WorkerState.REGISTERING)).toBe(false);
    });

    it('should correctly check if in one of multiple states', () => {
      expect(fsm.isOneOf(WorkerState.UNINITIALIZED, WorkerState.REGISTERING)).toBe(true);
      expect(fsm.isOneOf(WorkerState.REGISTERING, WorkerState.CONNECTING)).toBe(false);
    });

    it('should assert state successfully when correct', () => {
      expect(() => fsm.assertState(WorkerState.UNINITIALIZED)).not.toThrow();
    });

    it('should throw when asserting incorrect state', () => {
      expect(() => fsm.assertState(WorkerState.REGISTERING)).toThrow(
        'Expected state REGISTERING but current state is UNINITIALIZED'
      );
    });
  });

  describe('valid transitions', () => {
    it('should transition from UNINITIALIZED to REGISTERING via START', () => {
      fsm.transition(WorkerEvent.START);
      expect(fsm.currentState).toBe(WorkerState.REGISTERING);
      expect(fsm.previousState).toBe(WorkerState.UNINITIALIZED);
    });

    it('should transition from REGISTERING to CONNECTING via REGISTERED', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.REGISTERED);
      expect(fsm.currentState).toBe(WorkerState.CONNECTING);
      expect(fsm.previousState).toBe(WorkerState.REGISTERING);
    });

    it('should transition from REGISTERING to WAITING_APPROVAL via WAIT_APPROVAL', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.WAIT_APPROVAL);
      expect(fsm.currentState).toBe(WorkerState.WAITING_APPROVAL);
    });

    it('should transition from WAITING_APPROVAL to CONNECTING via APPROVED', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.WAIT_APPROVAL);
      fsm.transition(WorkerEvent.APPROVED);
      expect(fsm.currentState).toBe(WorkerState.CONNECTING);
    });

    it('should transition from CONNECTING to READY via CONNECTED', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.REGISTERED);
      fsm.transition(WorkerEvent.CONNECTED);
      expect(fsm.currentState).toBe(WorkerState.READY);
    });

    it('should transition from READY to STOPPING via STOP', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.REGISTERED);
      fsm.transition(WorkerEvent.CONNECTED);
      fsm.transition(WorkerEvent.STOP);
      expect(fsm.currentState).toBe(WorkerState.STOPPING);
    });

    it('should transition to ERROR from REGISTERING via ERROR', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.ERROR);
      expect(fsm.currentState).toBe(WorkerState.ERROR);
    });

    it('should transition from ERROR to REGISTERING via RECOVER', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.ERROR);
      fsm.transition(WorkerEvent.RECOVER);
      expect(fsm.currentState).toBe(WorkerState.REGISTERING);
    });

    it('should transition from ERROR to STOPPING via STOP', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.ERROR);
      fsm.transition(WorkerEvent.STOP);
      expect(fsm.currentState).toBe(WorkerState.STOPPING);
    });
  });

  describe('invalid transitions', () => {
    it('should throw on invalid transition from UNINITIALIZED', () => {
      expect(() => fsm.transition(WorkerEvent.CONNECTED)).toThrow(
        'Invalid transition: Cannot transition from UNINITIALIZED via CONNECTED'
      );
    });

    it('should throw on invalid transition from REGISTERING', () => {
      fsm.transition(WorkerEvent.START);
      expect(() => fsm.transition(WorkerEvent.CONNECTED)).toThrow(
        'Invalid transition: Cannot transition from REGISTERING via CONNECTED'
      );
    });

    it('should throw on invalid transition from READY', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.REGISTERED);
      fsm.transition(WorkerEvent.CONNECTED);
      expect(() => fsm.transition(WorkerEvent.START)).toThrow(
        'Invalid transition: Cannot transition from READY via START'
      );
    });

    it('should throw on transition from STOPPING (terminal)', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.REGISTERED);
      fsm.transition(WorkerEvent.CONNECTED);
      fsm.transition(WorkerEvent.STOP);
      expect(() => fsm.transition(WorkerEvent.START)).toThrow(
        'Invalid transition: Cannot transition from STOPPING via START'
      );
    });

    it('should throw on transition from STOPPED (terminal)', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.REGISTERED);
      fsm.transition(WorkerEvent.CONNECTED);
      fsm.transition(WorkerEvent.STOP);
      // Manually set to STOPPED for testing
      (fsm as any)._currentState = WorkerState.STOPPED;
      expect(() => fsm.transition(WorkerEvent.START)).toThrow(
        'Invalid transition: Cannot transition from STOPPED via START'
      );
    });
  });

  describe('canTransition', () => {
    it('should return true for valid transitions', () => {
      expect(fsm.canTransition(WorkerEvent.START)).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(fsm.canTransition(WorkerEvent.CONNECTED)).toBe(false);
    });

    it('should check transitions from current state', () => {
      fsm.transition(WorkerEvent.START);
      expect(fsm.canTransition(WorkerEvent.REGISTERED)).toBe(true);
      expect(fsm.canTransition(WorkerEvent.START)).toBe(false);
    });
  });

  describe('state history', () => {
    it('should record transitions in history', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.REGISTERED);

      const history = fsm.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].from).toBe(WorkerState.UNINITIALIZED);
      expect(history[0].to).toBe(WorkerState.REGISTERING);
      expect(history[0].event).toBe(WorkerEvent.START);
      expect(history[1].from).toBe(WorkerState.REGISTERING);
      expect(history[1].to).toBe(WorkerState.CONNECTING);
      expect(history[1].event).toBe(WorkerEvent.REGISTERED);
    });

    it('should include timestamp in transitions', () => {
      const before = Date.now();
      fsm.transition(WorkerEvent.START);
      const after = Date.now();

      const history = fsm.getHistory();
      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should return a copy of history (not reference)', () => {
      fsm.transition(WorkerEvent.START);
      const history1 = fsm.getHistory();
      const history2 = fsm.getHistory();

      expect(history1).toEqual(history2);
      expect(history1).not.toBe(history2);
    });

    it('should limit history size', () => {
      const smallFsm = WorkerStateMachine.create(3);

      // Make 5 transitions
      smallFsm.transition(WorkerEvent.START);
      smallFsm.transition(WorkerEvent.ERROR);
      smallFsm.transition(WorkerEvent.RECOVER);
      smallFsm.transition(WorkerEvent.ERROR);
      smallFsm.transition(WorkerEvent.RECOVER);

      const history = smallFsm.getHistory();
      expect(history).toHaveLength(3);
      // Should keep the last 3 transitions
      expect(history[0].event).toBe(WorkerEvent.RECOVER);
      expect(history[1].event).toBe(WorkerEvent.ERROR);
      expect(history[2].event).toBe(WorkerEvent.RECOVER);
    });
  });

  describe('error handling', () => {
    it('should capture error information', () => {
      const error = new Error('Test error');
      fsm.setError(error);
      expect(fsm.error).toBe(error);
    });

    it('should clear error information', () => {
      const error = new Error('Test error');
      fsm.setError(error);
      fsm.clearError();
      expect(fsm.error).toBeNull();
    });

    it('should include error in transition history', () => {
      const error = new Error('Test error');
      fsm.setError(error);
      fsm.transition(WorkerEvent.START);

      const history = fsm.getHistory();
      expect(history[0].error).toBe(error);
    });

    it('should clear error when recovering from ERROR state', () => {
      const error = new Error('Test error');
      fsm.transition(WorkerEvent.START);
      fsm.setError(error);
      fsm.transition(WorkerEvent.ERROR);

      expect(fsm.error).toBe(error);

      fsm.transition(WorkerEvent.RECOVER);
      expect(fsm.error).toBeNull();
    });

    it('should not clear error when stopping from ERROR state', () => {
      const error = new Error('Test error');
      fsm.transition(WorkerEvent.START);
      fsm.setError(error);
      fsm.transition(WorkerEvent.ERROR);

      fsm.transition(WorkerEvent.STOP);
      expect(fsm.error).toBe(error);
    });
  });

  describe('complete lifecycle flows', () => {
    it('should handle happy path (already approved)', () => {
      fsm.transition(WorkerEvent.START);
      expect(fsm.currentState).toBe(WorkerState.REGISTERING);

      fsm.transition(WorkerEvent.REGISTERED);
      expect(fsm.currentState).toBe(WorkerState.CONNECTING);

      fsm.transition(WorkerEvent.CONNECTED);
      expect(fsm.currentState).toBe(WorkerState.READY);

      fsm.transition(WorkerEvent.STOP);
      expect(fsm.currentState).toBe(WorkerState.STOPPING);

      const history = fsm.getHistory();
      expect(history).toHaveLength(4);
    });

    it('should handle approval waiting flow', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.WAIT_APPROVAL);
      expect(fsm.currentState).toBe(WorkerState.WAITING_APPROVAL);

      fsm.transition(WorkerEvent.APPROVED);
      expect(fsm.currentState).toBe(WorkerState.CONNECTING);

      fsm.transition(WorkerEvent.CONNECTED);
      expect(fsm.currentState).toBe(WorkerState.READY);

      fsm.transition(WorkerEvent.STOP);
      expect(fsm.currentState).toBe(WorkerState.STOPPING);
    });

    it('should handle error recovery flow', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.REGISTERED);
      fsm.transition(WorkerEvent.ERROR);
      expect(fsm.currentState).toBe(WorkerState.ERROR);

      fsm.transition(WorkerEvent.RECOVER);
      expect(fsm.currentState).toBe(WorkerState.REGISTERING);

      fsm.transition(WorkerEvent.REGISTERED);
      fsm.transition(WorkerEvent.CONNECTED);
      expect(fsm.currentState).toBe(WorkerState.READY);
    });

    it('should handle fatal error flow', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.REGISTERED);
      fsm.transition(WorkerEvent.ERROR);
      expect(fsm.currentState).toBe(WorkerState.ERROR);

      fsm.transition(WorkerEvent.STOP);
      expect(fsm.currentState).toBe(WorkerState.STOPPING);
    });

    it('should handle stop during approval waiting', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.WAIT_APPROVAL);
      fsm.transition(WorkerEvent.STOP);
      expect(fsm.currentState).toBe(WorkerState.STOPPING);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple error transitions', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.ERROR);
      fsm.transition(WorkerEvent.RECOVER);
      fsm.transition(WorkerEvent.ERROR);
      expect(fsm.currentState).toBe(WorkerState.ERROR);
    });

    it('should maintain state consistency after failed transition', () => {
      fsm.transition(WorkerEvent.START);
      const stateBefore = fsm.currentState;

      try {
        fsm.transition(WorkerEvent.CONNECTED);
      } catch {
        // Expected to throw
      }

      expect(fsm.currentState).toBe(stateBefore);
    });

    it('should handle rapid state transitions', () => {
      fsm.transition(WorkerEvent.START);
      fsm.transition(WorkerEvent.REGISTERED);
      fsm.transition(WorkerEvent.CONNECTED);
      fsm.transition(WorkerEvent.STOP);

      expect(fsm.currentState).toBe(WorkerState.STOPPING);
      expect(fsm.getHistory()).toHaveLength(4);
    });
  });
});
