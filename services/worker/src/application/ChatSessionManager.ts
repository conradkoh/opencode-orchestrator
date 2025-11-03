import type { ChatSessionId, OpencodeSessionId } from '../../../backend/convex/types/sessionIds';
import type { IOpencodeInstance } from '../domain/interfaces/IOpencodeClient';
import { validateSessionId } from '../domain/valueObjects/Ids';
import type { ConvexClientAdapter } from '../infrastructure/convex/ConvexClientAdapter';
import { OpencodeClientAdapter } from '../infrastructure/opencode/OpencodeClientAdapter';

/**
 * Manages chat session lifecycle and opencode process management.
 * Handles starting sessions, routing messages, and streaming responses.
 *
 * Session ID Management:
 * - ChatSessionId: Convex-generated ID used for database operations and routing
 * - OpencodeSessionId: OpenCode SDK-generated ID used for AI model interactions
 * - Maintains mapping between the two for message processing
 */
export class ChatSessionManager {
  private convexClient: ConvexClientAdapter;
  private opencodeAdapter: OpencodeClientAdapter;
  private opencodeClient: IOpencodeInstance | null = null;
  private activeSessions: Map<ChatSessionId, SessionInfo> = new Map();
  private workingDirectory: string;

  constructor(convexClient: ConvexClientAdapter, workingDirectory: string) {
    this.convexClient = convexClient;
    this.opencodeAdapter = new OpencodeClientAdapter();
    this.workingDirectory = workingDirectory;
  }

  /**
   * Connect and initialize opencode client.
   * This should be called when a worker is selected in the UI.
   * Initializes the opencode client, fetches available models, and publishes them to Convex.
   * Also restores any active sessions from Convex.
   *
   * @returns Promise that resolves when connection is complete
   */
  async connect(): Promise<void> {
    // Initialize opencode client if not already done
    if (!this.opencodeClient) {
      console.log(`🔧 Connecting opencode client for directory: ${this.workingDirectory}`);
      this.opencodeClient = await this.opencodeAdapter.createClient(this.workingDirectory);
      console.log('✅ Opencode client initialized');
    } else {
      console.log('✅ Opencode client already connected, fetching models...');
    }

    // Always fetch and publish models when connect() is called
    // This ensures models are updated even if client was already connected
    try {
      console.log('📋 Fetching available models from opencode...');
      const models = await this.opencodeAdapter.listModels(this.opencodeClient);

      // Log detailed model information
      console.log(`✅ Found ${models.length} models:`);
      for (const model of models) {
        console.log(`   - ${model.id} (${model.provider}): ${model.name}`);
      }

      // Publish models to Convex
      console.log('📤 Publishing models to Convex...');
      await this.convexClient.publishModels(models);
      console.log('✅ Models published to Convex successfully');

      // Mark worker as connected
      await this.convexClient.markConnected();
      console.log('✅ Worker marked as connected');

      // Restore any active sessions
      await this.restoreActiveSessions();
    } catch (error) {
      console.error('❌ Failed to fetch/publish models:', error);
      throw error; // Fail connection if we can't get models
    }
  }

  /**
   * Ensure opencode client is initialized.
   * This is a fallback for backwards compatibility.
   */
  private async ensureOpencodeClient(): Promise<void> {
    if (!this.opencodeClient) {
      console.warn('⚠️  Opencode client not connected, connecting now...');
      await this.connect();
    }
  }

  /**
   * Start a new chat session with opencode.
   * @param chatSessionId - Convex chat session ID (ChatSessionId branded type)
   * @param model - AI model to use
   */
  async startSession(chatSessionId: ChatSessionId, model: string): Promise<void> {
    console.log(`🚀 Starting session ${chatSessionId} with model ${model}`);

    try {
      // Store session info FIRST (before async operations)
      // This prevents race conditions where messages arrive before session is ready
      this.activeSessions.set(chatSessionId, {
        chatSessionId,
        model,
        startedAt: Date.now(),
        isInitializing: true,
      });

      // Ensure opencode client is initialized
      await this.ensureOpencodeClient();

      if (!this.opencodeClient) {
        throw new Error('Opencode client not initialized');
      }

      // Create opencode session
      const opencodeSession = await this.opencodeAdapter.createSession(this.opencodeClient, model);
      const opencodeSessionId = opencodeSession.id as OpencodeSessionId;
      console.log(`📝 Opencode session created: ${opencodeSessionId}`);

      // Update session with opencode session ID
      const session = this.activeSessions.get(chatSessionId);
      if (session) {
        session.opencodeSessionId = opencodeSessionId;
        session.isInitializing = false;
      }

      // Mark session as ready and store OpenCode session ID in Convex
      await this.convexClient.sessionReady(chatSessionId, opencodeSessionId);
      console.log(`✅ Session ${chatSessionId} ready (OpenCode: ${opencodeSessionId})`);
    } catch (error) {
      console.error(`❌ Failed to start session ${chatSessionId}:`, error);
      this.activeSessions.delete(chatSessionId);
      throw error;
    }
  }

  /**
   * End a chat session.
   * @param chatSessionId - Convex chat session ID to end
   */
  async endSession(chatSessionId: ChatSessionId): Promise<void> {
    console.log(`🛑 Ending session ${chatSessionId}`);
    this.activeSessions.delete(chatSessionId);
    // TODO: Optionally delete OpenCode session if needed
  }

  /**
   * Process a message in a session using opencode.
   * @param chatSessionId - Convex chat session ID
   * @param messageId - Message ID to process
   * @param content - Message content
   */
  async processMessage(
    chatSessionId: ChatSessionId,
    messageId: string,
    content: string
  ): Promise<void> {
    console.log(`📨 Processing message in session ${chatSessionId}:`, content);

    try {
      const session = this.activeSessions.get(chatSessionId);
      if (!session) {
        const errorMsg = `Session ${chatSessionId} not found`;
        console.error(`❌ ${errorMsg}`);
        await this.writeError(chatSessionId, messageId, errorMsg);
        return;
      }

      // Wait for session to finish initializing
      if (session.isInitializing) {
        console.log(`⏳ Waiting for session ${chatSessionId} to finish initializing...`);
        // Wait up to 30 seconds for initialization
        const maxWaitTime = 30000;
        const startTime = Date.now();
        while (session.isInitializing && Date.now() - startTime < maxWaitTime) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (session.isInitializing) {
          const errorMsg = 'Session initialization timeout';
          console.error(`❌ ${errorMsg}`);
          await this.writeError(chatSessionId, messageId, errorMsg);
          return;
        }
        console.log(`✅ Session ${chatSessionId} initialization complete, proceeding with message`);
      }

      if (!session.opencodeSessionId) {
        const errorMsg = `No opencode session ID for ${chatSessionId}`;
        console.error(`❌ ${errorMsg}`);
        await this.writeError(chatSessionId, messageId, errorMsg);
        return;
      }

      await this.ensureOpencodeClient();

      if (!this.opencodeClient) {
        const errorMsg = 'Opencode client not initialized';
        console.error(`❌ ${errorMsg}`);
        await this.writeError(chatSessionId, messageId, errorMsg);
        return;
      }

      // Send prompt to opencode and stream response
      const responseIterator = this.opencodeAdapter.sendPrompt(
        this.opencodeClient,
        validateSessionId(session.opencodeSessionId),
        content,
        session.model
      );

      let fullResponse = '';
      let sequence = 0;

      // Stream chunks as they arrive from opencode
      for await (const chunk of responseIterator) {
        fullResponse += chunk;
        await this.convexClient.writeChunk(chatSessionId, messageId, chunk, sequence++);
        console.log(`📤 Chunk ${sequence} sent (${chunk.length} chars)`);
      }

      // Complete the message with full content
      await this.convexClient.completeMessage(chatSessionId, messageId, fullResponse);
      console.log(`✅ Message ${messageId} completed (${fullResponse.length} chars total)`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to process message ${messageId}:`, errorMsg);
      await this.writeError(chatSessionId, messageId, errorMsg);
    }
  }

  /**
   * Write an error message to chat and mark message as complete.
   */
  private async writeError(
    chatSessionId: ChatSessionId,
    messageId: string,
    error: string
  ): Promise<void> {
    try {
      const errorMessage = `❌ Error: ${error}`;
      await this.convexClient.writeChunk(chatSessionId, messageId, errorMessage, 0);
      await this.convexClient.completeMessage(chatSessionId, messageId, errorMessage);
    } catch (writeError) {
      console.error('❌ Failed to write error message:', writeError);
    }
  }

  /**
   * Restore active sessions from Convex after worker restart.
   * Attempts to match existing OpenCode sessions or creates new ones.
   */
  private async restoreActiveSessions(): Promise<void> {
    try {
      console.log('🔄 Restoring active sessions from Convex...');

      // Get active sessions from Convex
      const convexSessions = await this.convexClient.getActiveSessions();

      if (convexSessions.length === 0) {
        console.log('✅ No active sessions to restore');
        return;
      }

      console.log(`📋 Found ${convexSessions.length} active session(s) to restore`);

      // List existing OpenCode sessions (if any)
      let opencodeSessions: Array<{ id: string }> = [];
      if (this.opencodeClient) {
        try {
          opencodeSessions = await this.opencodeAdapter.listSessions(this.opencodeClient);
          console.log(`📋 Found ${opencodeSessions.length} existing OpenCode session(s)`);
        } catch (error) {
          console.warn('⚠️  Failed to list OpenCode sessions:', error);
        }
      }

      // Restore each session
      for (const convexSession of convexSessions) {
        try {
          const chatSessionId = convexSession.chatSessionId;
          const storedOpencodeSessionId = convexSession.opencodeSessionId;

          // Strategy 1: Use stored OpenCode session ID if available
          if (
            storedOpencodeSessionId &&
            opencodeSessions.some((s) => s.id === storedOpencodeSessionId)
          ) {
            console.log(
              `✅ Restoring session ${chatSessionId} with existing OpenCode session ${storedOpencodeSessionId}`
            );
            this.activeSessions.set(chatSessionId, {
              chatSessionId,
              opencodeSessionId: storedOpencodeSessionId,
              model: convexSession.model,
              startedAt: convexSession.createdAt,
              isInitializing: false,
            });
          }
          // Strategy 2: Create new OpenCode session
          else {
            console.log(
              `🆕 Creating new OpenCode session for ${chatSessionId} (previous session not found)`
            );

            if (!this.opencodeClient) {
              console.error('❌ Cannot create OpenCode session: client not initialized');
              continue;
            }

            const opencodeSession = await this.opencodeAdapter.createSession(
              this.opencodeClient,
              convexSession.model
            );
            const opencodeSessionId = opencodeSession.id as OpencodeSessionId;

            this.activeSessions.set(chatSessionId, {
              chatSessionId,
              opencodeSessionId,
              model: convexSession.model,
              startedAt: convexSession.createdAt,
              isInitializing: false,
            });

            // Update Convex with new OpenCode session ID
            await this.convexClient.sessionReady(chatSessionId, opencodeSessionId);
            console.log(`✅ New OpenCode session created: ${opencodeSessionId}`);
          }
        } catch (error) {
          console.error(`❌ Failed to restore session ${convexSession.chatSessionId}:`, error);
        }
      }

      console.log(`✅ Restored ${this.activeSessions.size} session(s)`);
    } catch (error) {
      console.error('❌ Failed to restore sessions:', error);
      // Don't throw - worker can still handle new sessions even if restoration fails
    }
  }

  /**
   * Get info about active sessions.
   */
  getActiveSessions(): SessionInfo[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Disconnect all active sessions and cleanup resources.
   * Called during graceful shutdown.
   */
  async disconnectAll(): Promise<void> {
    console.log(`🔌 Disconnecting ${this.activeSessions.size} active session(s)...`);

    // Close all active sessions
    const sessionIds = Array.from(this.activeSessions.keys());
    for (const sessionId of sessionIds) {
      try {
        console.log(`  Closing session ${sessionId}...`);
        // Remove from active sessions
        this.activeSessions.delete(sessionId);
      } catch (error) {
        console.error(
          `  ⚠️  Error closing session ${sessionId}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Close opencode client if initialized
    if (this.opencodeClient) {
      try {
        console.log('  Closing opencode client...');
        // The opencode client doesn't have an explicit close method in the interface
        // but we can null it out to allow GC
        this.opencodeClient = null;
        console.log('  ✅ Opencode client closed');
      } catch (error) {
        console.error(
          '  ⚠️  Error closing opencode client:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    console.log('✅ All sessions disconnected');
  }
}

interface SessionInfo {
  chatSessionId: ChatSessionId;
  opencodeSessionId?: OpencodeSessionId;
  model: string;
  startedAt: number;
  isInitializing?: boolean;
}
