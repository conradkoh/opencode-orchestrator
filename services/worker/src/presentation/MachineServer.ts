import type { MachineId, WorkerId } from '@domain/valueObjects/Ids';
import type { MachineToken } from '@domain/valueObjects/MachineToken';
import { ConvexClientAdapter } from '@infrastructure/convex/ConvexClientAdapter';
import { ChatSessionManager } from '../application/ChatSessionManager';
import type { WorkerConfig } from '../config';

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
  private _convexClient: ConvexClientAdapter | null = null;
  private _chatManager: ChatSessionManager | null = null;

  /**
   * Starts the worker and connects to Convex.
   *
   * Flow:
   * 1. Register with Convex and check authorization
   * 2. Wait for approval if pending
   * 3. Start heartbeat once approved
   * 4. TODO: Initialize OpenCode sessions
   * 5. TODO: Subscribe to Convex events
   *
   * @param config - Worker configuration with credentials
   * @throws Error if registration fails or configuration is invalid
   */
  async start(config: WorkerConfig): Promise<void> {
    if (this._isRunning) {
      throw new Error('Worker is already running');
    }

    console.log('🔐 Registering worker with Convex...');

    // Create Convex client
    this._convexClient = new ConvexClientAdapter(config.convexUrl, config);

    try {
      // Register and check approval status
      const registration = await this._convexClient.register();

      if (!registration.approved) {
        // Wait for approval
        await this._convexClient.waitForApproval();
      } else {
        console.log('✅ Worker already approved\n');
      }

      console.log(`Worker ID: ${registration.workerId}`);
      if (registration.name) {
        console.log(`Worker Name: ${registration.name}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to register worker: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Initialize chat session manager
    console.log('💬 Initializing chat session manager...');
    // Use current working directory as the workspace for opencode
    const workingDirectory = process.cwd();
    console.log(`📂 Working directory: ${workingDirectory}`);
    this._chatManager = new ChatSessionManager(this._convexClient, workingDirectory);

    // Set up event callbacks
    this._convexClient.onConnect(async () => {
      console.log('📞 Connect callback: initializing opencode client');
      try {
        await this._chatManager?.connect();
        console.log('✅ Opencode client connected and models published');
      } catch (error) {
        console.error('❌ Failed to connect opencode client:', error);
      }
    });

    this._convexClient.onSessionStart(async (sessionId, model) => {
      console.log(`📞 Session start callback: ${sessionId}`);
      await this._chatManager?.startSession(sessionId, model);
    });

    this._convexClient.onMessage(async (sessionId, messageId, content) => {
      console.log(`📞 Message callback: ${messageId} in session ${sessionId}`);
      await this._chatManager?.processMessage(sessionId, messageId, content);
    });

    console.log('✅ Chat system ready (waiting for connect request)');

    // TODO: Implement remaining startup flow
    // 2. Sync state
    // 3. Start monitors

    this._isRunning = true;
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

    console.log('🛑 Stopping machine server...');

    // TODO: Implement graceful shutdown
    // 1. Unsubscribe from events
    // 2. Terminate sessions

    // Disconnect from Convex (sets status to offline)
    if (this._convexClient) {
      await this._convexClient.disconnect();
      this._convexClient = null;
    }

    this._isRunning = false;
    console.log('✅ Machine server stopped');
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
