import type { ConvexClientAdapter } from '../infrastructure/convex/ConvexClientAdapter';

/**
 * Manages chat session lifecycle and opencode process management.
 * Handles starting sessions, routing messages, and streaming responses.
 */
export class ChatSessionManager {
  private convexClient: ConvexClientAdapter;
  private activeSessions: Map<string, SessionInfo> = new Map();

  constructor(convexClient: ConvexClientAdapter) {
    this.convexClient = convexClient;
  }

  /**
   * Start a new chat session.
   * For now, we'll just log and mark as ready.
   * TODO: Spawn actual opencode process
   */
  async startSession(sessionId: string, model: string): Promise<void> {
    console.log(`🚀 Starting session ${sessionId} with model ${model}`);

    // Store session info
    this.activeSessions.set(sessionId, {
      sessionId,
      model,
      startedAt: Date.now(),
    });

    // Mark session as ready
    await this.convexClient.sessionReady(sessionId);
    console.log(`✅ Session ${sessionId} ready`);
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
   * Process a message in a session.
   * For now, we'll just echo back a mock response.
   * TODO: Route to actual opencode process
   */
  async processMessage(sessionId: string, messageId: string, content: string): Promise<void> {
    console.log(`📨 Processing message in session ${sessionId}:`, content);

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.error(`❌ Session ${sessionId} not found`);
      return;
    }

    // Mock response - simulate streaming
    const mockResponse = `Echo: ${content}\n\nThis is a mock response from the worker. The opencode integration will be implemented next.`;

    // Stream the response in chunks
    const chunks = mockResponse.match(/.{1,20}/g) || [mockResponse];
    for (let i = 0; i < chunks.length; i++) {
      await this.convexClient.writeChunk(sessionId, messageId, chunks[i], i);
      // Small delay to simulate streaming
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Complete the message
    await this.convexClient.completeMessage(sessionId, messageId, mockResponse);
    console.log(`✅ Message ${messageId} completed`);
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
}
