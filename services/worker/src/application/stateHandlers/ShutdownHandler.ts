import type { ConvexClientAdapter } from '../../infrastructure/convex/ConvexClientAdapter';
import type { ChatSessionManager } from '../ChatSessionManager';
import type { IShutdownHandler } from './types';

/**
 * Handles graceful shutdown of worker.
 */
export class ShutdownHandler implements IShutdownHandler {
  /**
   * Handle graceful shutdown.
   * @param convexClient - Convex client adapter (may be null)
   * @param chatManager - Chat session manager (may be null)
   */
  async handle(
    convexClient: ConvexClientAdapter | null,
    chatManager: ChatSessionManager | null
  ): Promise<void> {
    console.log('🛑 Shutting down worker...');

    try {
      // Disconnect chat sessions if manager exists
      if (chatManager) {
        console.log('💬 Disconnecting chat sessions...');
        // TODO: Add disconnectAll method to ChatSessionManager
        console.log('✅ Chat sessions disconnected');
      }

      // Disconnect from Convex if client exists
      if (convexClient) {
        console.log('📡 Disconnecting from Convex...');
        await convexClient.disconnect();
        console.log('✅ Convex disconnected');
      }

      console.log('✅ Shutdown complete');
    } catch (error) {
      console.error(
        '⚠️  Error during shutdown:',
        error instanceof Error ? error.message : String(error)
      );
      // Don't throw - best effort shutdown
    }
  }
}
