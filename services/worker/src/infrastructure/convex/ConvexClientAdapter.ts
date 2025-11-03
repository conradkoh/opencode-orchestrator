import { api } from '@workspace/backend/convex/_generated/api';
import { ConvexClient, ConvexHttpClient } from 'convex/browser';
import type { ChatSessionId, OpencodeSessionId } from '../../../../backend/convex/types/sessionIds';
import type { WorkerConfig } from '../../config';

/**
 * Callback for worker connect requests.
 */
export type ConnectCallback = () => Promise<void>;

/**
 * Callback for new chat sessions.
 */
export type SessionStartCallback = (chatSessionId: ChatSessionId, model: string) => Promise<void>;

/**
 * Callback for new messages.
 */
export type MessageCallback = (
  chatSessionId: ChatSessionId,
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

  // Callbacks
  private connectCallback: ConnectCallback | null = null;
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
        secret: this.config.secret,
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
  startHeartbeat(): void {
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
      secret: this.config.secret,
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
        secret: this.config.secret,
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
   * Set callback for connect requests.
   */
  onConnect(callback: ConnectCallback): void {
    this.connectCallback = callback;
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
   * Start subscription to worker record for connect requests.
   */
  startWorkerSubscription(): void {
    console.log('📡 Starting worker subscription...');

    let lastConnectRequest: number | undefined;

    // Subscribe to worker record changes
    this.realtimeClient.onUpdate(
      api.workers.getByMachineAndWorker,
      { machineId: this.config.machineId, workerId: this.config.workerId },
      (worker) => {
        if (!worker) return;

        // Check if there's a new connect request
        if (
          worker.connectRequestedAt &&
          worker.connectRequestedAt !== lastConnectRequest &&
          (!worker.connectedAt || worker.connectRequestedAt > worker.connectedAt)
        ) {
          lastConnectRequest = worker.connectRequestedAt;
          console.log('🔌 Connect request detected at:', worker.connectRequestedAt);

          // Trigger connect callback
          if (this.connectCallback) {
            this.connectCallback().catch((error) => {
              console.error('❌ Error in connect callback:', error);
            });
          }
        }
      }
    );

    console.log('✅ Worker subscription active');
  }

  /**
   * Start subscriptions for chat sessions and messages.
   * Listens for new sessions and messages for this worker.
   */
  startChatSubscriptions(): void {
    console.log('📡 Starting chat subscriptions...');

    // Start worker subscription for connect requests
    this.startWorkerSubscription();

    // Track which sessions we've seen
    const seenSessions = new Set<string>();
    // Track which messages we've processed
    const processedMessages = new Set<string>();

    // Track initialization state - separate for each subscription
    let sessionsInitialized = false;
    let messagesInitialized = false;

    // Subscribe to sessions for this worker
    this.realtimeClient.onUpdate(
      api.chat.subscribeToWorkerSessions,
      { workerId: this.config.workerId },
      (sessions) => {
        if (!sessions) return;

        // On first load, mark all existing sessions as seen (don't trigger callbacks)
        if (!sessionsInitialized) {
          for (const session of sessions) {
            seenSessions.add(session.sessionId);
          }
          console.log(`📋 Marked ${seenSessions.size} existing sessions as seen`);
          sessionsInitialized = true;
          return;
        }

        // Check for new sessions (only after initial load)
        for (const session of sessions) {
          if (!seenSessions.has(session.sessionId) && session.status === 'active') {
            seenSessions.add(session.sessionId);
            console.log('🆕 New session detected:', session.sessionId, 'model:', session.model);

            // Notify callback
            if (this.sessionStartCallback) {
              // Cast to branded type
              const chatSessionId = session.sessionId as ChatSessionId;
              this.sessionStartCallback(chatSessionId, session.model).catch((error) => {
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

        // On first load, mark all existing messages as processed
        // EXCEPT incomplete assistant messages (these need processing)
        if (!messagesInitialized) {
          for (const message of messages) {
            const messageKey = `${message.sessionId}:${message.messageId}`;

            // Mark user messages as processed (don't reprocess old messages)
            if (message.role === 'user' && message.completed) {
              processedMessages.add(messageKey);
            }

            // Mark completed assistant messages as processed
            if (message.role === 'assistant' && message.completed) {
              processedMessages.add(messageKey);
            }
          }

          console.log(`📋 Marked ${processedMessages.size} existing messages as processed`);

          // Now check for any incomplete assistant messages that need processing
          const incompleteAssistantMessages = messages.filter(
            (m) => m.role === 'assistant' && !m.completed
          );

          if (incompleteAssistantMessages.length > 0) {
            console.log(
              `⚠️  Found ${incompleteAssistantMessages.length} incomplete assistant messages`
            );

            // For each incomplete assistant message, find the user message and process it
            for (const assistantMsg of incompleteAssistantMessages) {
              const userMessage = messages.find(
                (m) =>
                  m.sessionId === assistantMsg.sessionId &&
                  m.role === 'user' &&
                  m.completed &&
                  m.timestamp < assistantMsg.timestamp
              );

              if (userMessage) {
                console.log(`🔄 Reprocessing incomplete message: ${assistantMsg.messageId}`);

                if (this.messageCallback) {
                  // Cast to branded type
                  const chatSessionId = assistantMsg.sessionId as ChatSessionId;
                  this.messageCallback(
                    chatSessionId,
                    assistantMsg.messageId,
                    userMessage.content
                  ).catch((error) => {
                    console.error('❌ Error in message callback:', error);
                  });
                }
              }
            }
          }

          messagesInitialized = true;
          return;
        }

        // After initial load, process new user messages
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
              // Cast to branded type
              const chatSessionId = message.sessionId as ChatSessionId;
              this.messageCallback(
                chatSessionId,
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
    chatSessionId: ChatSessionId,
    messageId: string,
    chunk: string,
    sequence: number
  ): Promise<void> {
    await this.httpClient.mutation(api.chat.writeChunk, {
      chatSessionId,
      messageId,
      chunk,
      sequence,
    });
  }

  /**
   * Complete a message with full content.
   */
  async completeMessage(
    chatSessionId: ChatSessionId,
    messageId: string,
    content: string
  ): Promise<void> {
    await this.httpClient.mutation(api.chat.completeMessage, {
      chatSessionId,
      messageId,
      content,
    });
  }

  /**
   * Mark session as ready and store OpenCode session ID.
   */
  async sessionReady(
    chatSessionId: ChatSessionId,
    opencodeSessionId?: OpencodeSessionId
  ): Promise<void> {
    await this.httpClient.mutation(api.chat.sessionReady, {
      chatSessionId,
      opencodeSessionId,
    });
  }

  /**
   * Get all active sessions for this worker (for restoration).
   */
  async getActiveSessions(): Promise<
    Array<{
      chatSessionId: ChatSessionId;
      opencodeSessionId?: OpencodeSessionId;
      workerId: string;
      model: string;
      status: string;
      createdAt: number;
      lastActivity: number;
    }>
  > {
    return await this.httpClient.query(api.chat.getActiveSessions, {
      workerId: this.config.workerId,
    });
  }

  /**
   * Publish available models to Convex.
   * Called when opencode client initializes.
   */
  async publishModels(
    models: Array<{ id: string; name: string; provider: string }>
  ): Promise<void> {
    await this.httpClient.mutation(api.workerModels.updateModels, {
      workerId: this.config.workerId,
      models,
    });
  }

  /**
   * Mark worker as connected after successful opencode initialization.
   */
  async markConnected(): Promise<void> {
    await this.httpClient.mutation(api.workers.markConnected, {
      workerId: this.config.workerId,
      machineId: this.config.machineId,
      secret: this.config.secret,
    });
  }

  /**
   * Update session name from OpenCode.
   */
  async updateSessionName(chatSessionId: ChatSessionId, name: string): Promise<void> {
    await this.httpClient.mutation(api.chat.updateSessionName, {
      chatSessionId,
      name,
    });
  }

  /**
   * Mark session as soft-deleted (deleted from OpenCode).
   */
  async markSessionDeletedInOpencode(chatSessionId: ChatSessionId): Promise<void> {
    await this.httpClient.mutation(api.chat.markSessionDeletedInOpencode, {
      chatSessionId,
    });
  }

  /**
   * Create a session synced from OpenCode.
   */
  async createSyncedSession(
    opencodeSessionId: OpencodeSessionId,
    model: string,
    name?: string
  ): Promise<ChatSessionId> {
    return await this.httpClient.mutation(api.chat.createSyncedSession, {
      opencodeSessionId: opencodeSessionId as string, // Cast branded type to string for Convex mutation
      workerId: this.config.workerId,
      model,
      name,
    });
  }
}
