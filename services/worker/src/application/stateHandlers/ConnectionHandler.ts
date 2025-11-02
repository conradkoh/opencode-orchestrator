import type { ConvexClientAdapter } from '../../infrastructure/convex/ConvexClientAdapter';
import type { ChatSessionManager } from '../ChatSessionManager';
import type { IConnectionHandler } from './types';

/**
 * Handles OpenCode connection and initialization.
 */
export class ConnectionHandler implements IConnectionHandler {
  /**
   * Handle connection setup.
   * @param convexClient - Convex client adapter
   * @param chatManager - Chat session manager
   */
  async handle(convexClient: ConvexClientAdapter, chatManager: ChatSessionManager): Promise<void> {
    console.log('🔌 Connecting to OpenCode...');

    try {
      // Start heartbeat to maintain online status
      convexClient.startHeartbeat();
      console.log('✅ Heartbeat started');

      // Initialize chat session manager
      console.log('💬 Initializing chat session manager...');
      await chatManager.connect();
      console.log('✅ OpenCode client connected and models published');

      console.log('✅ Connection complete');
    } catch (error) {
      throw new Error(
        `Failed to connect: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
