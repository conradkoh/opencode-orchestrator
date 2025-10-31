import type { MachineId, WorkerId } from '@domain/valueObjects/Ids';
import type { MachineToken } from '@domain/valueObjects/MachineToken';

/**
 * Configuration for starting the machine server.
 */
export interface StartConfig {
  /** Optional machine token for authentication. If not provided, user will be prompted. */
  token?: string;
  /** Root directory for worker operations. If not provided, user will be prompted. */
  rootDirectory?: string;
}

/**
 * Status information about the machine.
 */
export interface MachineStatus {
  /** Machine identifier */
  machineId: MachineId;
  /** Whether the machine is connected to Convex */
  isOnline: boolean;
  /** Number of registered workers */
  workerCount: number;
  /** Number of active sessions across all workers */
  activeSessionCount: number;
  /** Root directory for operations */
  rootDirectory: string;
}

/**
 * Main orchestrator class for the machine server.
 * Manages machine lifecycle, worker registration, and coordinates all operations.
 *
 * @example
 * ```typescript
 * const server = new MachineServer();
 * await server.start({ token: 'mch_xxx:sec_yyy' });
 * const workerId = await server.registerWorker('/path/to/project');
 * const status = server.getStatus();
 * await server.stop();
 * ```
 */
export class MachineServer {
  private _machineToken: MachineToken | null = null;
  private _rootDirectory: string | null = null;
  private _isRunning = false;

  /**
   * Starts the machine server and connects to Convex.
   *
   * Flow:
   * 1. Load or prompt for machine token
   * 2. Authenticate with Convex
   * 3. Sync state from Convex (workers, sessions)
   * 4. Initialize workers
   * 5. Subscribe to Convex events
   * 6. Start session lifecycle monitor
   *
   * @param config - Configuration for starting the server
   * @throws Error if authentication fails or configuration is invalid
   */
  async start(config: StartConfig): Promise<void> {
    if (this._isRunning) {
      throw new Error('Machine server is already running');
    }

    console.log('Starting machine server...');

    // TODO: Implement full startup flow
    // 1. Load or prompt for token
    // 2. Parse and validate token
    // 3. Authenticate with Convex
    // 4. Sync state
    // 5. Initialize workers
    // 6. Subscribe to events
    // 7. Start monitors

    this._isRunning = true;
    console.log('Machine server started');
  }

  /**
   * Stops the machine server gracefully.
   *
   * Flow:
   * 1. Unsubscribe from Convex events
   * 2. Terminate all active OpenCode sessions
   * 3. Update machine status to offline in Convex
   * 4. Close Convex connection
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    console.log('Stopping machine server...');

    // TODO: Implement graceful shutdown
    // 1. Unsubscribe from events
    // 2. Terminate sessions
    // 3. Update status
    // 4. Close connections

    this._isRunning = false;
    console.log('Machine server stopped');
  }

  /**
   * Registers a new worker in the specified directory.
   *
   * @param directory - Absolute path to the worker's working directory
   * @returns The generated worker ID
   * @throws Error if machine is not started or directory is invalid
   */
  async registerWorker(directory: string): Promise<WorkerId> {
    if (!this._isRunning) {
      throw new Error('Machine server is not running');
    }

    console.log(`Registering worker in directory: ${directory}`);

    // TODO: Implement worker registration
    // 1. Validate directory
    // 2. Generate worker ID
    // 3. Register with Convex
    // 4. Add to WorkerManager
    // 5. Return worker ID

    throw new Error('Not implemented');
  }

  /**
   * Gets the current status of the machine server.
   *
   * @returns Current machine status
   * @throws Error if machine is not started
   */
  getStatus(): MachineStatus {
    if (!this._isRunning || !this._machineToken || !this._rootDirectory) {
      throw new Error('Machine server is not running');
    }

    // TODO: Implement status gathering
    // 1. Get worker count from WorkerManager
    // 2. Get session count from all workers
    // 3. Return status object

    return {
      machineId: this._machineToken.getMachineId(),
      isOnline: true,
      workerCount: 0,
      activeSessionCount: 0,
      rootDirectory: this._rootDirectory,
    };
  }

  /**
   * Checks if the server is currently running.
   * @returns True if server is running
   */
  isRunning(): boolean {
    return this._isRunning;
  }
}
