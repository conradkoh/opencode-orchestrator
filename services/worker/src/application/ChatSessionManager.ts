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
   * Initializes the opencode client, fetches available models, publishes them to Convex,
   * and invalidates any active sessions from a previous worker instance.
   *
   * Sessions are NOT restored on restart - users must start new sessions.
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

      // Mark worker as connected and invalidate old sessions
      const result = await this.convexClient.markConnected();
      console.log('✅ Worker marked as connected');

      if (result.sessionsInvalidated && result.sessionsInvalidated > 0) {
        console.log(
          `ℹ️  Invalidated ${result.sessionsInvalidated} session(s) from previous worker instance`
        );
        console.log('ℹ️  Users will need to start new chat sessions');
      }
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
   * Start a new chat session (without creating OpenCode session yet).
   * OpenCode session will be created lazily when first message arrives with a model.
   * If session was previously active and has an opencodeSessionId, it will be restored.
   * @param chatSessionId - Convex chat session ID (ChatSessionId branded type)
   */
  async startSession(chatSessionId: ChatSessionId): Promise<void> {
    console.log(`🚀 Registering session ${chatSessionId} (checking for existing OpenCode session)`);

    try {
      // Check if this session already exists in Convex with an opencodeSessionId
      const activeSessions = await this.convexClient.getActiveSessions();
      const existingSession = activeSessions.find((s) => s.chatSessionId === chatSessionId);

      if (existingSession?.opencodeSessionId) {
        // Session resume: restore existing OpenCode session
        console.log(
          `♻️  Restoring existing OpenCode session ${existingSession.opencodeSessionId} for ${chatSessionId}`
        );
        this.activeSessions.set(chatSessionId, {
          chatSessionId,
          opencodeSessionId: existingSession.opencodeSessionId,
          model: existingSession.model || '', // Restore model if available
          startedAt: Date.now(),
          isInitializing: false,
        });
        console.log(`✅ Session ${chatSessionId} restored with context`);
      } else {
        // New session: OpenCode session will be created when first message arrives
        console.log(
          `🆕 New session ${chatSessionId} - OpenCode session will be created on first message)`
        );
        this.activeSessions.set(chatSessionId, {
          chatSessionId,
          model: '', // Will be set from first message
          startedAt: Date.now(),
          isInitializing: false, // Not initializing yet - will initialize on first message
        });
        console.log(`✅ Session ${chatSessionId} registered`);
      }
    } catch (error) {
      console.error(`❌ Failed to register session ${chatSessionId}:`, error);
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
   * @param model - AI model to use for this message
   */
  async processMessage(
    chatSessionId: ChatSessionId,
    messageId: string,
    content: string,
    model: string
  ): Promise<void> {
    console.log(`📨 Processing message in session ${chatSessionId} with model ${model}:`, content);

    try {
      const session = this.activeSessions.get(chatSessionId);
      if (!session) {
        const errorMsg = `Session ${chatSessionId} not found`;
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

      // Create OpenCode session if it doesn't exist yet (lazy initialization)
      if (!session.opencodeSessionId) {
        console.log(`📝 Creating OpenCode session for ${chatSessionId} with model ${model}`);
        session.isInitializing = true;

        try {
          const opencodeSession = await this.opencodeAdapter.createSession(
            this.opencodeClient,
            model
          );
          const opencodeSessionId = opencodeSession.id as OpencodeSessionId;
          console.log(`✅ OpenCode session created: ${opencodeSessionId}`);

          session.opencodeSessionId = opencodeSessionId;
          session.model = model;
          session.isInitializing = false;

          // Notify Convex that session is ready
          await this.convexClient.sessionReady(chatSessionId, opencodeSessionId);
        } catch (error) {
          session.isInitializing = false;
          const errorMsg = `Failed to create OpenCode session: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`❌ ${errorMsg}`);
          await this.writeError(chatSessionId, messageId, errorMsg);
          return;
        }
      }

      // Update local session model if it changed
      if (model !== session.model) {
        console.log(`🔄 Model changed from ${session.model} to ${model}`);
        session.model = model;
      }

      // Send prompt to opencode and stream response using the model from the message
      const responseIterator = this.opencodeAdapter.sendPrompt(
        this.opencodeClient,
        validateSessionId(session.opencodeSessionId),
        content,
        model
      );

      let fullContent = '';
      let fullReasoning = '';
      const otherParts: unknown[] = [];
      let sequence = 0;

      // Stream chunks as they arrive from opencode
      for await (const response of responseIterator) {
        if (response.content) {
          fullContent += response.content;
          await this.convexClient.writeChunk(
            chatSessionId,
            messageId,
            response.content,
            sequence++
          );
          console.log(`📤 Content chunk ${sequence} sent (${response.content.length} chars)`);
        }

        if (response.reasoning) {
          fullReasoning += response.reasoning;
          // Reasoning is not streamed to UI, just logged
          console.log(`🧠 Reasoning chunk received (${response.reasoning.length} chars)`);
        }

        if (response.otherParts) {
          otherParts.push(...response.otherParts);
          console.log(`🔧 Other parts received: ${response.otherParts.length} parts`);
        }
      }

      // Complete the message with structured content
      await this.convexClient.completeStructuredMessage(
        chatSessionId,
        messageId,
        fullContent || '',
        fullReasoning || undefined,
        otherParts.length > 0 ? JSON.stringify(otherParts) : undefined
      );
      console.log(
        `✅ Message ${messageId} completed (content: ${fullContent.length} chars, reasoning: ${fullReasoning.length} chars, other: ${otherParts.length} parts)`
      );
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
