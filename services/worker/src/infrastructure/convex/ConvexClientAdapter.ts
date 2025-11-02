import { api } from '@workspace/backend/convex/_generated/api';
import { ConvexClient, ConvexHttpClient } from 'convex/browser';
import type { WorkerConfig } from '../../config';

/**
 * Callback for new chat sessions.
 */
export type SessionStartCallback = (sessionId: string, model: string) => Promise<void>;

/**
 * Callback for new messages.
 */
export type MessageCallback = (
  sessionId: string,
  messageId: string,
  content: string
) => Promise<void>;

/**
 * Adapter for Convex backend communication.
 * Handles worker registration, authorization, heartbeat, status updates, and chat subscriptions.
 */
export class ConvexClientAdapter {
  private httpClient: ConvexHttpClient;
  private realtimeClient: ConvexClient;
  private config: WorkerConfig;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

  // Chat callbacks
  private sessionStartCallback: SessionStartCallback | null = null;
  private messageCallback: MessageCallback | null = null;

  /**
   * Creates a new Convex client adapter.
   *
   * @param convexUrl - Convex deployment URL
   * @param config - Worker configuration with credentials
   */
  constructor(convexUrl: string, config: WorkerConfig) {
    this.httpClient = new ConvexHttpClient(convexUrl);
    this.realtimeClient = new ConvexClient(convexUrl);
    this.config = config;
  }

  /**
   * Register worker with Convex and check authorization status.
   * @returns Registration result with approval status
   */
  async register(): Promise<{
    approvalStatus: 'pending' | 'approved';
    status: 'offline' | 'online';
    approved: boolean;
    workerId: string;
    name?: string;
  }> {
    try {
      const result = await this.httpClient.mutation(api.workers.register, {
        machineId: this.config.machineId,
        workerId: this.config.workerId,
      });

      // If approved, start heartbeat and chat subscriptions
      if (result.approved) {
        this.startHeartbeat();
        this.startChatSubscriptions();
      }

      return result;
    } catch (error) {
      throw new Error(
        `Worker registration failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Wait for worker approval by polling the backend.
   * Checks every 5 seconds until worker is approved.
   */
  async waitForApproval(): Promise<void> {
    console.log('⏳ Waiting for authorization approval...');
    console.log('   Please approve this worker in the web UI\n');

    while (true) {
      const result = await this.register();

      if (result.approved) {
        console.log('✅ Worker approved! Starting...\n');
        return;
      }

      // Wait 5 seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  /**
   * Start periodic heartbeat to maintain online status.
   * Heartbeat runs every 30 seconds.
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return; // Already running
    }

    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.sendHeartbeat();
      } catch (error) {
        console.error(
          '❌ Heartbeat failed:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Send heartbeat to Convex to update lastHeartbeat timestamp.
   */
  private async sendHeartbeat(): Promise<void> {
    await this.httpClient.mutation(api.workers.heartbeat, {
      machineId: this.config.machineId,
      workerId: this.config.workerId,
    });
  }

  /**
   * Stop heartbeat and update worker status to offline.
   * Called during graceful shutdown.
   */
  async disconnect(): Promise<void> {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Update status to offline
    try {
      await this.httpClient.mutation(api.workers.setOffline, {
        machineId: this.config.machineId,
        workerId: this.config.workerId,
      });
    } catch (error) {
      console.error(
        '❌ Failed to set offline status:',
        error instanceof Error ? error.message : String(error)
      );
    }

    // Close realtime client
    this.realtimeClient.close();
  }

  /**
   * Set callback for new session starts.
   */
  onSessionStart(callback: SessionStartCallback): void {
    this.sessionStartCallback = callback;
  }

  /**
   * Set callback for new messages.
   */
  onMessage(callback: MessageCallback): void {
    this.messageCallback = callback;
  }

  /**
   * Start subscriptions for chat sessions and messages.
   * Listens for new sessions and messages for this worker.
   */
  private startChatSubscriptions(): void {
    console.log('📡 Starting chat subscriptions...');

    // Track which sessions we've seen
    const seenSessions = new Set<string>();
    // Track which messages we've processed
    const processedMessages = new Set<string>();

    // Subscribe to sessions for this worker
    this.realtimeClient.onUpdate(
      api.chat.subscribeToWorkerSessions,
      { workerId: this.config.workerId },
      (sessions) => {
        if (!sessions) return;

        // Check for new sessions
        for (const session of sessions) {
          if (!seenSessions.has(session.sessionId) && session.status === 'active') {
            seenSessions.add(session.sessionId);
            console.log('🆕 New session detected:', session.sessionId, 'model:', session.model);

            // Notify callback
            if (this.sessionStartCallback) {
              this.sessionStartCallback(session.sessionId, session.model).catch((error) => {
                console.error('❌ Error in session start callback:', error);
              });
            }
          }
        }
      }
    );

    // Subscribe to messages for this worker
    this.realtimeClient.onUpdate(
      api.chat.subscribeToWorkerMessages,
      { workerId: this.config.workerId },
      (messages) => {
        if (!messages) return;

        // Check for new user messages that need processing
        for (const message of messages) {
          const messageKey = `${message.sessionId}:${message.messageId}`;

          if (!processedMessages.has(messageKey) && message.role === 'user' && message.completed) {
            processedMessages.add(messageKey);
            console.log(
              '📨 New user message detected:',
              message.messageId,
              'in session:',
              message.sessionId
            );

            // Find the corresponding assistant message (created right after user message)
            const assistantMessage = messages.find(
              (m) =>
                m.sessionId === message.sessionId &&
                m.role === 'assistant' &&
                !m.completed &&
                m.timestamp > message.timestamp
            );

            if (!assistantMessage) {
              console.error('❌ No assistant message found for user message:', message.messageId);
              continue;
            }

            console.log('📝 Found assistant message:', assistantMessage.messageId);

            // Notify callback with assistant message ID (where response should be written)
            if (this.messageCallback) {
              this.messageCallback(
                message.sessionId,
                assistantMessage.messageId,
                message.content
              ).catch((error) => {
                console.error('❌ Error in message callback:', error);
              });
            }
          }
        }
      }
    );

    console.log('✅ Chat subscriptions active');
  }

  /**
   * Write a chunk of streaming response.
   */
  async writeChunk(
    sessionId: string,
    messageId: string,
    chunk: string,
    sequence: number
  ): Promise<void> {
    await this.httpClient.mutation(api.chat.writeChunk, {
      chatSessionId: sessionId,
      messageId,
      chunk,
      sequence,
    });
  }

  /**
   * Complete a message with full content.
   */
  async completeMessage(sessionId: string, messageId: string, content: string): Promise<void> {
    await this.httpClient.mutation(api.chat.completeMessage, {
      chatSessionId: sessionId,
      messageId,
      content,
    });
  }

  /**
   * Mark session as ready.
   */
  async sessionReady(sessionId: string): Promise<void> {
    await this.httpClient.mutation(api.chat.sessionReady, {
      chatSessionId: sessionId,
    });
  }
}
