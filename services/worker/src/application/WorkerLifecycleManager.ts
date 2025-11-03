import type { WorkerConfig } from '../config';
import {
  type IWorkerStateMachine,
  WorkerEvent,
  WorkerState,
  WorkerStateMachine,
} from '../domain/entities/WorkerStateMachine';
import { ConvexClientAdapter } from '../infrastructure/convex/ConvexClientAdapter';
import { ChatSessionManager } from './ChatSessionManager';
import {
  ConnectionHandler,
  ErrorHandler,
  ErrorHandlingStrategy,
  RegistrationHandler,
  ShutdownHandler,
} from './stateHandlers';

/**
 * Interface for Worker Lifecycle Manager.
 */
export interface IWorkerLifecycleManager {
  /**
   * Start the worker lifecycle.
   * @param config - Worker configuration
   */
  start(config: WorkerConfig): Promise<void>;

  /**
   * Stop the worker gracefully.
   */
  stop(): Promise<void>;

  /**
   * Get current state.
   */
  getState(): WorkerState;

  /**
   * Check if worker is ready to process messages.
   */
  isReady(): boolean;

  /**
   * Get state machine for inspection.
   */
  getStateMachine(): IWorkerStateMachine;
}

/**
 * Manages worker lifecycle using a finite state machine.
 * Orchestrates state transitions and coordinates infrastructure components.
 */
export class WorkerLifecycleManager implements IWorkerLifecycleManager {
  private fsm: WorkerStateMachine;
  private convexClient: ConvexClientAdapter | null;
  private chatManager: ChatSessionManager | null;
  private config: WorkerConfig | null;
  private approvalPoller: NodeJS.Timeout | null;

  // State handlers
  private registrationHandler: RegistrationHandler;
  private connectionHandler: ConnectionHandler;
  private shutdownHandler: ShutdownHandler;
  private errorHandler: ErrorHandler;

  constructor() {
    this.fsm = WorkerStateMachine.create();
    this.convexClient = null;
    this.chatManager = null;
    this.config = null;
    this.approvalPoller = null;

    // Initialize handlers
    this.registrationHandler = new RegistrationHandler();
    this.connectionHandler = new ConnectionHandler();
    this.shutdownHandler = new ShutdownHandler();
    this.errorHandler = new ErrorHandler();
  }

  /**
   * Start the worker lifecycle.
   */
  async start(config: WorkerConfig): Promise<void> {
    this.fsm.assertState(WorkerState.UNINITIALIZED);
    this.config = config;

    try {
      // Transition to REGISTERING
      this.fsm.transition(WorkerEvent.START);
      await this.handleRegistering();
    } catch (error) {
      await this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Stop the worker gracefully.
   */
  async stop(): Promise<void> {
    // Can stop from WAITING_APPROVAL, READY, or ERROR states
    if (!this.fsm.isOneOf(WorkerState.WAITING_APPROVAL, WorkerState.READY, WorkerState.ERROR)) {
      console.warn(`⚠️  Cannot stop from state ${this.fsm.currentState}`);
      return;
    }

    try {
      this.fsm.transition(WorkerEvent.STOP);
      await this.handleStopping();
    } catch (error) {
      console.error('Error during stop:', error);
      // Best effort - don't throw
    }
  }

  /**
   * Get current state.
   */
  getState(): WorkerState {
    return this.fsm.currentState;
  }

  /**
   * Check if worker is ready to process messages.
   */
  isReady(): boolean {
    return this.fsm.is(WorkerState.READY);
  }

  /**
   * Get state machine for inspection.
   */
  getStateMachine(): IWorkerStateMachine {
    return this.fsm;
  }

  /**
   * Handle REGISTERING state.
   */
  private async handleRegistering(): Promise<void> {
    if (!this.config) {
      throw new Error('Config not set');
    }

    try {
      // Create Convex client
      this.convexClient = new ConvexClientAdapter(this.config.convexUrl, this.config);

      // Register with Convex
      const result = await this.registrationHandler.handle(this.convexClient, this.config);

      if (result.approved) {
        // Already approved, proceed to connecting
        this.fsm.transition(WorkerEvent.REGISTERED);
        await this.handleConnecting();
      } else {
        // Need approval, wait for it
        this.fsm.transition(WorkerEvent.WAIT_APPROVAL);
        await this.handleWaitingApproval();
      }
    } catch (error) {
      await this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Handle WAITING_APPROVAL state.
   */
  private async handleWaitingApproval(): Promise<void> {
    console.log('⏳ Waiting for authorization approval...');
    console.log('   Please approve this worker in the web UI\n');

    // Start polling for approval
    this.startApprovalPolling();
  }

  /**
   * Handle CONNECTING state.
   */
  private async handleConnecting(): Promise<void> {
    if (!this.convexClient || !this.config) {
      throw new Error('Convex client or config not initialized');
    }

    try {
      // Create chat manager
      const workingDirectory = process.cwd();
      this.chatManager = new ChatSessionManager(this.convexClient, workingDirectory);

      // Set up event callbacks
      this.setupConvexCallbacks();

      // Connect and initialize
      await this.connectionHandler.handle(this.convexClient, this.chatManager);

      // Transition to READY
      this.fsm.transition(WorkerEvent.CONNECTED);
      await this.handleReady();
    } catch (error) {
      await this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Handle READY state.
   */
  private async handleReady(): Promise<void> {
    console.log('\n✅ Worker is ready and connected');
    console.log('📡 Listening for messages...\n');
  }

  /**
   * Handle STOPPING state.
   */
  private async handleStopping(): Promise<void> {
    // Stop approval polling if running
    this.stopApprovalPolling();

    // Shutdown
    await this.shutdownHandler.handle(this.convexClient, this.chatManager);

    // Clean up references
    this.convexClient = null;
    this.chatManager = null;
    this.config = null;

    // Mark as stopped (manually set since STOPPING has no outgoing transitions)
    // biome-ignore lint/suspicious/noExplicitAny: STOPPING has no outgoing transitions, manual state set required
    (this.fsm as any)._currentState = WorkerState.STOPPED;
  }

  /**
   * Handle ERROR state.
   */
  private async handleError(error: Error): Promise<void> {
    console.error('\n❌ Error in worker lifecycle:', error.message);

    // Capture error in FSM
    this.fsm.setError(error);

    // Transition to ERROR state if not already there
    if (!this.fsm.is(WorkerState.ERROR)) {
      this.fsm.transition(WorkerEvent.ERROR);
    }

    // Determine recovery strategy
    const strategy = await this.errorHandler.handle(
      error,
      this.fsm.previousState || this.fsm.currentState
    );

    if (strategy === ErrorHandlingStrategy.RECOVER) {
      // Attempt recovery
      console.log('🔄 Attempting to recover...');
      try {
        this.fsm.transition(WorkerEvent.RECOVER);
        await this.handleRegistering();
      } catch (recoveryError) {
        console.error('❌ Recovery failed:', recoveryError);
        // Give up and stop
        await this.stop();
      }
    } else if (strategy === ErrorHandlingStrategy.STOP) {
      // Fatal error, stop
      await this.stop();
    }
  }

  /**
   * Set up Convex event callbacks.
   */
  private setupConvexCallbacks(): void {
    if (!this.convexClient || !this.chatManager) {
      return;
    }

    this.convexClient.onConnect(async () => {
      console.log('📞 Connect callback: initializing opencode client');
      try {
        await this.chatManager?.connect();
        console.log('✅ Opencode client connected and models published');
      } catch (error) {
        console.error('❌ Failed to connect opencode client:', error);
        await this.handleError(error as Error);
      }
    });

    this.convexClient.onSessionStart(async (sessionId, model) => {
      console.log(`📞 Session start callback: ${sessionId}`);
      try {
        await this.chatManager?.startSession(sessionId, model);
      } catch (error) {
        console.error('❌ Failed to start session:', error);
        // Don't crash the whole worker for session errors
      }
    });

    this.convexClient.onMessage(async (sessionId, messageId, content) => {
      console.log(`📞 Message callback: ${messageId} in session ${sessionId}`);

      // Only process messages if we're ready
      if (!this.isReady()) {
        console.warn('⚠️  Received message but worker is not ready');
        return;
      }

      try {
        await this.chatManager?.processMessage(sessionId, messageId, content);
      } catch (error) {
        console.error('❌ Failed to process message:', error);
        // Don't crash the whole worker for message errors
      }
    });
  }

  /**
   * Start polling for approval.
   */
  private startApprovalPolling(): void {
    if (this.approvalPoller) {
      return; // Already polling
    }

    this.approvalPoller = setInterval(async () => {
      try {
        if (!this.convexClient) {
          this.stopApprovalPolling();
          return;
        }

        const result = await this.convexClient.register();

        if (result.approved) {
          console.log('✅ Worker approved! Continuing...\n');
          this.stopApprovalPolling();

          // Transition to connecting
          this.fsm.transition(WorkerEvent.APPROVED);
          await this.handleConnecting();
        }
      } catch (error) {
        console.error('❌ Error checking approval:', error);
        this.stopApprovalPolling();
        await this.handleError(error as Error);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop polling for approval.
   */
  private stopApprovalPolling(): void {
    if (this.approvalPoller) {
      clearInterval(this.approvalPoller);
      this.approvalPoller = null;
    }
  }
}
