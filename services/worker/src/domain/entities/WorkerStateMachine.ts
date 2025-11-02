/**
 * Worker lifecycle states.
 */
export enum WorkerState {
  UNINITIALIZED = 'UNINITIALIZED',
  REGISTERING = 'REGISTERING',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
  CONNECTING = 'CONNECTING',
  READY = 'READY',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
}

/**
 * Events that trigger state transitions.
 */
export enum WorkerEvent {
  START = 'START',
  REGISTERED = 'REGISTERED',
  WAIT_APPROVAL = 'WAIT_APPROVAL',
  APPROVED = 'APPROVED',
  CONNECTED = 'CONNECTED',
  STOP = 'STOP',
  ERROR = 'ERROR',
  RECOVER = 'RECOVER',
}

/**
 * Represents a state transition in the history.
 */
export interface StateTransition {
  /** The state transitioned from */
  from: WorkerState;
  /** The state transitioned to */
  to: WorkerState;
  /** The event that triggered the transition */
  event: WorkerEvent;
  /** Unix timestamp when the transition occurred */
  timestamp: number;
  /** Error associated with the transition, if any */
  error?: Error;
}

/**
 * Interface for Worker State Machine.
 */
export interface IWorkerStateMachine {
  /** The current state of the worker */
  readonly currentState: WorkerState;
  /** The previous state before the last transition, or null if no transitions have occurred */
  readonly previousState: WorkerState | null;
  /** The current error if the worker is in ERROR state, or null otherwise */
  readonly error: Error | null;

  /**
   * Attempt to transition to a new state via an event.
   * @param event - The event triggering the transition
   * @throws Error if transition is invalid
   */
  transition(event: WorkerEvent): void;

  /**
   * Check if a transition is valid from current state.
   * @param event - The event to check
   * @returns True if transition is valid
   */
  canTransition(event: WorkerEvent): boolean;

  /**
   * Check if currently in a specific state.
   * @param state - The state to check
   * @returns True if in the specified state
   */
  is(state: WorkerState): boolean;

  /**
   * Check if in one of multiple states.
   * @param states - States to check
   * @returns True if in any of the specified states
   */
  isOneOf(...states: WorkerState[]): boolean;

  /**
   * Assert current state matches expected state.
   * @param expected - Expected state
   * @throws Error if state doesn't match
   */
  assertState(expected: WorkerState): void;

  /**
   * Get state history for debugging.
   * @returns Array of state transitions
   */
  getHistory(): StateTransition[];

  /**
   * Capture error information.
   * @param error - Error to capture
   */
  setError(error: Error): void;

  /**
   * Clear error information.
   */
  clearError(): void;
}

/**
 * State transition map defining valid transitions.
 * Maps each state to the events it can handle and their resulting states.
 */
const _STATE_TRANSITIONS: Record<WorkerState, Partial<Record<WorkerEvent, WorkerState>>> = {
  [WorkerState.UNINITIALIZED]: {
    [WorkerEvent.START]: WorkerState.REGISTERING,
  },
  [WorkerState.REGISTERING]: {
    [WorkerEvent.REGISTERED]: WorkerState.CONNECTING,
    [WorkerEvent.WAIT_APPROVAL]: WorkerState.WAITING_APPROVAL,
    [WorkerEvent.ERROR]: WorkerState.ERROR,
  },
  [WorkerState.WAITING_APPROVAL]: {
    [WorkerEvent.APPROVED]: WorkerState.CONNECTING,
    [WorkerEvent.ERROR]: WorkerState.ERROR,
    [WorkerEvent.STOP]: WorkerState.STOPPING,
  },
  [WorkerState.CONNECTING]: {
    [WorkerEvent.CONNECTED]: WorkerState.READY,
    [WorkerEvent.ERROR]: WorkerState.ERROR,
  },
  [WorkerState.READY]: {
    [WorkerEvent.STOP]: WorkerState.STOPPING,
    [WorkerEvent.ERROR]: WorkerState.ERROR,
  },
  [WorkerState.ERROR]: {
    [WorkerEvent.RECOVER]: WorkerState.REGISTERING,
    [WorkerEvent.STOP]: WorkerState.STOPPING,
  },
  [WorkerState.STOPPING]: {
    // Terminal transition - no outgoing transitions
  },
  [WorkerState.STOPPED]: {
    // Terminal state - no outgoing transitions
  },
};

/**
 * Worker State Machine entity.
 * Manages worker lifecycle states and enforces valid transitions.
 */
export class WorkerStateMachine implements IWorkerStateMachine {
  private _currentState: WorkerState;
  private _previousState: WorkerState | null;
  private _error: Error | null;
  private _history: StateTransition[];
  private readonly _maxHistorySize: number;

  private constructor(initialState: WorkerState = WorkerState.UNINITIALIZED, maxHistorySize = 50) {
    this._currentState = initialState;
    this._previousState = null;
    this._error = null;
    this._history = [];
    this._maxHistorySize = maxHistorySize;
  }

  /**
   * Creates a new WorkerStateMachine instance.
   * @param maxHistorySize - Maximum number of transitions to keep in history
   * @returns A new WorkerStateMachine instance
   */
  static create(maxHistorySize = 50): WorkerStateMachine {
    return new WorkerStateMachine(WorkerState.UNINITIALIZED, maxHistorySize);
  }

  /**
   * Gets the current state.
   */
  get currentState(): WorkerState {
    return this._currentState;
  }

  /**
   * Gets the previous state.
   */
  get previousState(): WorkerState | null {
    return this._previousState;
  }

  /**
   * Gets the current error if any.
   */
  get error(): Error | null {
    return this._error;
  }

  /**
   * Attempt to transition to a new state via an event.
   * @param event - The event triggering the transition
   * @throws Error if transition is invalid
   */
  transition(event: WorkerEvent): void {
    const nextState = this._getNextState(event);

    if (!nextState) {
      throw new Error(
        `Invalid transition: Cannot transition from ${this._currentState} via ${event}`
      );
    }

    // Record transition in history
    const transition: StateTransition = {
      from: this._currentState,
      to: nextState,
      event,
      timestamp: Date.now(),
      error: this._error || undefined,
    };

    this._history.push(transition);

    // Trim history if needed
    if (this._history.length > this._maxHistorySize) {
      this._history.shift();
    }

    // Update state
    this._previousState = this._currentState;
    this._currentState = nextState;

    // Clear error if transitioning out of ERROR state (except when stopping)
    if (this._previousState === WorkerState.ERROR && event !== WorkerEvent.STOP) {
      this._error = null;
    }
  }

  /**
   * Check if a transition is valid from current state.
   * @param event - The event to check
   * @returns True if transition is valid
   */
  canTransition(event: WorkerEvent): boolean {
    return this._getNextState(event) !== null;
  }

  /**
   * Check if currently in a specific state.
   * @param state - The state to check
   * @returns True if in the specified state
   */
  is(state: WorkerState): boolean {
    return this._currentState === state;
  }

  /**
   * Check if in one of multiple states.
   * @param states - States to check
   * @returns True if in any of the specified states
   */
  isOneOf(...states: WorkerState[]): boolean {
    return states.includes(this._currentState);
  }

  /**
   * Assert current state matches expected state.
   * @param expected - Expected state
   * @throws Error if state doesn't match
   */
  assertState(expected: WorkerState): void {
    if (this._currentState !== expected) {
      throw new Error(`Expected state ${expected} but current state is ${this._currentState}`);
    }
  }

  /**
   * Get state history for debugging.
   * @returns Array of state transitions
   */
  getHistory(): StateTransition[] {
    return [...this._history];
  }

  /**
   * Capture error information.
   * @param error - Error to capture
   */
  setError(error: Error): void {
    this._error = error;
  }

  /**
   * Clear error information.
   */
  clearError(): void {
    this._error = null;
  }

  /**
   * Gets the next state for a given event from current state.
   * @param event - The event
   * @returns Next state or null if transition is invalid
   */
  private _getNextState(event: WorkerEvent): WorkerState | null {
    const transitions = _STATE_TRANSITIONS[this._currentState];
    return transitions?.[event] ?? null;
  }
}
