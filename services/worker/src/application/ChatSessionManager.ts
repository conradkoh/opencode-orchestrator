import type { IOpencodeInstance } from '../domain/interfaces/IOpencodeClient';
import type { ConvexClientAdapter } from '../infrastructure/convex/ConvexClientAdapter';
import { OpencodeClientAdapter } from '../infrastructure/opencode/OpencodeClientAdapter';

/**
 * Manages chat session lifecycle and opencode process management.
 * Handles starting sessions, routing messages, and streaming responses.
 */
export class ChatSessionManager {
  private convexClient: ConvexClientAdapter;
  private opencodeAdapter: OpencodeClientAdapter;
  private opencodeClient: IOpencodeInstance | null = null;
  private activeSessions: Map<string, SessionInfo> = new Map();
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
   *
   * @returns Promise that resolves when connection is complete
   */
  async connect(): Promise<void> {
    if (this.opencodeClient) {
      console.log('✅ Opencode client already connected');
      return;
    }

    console.log(`🔧 Connecting opencode client for directory: ${this.workingDirectory}`);
    this.opencodeClient = await this.opencodeAdapter.createClient(this.workingDirectory);
    console.log('✅ Opencode client initialized');

    // Fetch and publish available models
    try {
      console.log('📋 Fetching available models from opencode...');
      const models = await this.opencodeAdapter.listModels(this.opencodeClient);
      console.log(`✅ Found ${models.length} models:`, models.map((m) => m.id).join(', '));

      // Publish models to Convex
      await this.convexClient.publishModels(models);
      console.log('✅ Models published to Convex');

      // Mark worker as connected
      await this.convexClient.markConnected();
      console.log('✅ Worker marked as connected');
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
   */
  async startSession(sessionId: string, model: string): Promise<void> {
    console.log(`🚀 Starting session ${sessionId} with model ${model}`);

    try {
      // Store session info FIRST (before async operations)
      // This prevents race conditions where messages arrive before session is ready
      this.activeSessions.set(sessionId, {
        sessionId,
        model,
        startedAt: Date.now(),
        isInitializing: true,
      });

      // Ensure opencode client is initialized
      await this.ensureOpencodeClient();

      // Create opencode session
      const opencodeSession = await this.opencodeAdapter.createSession(this.opencodeClient!, model);
      console.log(`📝 Opencode session created: ${opencodeSession.id}`);

      // Update session with opencode session ID
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.opencodeSessionId = opencodeSession.id;
        session.isInitializing = false;
      }

      // Mark session as ready
      await this.convexClient.sessionReady(sessionId);
      console.log(`✅ Session ${sessionId} ready`);
    } catch (error) {
      console.error(`❌ Failed to start session ${sessionId}:`, error);
      this.activeSessions.delete(sessionId);
      throw error;
    }
  }

  /**
   * End a chat session.
   * TODO: Terminate opencode process
   */
  async endSession(sessionId: string): Promise<void> {
    console.log(`🛑 Ending session ${sessionId}`);
    this.activeSessions.delete(sessionId);
  }

  /**
   * Process a message in a session using opencode.
   */
  async processMessage(sessionId: string, messageId: string, content: string): Promise<void> {
    console.log(`📨 Processing message in session ${sessionId}:`, content);

    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        const errorMsg = `Session ${sessionId} not found`;
        console.error(`❌ ${errorMsg}`);
        await this.writeError(sessionId, messageId, errorMsg);
        return;
      }

      // Wait for session to finish initializing
      if (session.isInitializing) {
        console.log(`⏳ Waiting for session ${sessionId} to finish initializing...`);
        // Wait up to 30 seconds for initialization
        const maxWaitTime = 30000;
        const startTime = Date.now();
        while (session.isInitializing && Date.now() - startTime < maxWaitTime) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (session.isInitializing) {
          const errorMsg = 'Session initialization timeout';
          console.error(`❌ ${errorMsg}`);
          await this.writeError(sessionId, messageId, errorMsg);
          return;
        }
        console.log(`✅ Session ${sessionId} initialization complete, proceeding with message`);
      }

      if (!session.opencodeSessionId) {
        const errorMsg = `No opencode session ID for ${sessionId}`;
        console.error(`❌ ${errorMsg}`);
        await this.writeError(sessionId, messageId, errorMsg);
        return;
      }

      await this.ensureOpencodeClient();

      // Send prompt to opencode and stream response
      const responseIterator = this.opencodeAdapter.sendPrompt(
        this.opencodeClient!,
        session.opencodeSessionId as any,
        content,
        session.model
      );

      let fullResponse = '';
      let sequence = 0;

      // Stream chunks as they arrive from opencode
      for await (const chunk of responseIterator) {
        fullResponse += chunk;
        await this.convexClient.writeChunk(sessionId, messageId, chunk, sequence++);
        console.log(`📤 Chunk ${sequence} sent (${chunk.length} chars)`);
      }

      // Complete the message with full content
      await this.convexClient.completeMessage(sessionId, messageId, fullResponse);
      console.log(`✅ Message ${messageId} completed (${fullResponse.length} chars total)`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to process message ${messageId}:`, errorMsg);
      await this.writeError(sessionId, messageId, errorMsg);
    }
  }

  /**
   * Write an error message to chat and mark message as complete.
   */
  private async writeError(sessionId: string, messageId: string, error: string): Promise<void> {
    try {
      const errorMessage = `❌ Error: ${error}`;
      await this.convexClient.writeChunk(sessionId, messageId, errorMessage, 0);
      await this.convexClient.completeMessage(sessionId, messageId, errorMessage);
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
}

interface SessionInfo {
  sessionId: string;
  model: string;
  startedAt: number;
  opencodeSessionId?: string;
  isInitializing?: boolean;
}
