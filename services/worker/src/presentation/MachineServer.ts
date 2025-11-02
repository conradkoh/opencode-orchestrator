import type { WorkerId } from '@domain/valueObjects/Ids';
import { WorkerLifecycleManager } from '../application/WorkerLifecycleManager';
import type { WorkerConfig } from '../config';
import { type StateTransition, WorkerState } from '../domain/entities/WorkerStateMachine';

/**
 * Status information about the machine.
 */
export interface MachineStatus {
  /** Current worker state */
  state: WorkerState;
  /** Whether the worker is ready to process messages */
  isReady: boolean;
  /** Current error message if any */
  error?: string;
  /** Recent state transition history */
  history: StateTransition[];
}

/**
 * Main orchestrator class for the machine server.
 * Manages machine lifecycle using a finite state machine.
 *
 * @example
 * ```typescript
 * const server = new MachineServer();
 * await server.start(config);
 * console.log('State:', server.getState());
 * const status = server.getStatus();
 * await server.stop();
 * ```
 */
export class MachineServer {
  private lifecycleManager: WorkerLifecycleManager;

  constructor() {
    this.lifecycleManager = new WorkerLifecycleManager();
  }

  /**
   * Starts the worker with FSM-managed lifecycle.
   *
   * Flow (managed by FSM):
   * 1. UNINITIALIZED → REGISTERING: Register with Convex
   * 2. REGISTERING → WAITING_APPROVAL or CONNECTING: Check approval
   * 3. WAITING_APPROVAL → CONNECTING: Wait for approval
   * 4. CONNECTING → READY: Initialize OpenCode and start subscriptions
   *
   * @param config - Worker configuration with credentials
   * @throws Error if registration fails or configuration is invalid
   */
  async start(config: WorkerConfig): Promise<void> {
    try {
      await this.lifecycleManager.start(config);
      console.log('✅ Worker started successfully');
    } catch (error) {
      console.error('❌ Failed to start worker:', error);
      throw error;
    }
  }

  /**
   * Stops the worker gracefully.
   *
   * Flow (managed by FSM):
   * 1. Current State → STOPPING: Begin shutdown
   * 2. STOPPING → STOPPED: Complete shutdown
   */
  async stop(): Promise<void> {
    try {
      await this.lifecycleManager.stop();
      console.log('✅ Worker stopped successfully');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Registers a new worker in the specified directory.
   * Note: This functionality is not yet implemented in the FSM refactor.
   *
   * @param _directory - Absolute path to the worker's working directory
   * @returns The generated worker ID
   * @throws Error - Not yet implemented
   */
  async registerWorker(_directory: string): Promise<WorkerId> {
    throw new Error('Worker registration not yet implemented in FSM refactor');
  }

  /**
   * Gets the current worker state.
   * @returns Current state
   */
  getState(): WorkerState {
    return this.lifecycleManager.getState();
  }

  /**
   * Checks if the worker is ready to process messages.
   * @returns True if in READY state
   */
  isReady(): boolean {
    return this.lifecycleManager.isReady();
  }

  /**
   * Gets the current status including state history.
   * @returns Current machine status
   */
  getStatus(): MachineStatus {
    const fsm = this.lifecycleManager.getStateMachine();
    const state = this.lifecycleManager.getState();

    return {
      state,
      isReady: this.lifecycleManager.isReady(),
      error: fsm.error?.message,
      history: fsm.getHistory().slice(-10), // Last 10 transitions
    };
  }

  /**
   * Checks if the server is currently running.
   * @returns True if not in UNINITIALIZED or STOPPED state
   */
  isRunning(): boolean {
    const state = this.lifecycleManager.getState();
    return state !== WorkerState.UNINITIALIZED && state !== WorkerState.STOPPED;
  }
}
