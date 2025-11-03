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
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 30000; // 30 seconds

  constructor(convexClient: ConvexClientAdapter, workingDirectory: string) {
    this.convexClient = convexClient;
    this.opencodeAdapter = new OpencodeClientAdapter();
    this.workingDirectory = workingDirectory;
  }

  /**
   * Connect and initialize opencode client.
   * This should be called when a worker is selected in the UI.
   * Initializes the opencode client, fetches available models, and publishes them to Convex.
   * Also restores any active sessions from Convex and syncs with OpenCode.
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

      // Sync sessions with OpenCode
      await this.syncSessionsWithOpencode();

      // Start periodic sync (every 30 seconds)
      this.startPeriodicSync();
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

      // Restore each session (skip soft-deleted ones)
      for (const convexSession of convexSessions) {
        try {
          const chatSessionId = convexSession.chatSessionId;
          const storedOpencodeSessionId = convexSession.opencodeSessionId;

          // Skip soft-deleted sessions
          if ((convexSession as any).deletedInOpencode) {
            console.log(`⏭️  Skipping soft-deleted session ${chatSessionId}`);
            continue;
          }

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
   * Start periodic session synchronization with OpenCode.
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      return; // Already running
    }

    console.log('🔄 Starting periodic session sync...');
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncSessionsWithOpencode();
      } catch (error) {
        console.error(
          '❌ Periodic sync failed:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Stop periodic session synchronization.
   */
  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('✅ Periodic sync stopped');
    }
  }

  /**
   * Sync sessions between Convex and OpenCode using timestamp-based incremental sync.
   * - Updates session names from OpenCode
   * - Marks deleted sessions as soft-deleted
   * - Syncs new OpenCode sessions to Convex
   *
   * Optimization strategy:
   * 1. Fetch last sync timestamp from Convex
   * 2. Only process Convex sessions modified since last sync
   * 3. Fetch all OpenCode sessions (SDK doesn't support timestamp filtering)
   * 4. Parallelize all Convex writes
   * 5. Update sync timestamp on success
   */
  private async syncSessionsWithOpencode(): Promise<void> {
    if (!this.opencodeClient) {
      console.warn('⚠️  Cannot sync: OpenCode client not initialized');
      return;
    }

    const syncStartTime = Date.now();

    try {
      console.log('🔄 Starting incremental session sync with OpenCode...');

      // Step 1: Get last sync timestamp
      const lastSyncedAt = await this.convexClient.getLastSyncTimestamp();
      console.log(`📅 Last sync: ${lastSyncedAt ? new Date(lastSyncedAt).toISOString() : 'never'}`);

      // Step 2 & 3: Fetch ALL sessions (we need complete picture for duplicate detection)
      const [opencodeSessions, convexSessions] = await Promise.all([
        this.opencodeAdapter.listSessions(this.opencodeClient),
        this.convexClient.getActiveSessions(),
      ]);

      console.log(
        `📊 Fetched ${opencodeSessions.length} OpenCode sessions, ${convexSessions.length} Convex sessions`
      );

      const opencodeSessionIds = new Set(opencodeSessions.map((s) => s.id));
      const convexOpencodeIds = new Set(
        convexSessions.map((cs) => cs.opencodeSessionId as string).filter(Boolean)
      );

      // Step 4: Collect all write operations for parallelization
      const writeOps: Promise<void>[] = [];
      let nameUpdates = 0;
      let deletions = 0;
      let newSessions = 0;

      // 4a. Update session names from OpenCode (ONLY if name changed or never synced)
      for (const ocSession of opencodeSessions) {
        const convexSession = convexSessions.find((cs) => cs.opencodeSessionId === ocSession.id);

        if (convexSession && ocSession.title && convexSession.chatSessionId) {
          // Smart filtering: only sync if name changed OR never synced OR synced before last sync
          const needsSync =
            !convexSession.lastSyncedNameAt || // Never synced
            (lastSyncedAt && convexSession.lastSyncedNameAt < lastSyncedAt) || // Synced before last sync
            convexSession.name !== ocSession.title; // Name changed

          if (needsSync) {
            writeOps.push(
              this.convexClient
                .updateSessionName(convexSession.chatSessionId, ocSession.title)
                .then((updated) => {
                  if (updated) {
                    nameUpdates++;
                    console.log(
                      `📝 Updated name for session ${convexSession.chatSessionId}: "${ocSession.title}"`
                    );
                  }
                })
                .catch((error) => {
                  console.warn(
                    `⚠️  Failed to update name for ${convexSession.chatSessionId}:`,
                    error
                  );
                })
            );
          }
        }
      }

      // 4b. Mark deleted sessions (exist in Convex but not in OpenCode)
      for (const convexSession of convexSessions) {
        if (
          convexSession.opencodeSessionId &&
          !opencodeSessionIds.has(convexSession.opencodeSessionId) &&
          !convexSession.deletedInOpencode // Don't re-mark already deleted sessions
        ) {
          deletions++;
          writeOps.push(
            this.convexClient
              .markSessionDeletedInOpencode(convexSession.chatSessionId)
              .then(() => {
                console.log(
                  `🗑️  Marked session ${convexSession.chatSessionId} as deleted (removed from OpenCode)`
                );
                // Remove from active sessions in memory
                this.activeSessions.delete(convexSession.chatSessionId);
              })
              .catch((error) => {
                console.warn(`⚠️  Failed to mark ${convexSession.chatSessionId} as deleted:`, error);
              })
          );
        }
      }

      // 4c. Sync new sessions created directly in OpenCode (check against ALL Convex sessions)
      for (const ocSession of opencodeSessions) {
        if (!convexOpencodeIds.has(ocSession.id as string)) {
          newSessions++;
          writeOps.push(
            (async () => {
              try {
                console.log(
                  `🆕 Found new OpenCode session: ${ocSession.id} "${ocSession.title || '(unnamed)'}"`
                );

                // Try to infer model (default to first available model)
                const models = await this.opencodeAdapter.listModels(this.opencodeClient!);
                const defaultModel = models.length > 0 ? models[0].id : 'unknown';

                const chatSessionId = await this.convexClient.createSyncedSession(
                  ocSession.id as OpencodeSessionId,
                  defaultModel,
                  ocSession.title
                );

                // Add to active sessions
                this.activeSessions.set(chatSessionId, {
                  chatSessionId,
                  opencodeSessionId: ocSession.id as OpencodeSessionId,
                  model: defaultModel,
                  startedAt: Date.now(),
                  isInitializing: false,
                });

                console.log(`✅ Synced new session ${chatSessionId} from OpenCode`);
              } catch (error) {
                console.error(`❌ Failed to sync OpenCode session ${ocSession.id}:`, error);
              }
            })()
          );
        }
      }

      // Step 5: Execute all writes in parallel
      if (writeOps.length > 0) {
        console.log(
          `⚡ Executing ${writeOps.length} write operations (${nameUpdates} names, ${deletions} deletions, ${newSessions} new)...`
        );
        await Promise.allSettled(writeOps);
      } else {
        console.log('✅ No changes detected - sync state is stable');
      }

      // Step 6: Update last sync timestamp
      await this.convexClient.updateLastSyncTimestamp(syncStartTime);

      const duration = Date.now() - syncStartTime;
      console.log(`✅ Session sync complete in ${duration}ms`);
    } catch (error) {
      console.error(
        '❌ Failed to sync sessions:',
        error instanceof Error ? error.message : String(error)
      );
      // Don't update sync timestamp on failure - will retry with same timestamp
    }
  }

  /**
   * Disconnect all active sessions and cleanup resources.
   * Called during graceful shutdown.
   */
  async disconnectAll(): Promise<void> {
    console.log(`🔌 Disconnecting ${this.activeSessions.size} active session(s)...`);

    // Stop periodic sync
    this.stopPeriodicSync();

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
