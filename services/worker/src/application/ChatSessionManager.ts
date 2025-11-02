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
   * Initialize opencode client if not already initialized.
   */
  private async ensureOpencodeClient(): Promise<void> {
    if (!this.opencodeClient) {
      console.log(`🔧 Initializing opencode client for directory: ${this.workingDirectory}`);
      this.opencodeClient = await this.opencodeAdapter.createClient(this.workingDirectory);
      console.log('✅ Opencode client initialized');
    }
  }

  /**
   * Start a new chat session with opencode.
   */
  async startSession(sessionId: string, model: string): Promise<void> {
    console.log(`🚀 Starting session ${sessionId} with model ${model}`);

    try {
      // Ensure opencode client is initialized
      await this.ensureOpencodeClient();

      // Create opencode session
      // Note: We use the Convex sessionId as the opencode session ID
      // This allows us to resume sessions later
      const opencodeSession = await this.opencodeAdapter.createSession(this.opencodeClient!, model);
      console.log(`📝 Opencode session created: ${opencodeSession.id}`);

      // Store session info
      this.activeSessions.set(sessionId, {
        sessionId,
        model,
        startedAt: Date.now(),
        opencodeSessionId: opencodeSession.id,
      });

      // Mark session as ready
      await this.convexClient.sessionReady(sessionId);
      console.log(`✅ Session ${sessionId} ready`);
    } catch (error) {
      console.error(`❌ Failed to start session ${sessionId}:`, error);
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

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.error(`❌ Session ${sessionId} not found`);
      return;
    }

    if (!session.opencodeSessionId) {
      console.error(`❌ No opencode session ID for ${sessionId}`);
      return;
    }

    try {
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
      console.error(`❌ Failed to process message ${messageId}:`, error);
      // Write error message to chat
      const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
      await this.convexClient.writeChunk(sessionId, messageId, errorMessage, 0);
      await this.convexClient.completeMessage(sessionId, messageId, errorMessage);
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
}
