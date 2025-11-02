import { api } from '@workspace/backend/convex/_generated/api';
import { ConvexClient, ConvexHttpClient } from 'convex/browser';
import type { WorkerConfig } from '../../config';

/**
 * Callback for worker connect requests.
 */
export type ConnectCallback = () => Promise<void>;

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
  private startWorkerSubscription(): void {
    console.log('📡 Starting worker subscription...');

    let lastConnectRequest: number | undefined;

    // Subscribe to worker record changes
    this.realtimeClient.onUpdate(
      api.workers.list,
      { machineId: this.config.machineId },
      (workers) => {
        if (!workers) return;

        // Find this worker
        const thisWorker = workers.find((w) => w.workerId === this.config.workerId);
        if (!thisWorker) return;

        // Check if there's a new connect request
        if (
          thisWorker.connectRequestedAt &&
          thisWorker.connectRequestedAt !== lastConnectRequest &&
          (!thisWorker.connectedAt || thisWorker.connectRequestedAt > thisWorker.connectedAt)
        ) {
          lastConnectRequest = thisWorker.connectRequestedAt;
          console.log('🔌 Connect request detected at:', thisWorker.connectRequestedAt);

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
  private startChatSubscriptions(): void {
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
                  this.messageCallback(
                    assistantMsg.sessionId,
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
    });
  }
}
