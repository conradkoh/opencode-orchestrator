import type { WorkerConfig } from '../../config';
import type { WorkerState } from '../../domain/entities/WorkerStateMachine';
import type { ConvexClientAdapter } from '../../infrastructure/convex/ConvexClientAdapter';
import type { ChatSessionManager } from '../ChatSessionManager';

/**
 * Context passed to state handlers.
 */
export interface StateContext {
  state: WorkerState;
  previousState: WorkerState | null;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Result of worker registration.
 */
export interface RegistrationResult {
  approved: boolean;
  workerId: string;
  name?: string;
}

/**
 * Handler for registration state logic.
 */
export interface IRegistrationHandler {
  /**
   * Handle worker registration with Convex.
   * @param convexClient - Convex client adapter
   * @param config - Worker configuration
   * @returns Registration result
   */
  handle(convexClient: ConvexClientAdapter, config: WorkerConfig): Promise<RegistrationResult>;
}

/**
 * Handler for connection state logic.
 */
export interface IConnectionHandler {
  /**
   * Handle OpenCode connection and initialization.
   * @param convexClient - Convex client adapter
   * @param chatManager - Chat session manager
   * @returns Promise that resolves when connection is complete
   */
  handle(convexClient: ConvexClientAdapter, chatManager: ChatSessionManager): Promise<void>;
}

/**
 * Handler for shutdown state logic.
 */
export interface IShutdownHandler {
  /**
   * Handle graceful shutdown of worker.
   * @param convexClient - Convex client adapter (may be null)
   * @param chatManager - Chat session manager (may be null)
   * @returns Promise that resolves when shutdown is complete
   */
  handle(
    convexClient: ConvexClientAdapter | null,
    chatManager: ChatSessionManager | null
  ): Promise<void>;
}

/**
 * Strategy for handling errors.
 */
export enum ErrorHandlingStrategy {
  /** Attempt to recover by re-registering */
  RECOVER = 'RECOVER',
  /** Fatal error, shut down */
  STOP = 'STOP',
  /** Log but continue (for non-critical errors) */
  IGNORE = 'IGNORE',
}

/**
 * Handler for error state logic.
 */
export interface IErrorHandler {
  /**
   * Handle error and determine recovery strategy.
   * @param error - The error that occurred
   * @param state - The state where error occurred
   * @returns Error handling strategy
   */
  handle(error: Error, state: WorkerState): Promise<ErrorHandlingStrategy>;
}
