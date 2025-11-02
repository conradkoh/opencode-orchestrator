import type { WorkerState } from '../../domain/entities/WorkerStateMachine';
import { WorkerState as State } from '../../domain/entities/WorkerStateMachine';
import type { IErrorHandler } from './types';
import { ErrorHandlingStrategy } from './types';

/**
 * Handles error state logic and determines recovery strategy.
 */
export class ErrorHandler implements IErrorHandler {
  /**
   * Handle error and determine recovery strategy.
   * @param error - The error that occurred
   * @param state - The state where error occurred
   * @returns Error handling strategy
   */
  async handle(error: Error, state: WorkerState): Promise<ErrorHandlingStrategy> {
    console.error('❌ Error occurred:', error.message);
    console.error('   State:', state);

    // Log full error details
    this.logError(error, state);

    // Determine if error is recoverable
    if (this.isRecoverable(error, state)) {
      console.log('🔄 Error is recoverable, will attempt to recover');
      return ErrorHandlingStrategy.RECOVER;
    }

    console.log('🛑 Error is fatal, will shut down');
    return ErrorHandlingStrategy.STOP;
  }

  /**
   * Determine if an error is recoverable.
   * @param error - The error
   * @param state - The state where error occurred
   * @returns True if error is recoverable
   */
  private isRecoverable(error: Error, state: WorkerState): boolean {
    // Don't try to recover if already stopping
    if (state === State.STOPPING || state === State.STOPPED) {
      return false;
    }

    // Network errors are generally recoverable
    if (this.isNetworkError(error)) {
      return true;
    }

    // Authentication errors might be recoverable (token might have been refreshed)
    if (this.isAuthError(error)) {
      return true;
    }

    // Configuration errors are not recoverable
    if (this.isConfigError(error)) {
      return false;
    }

    // Default to not recoverable for safety
    return false;
  }

  /**
   * Check if error is a network error.
   */
  private isNetworkError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    );
  }

  /**
   * Check if error is an authentication error.
   */
  private isAuthError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('invalid token') ||
      message.includes('forbidden')
    );
  }

  /**
   * Check if error is a configuration error.
   */
  private isConfigError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('configuration') ||
      message.includes('invalid config') ||
      message.includes('missing required')
    );
  }

  /**
   * Log error details for debugging.
   */
  private logError(error: Error, state: WorkerState): void {
    console.error('\n=== Error Details ===');
    console.error('Message:', error.message);
    console.error('State:', state);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    console.error('===================\n');
  }
}
