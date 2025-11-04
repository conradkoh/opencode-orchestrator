import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Database schema definition for the application.
 * Defines all tables, their fields, and indexes for optimal querying.
 *
 * DEPRECATION NOTICE: The fields `expiresAt` and `expiresAtLabel` in the sessions table
 * are deprecated and no longer used for session expiry. They are only kept for migration
 * compatibility and will be removed in a future migration.
 */
export default defineSchema({
  /**
   * Application metadata and version tracking.
   */
  appInfo: defineTable({
    latestVersion: v.string(),
  }),

  /**
   * Presentation state management for real-time presentation controls.
   * Tracks current slide and active presenter information.
   */
  presentationState: defineTable({
    key: v.string(), // The presentation key that identifies this presentation
    currentSlide: v.number(), // The current slide number
    lastUpdated: v.number(), // Timestamp of last update
    activePresentation: v.optional(
      v.object({
        presenterId: v.string(), // Session ID of the current presenter
      })
    ), // Optional object containing presenter information
  }).index('by_key', ['key']),

  /**
   * Discussion state management for collaborative discussions.
   * Tracks discussion lifecycle, conclusions, and metadata.
   */
  discussionState: defineTable({
    key: v.string(), // Unique identifier for the discussion
    title: v.string(), // Title of the discussion
    isActive: v.boolean(), // Whether the discussion is active or concluded
    createdAt: v.number(), // When the discussion was created
    conclusions: v.optional(
      v.array(
        v.object({
          text: v.string(), // The conclusion text
          tags: v.array(v.string()), // Optional tags for categorizing the conclusion (e.g., "task", "decision", "action", etc.)
        })
      )
    ), // Conclusions for this discussion
    concludedAt: v.optional(v.number()), // When the discussion was concluded
    concludedBy: v.optional(v.string()), // Session ID of who concluded the discussion
  }).index('by_key', ['key']),

  /**
   * Individual messages within discussions.
   * Stores message content, sender information, and timestamps.
   */
  discussionMessages: defineTable({
    discussionKey: v.string(), // The discussion this message belongs to
    name: v.string(), // Name of the person who wrote the message
    message: v.string(), // The content of the message
    timestamp: v.number(), // When the message was sent
    sessionId: v.optional(v.string()), // Session ID of the sender (optional)
  }).index('by_discussion', ['discussionKey']),

  /**
   * Checklist state management for collaborative task tracking.
   * Tracks checklist lifecycle and metadata.
   */
  checklistState: defineTable({
    key: v.string(), // Unique identifier for the checklist
    title: v.string(), // Title of the checklist
    isActive: v.boolean(), // Whether the checklist is active or concluded
    createdAt: v.number(), // When the checklist was created
    concludedAt: v.optional(v.number()), // When the checklist was concluded
    concludedBy: v.optional(v.string()), // Session ID of who concluded the checklist
  }).index('by_key', ['key']),

  /**
   * Individual items within checklists.
   * Stores item content, completion status, ordering, and audit trail.
   */
  checklistItems: defineTable({
    checklistKey: v.string(), // The checklist this item belongs to
    text: v.string(), // The item text/description
    isCompleted: v.boolean(), // Whether the item is completed
    order: v.number(), // Display order
    createdAt: v.number(), // When the item was created
    completedAt: v.optional(v.number()), // When the item was completed
    createdBy: v.optional(v.string()), // Session ID of who created the item
    completedBy: v.optional(v.string()), // Session ID of who completed the item
  })
    .index('by_checklist', ['checklistKey'])
    .index('by_checklist_order', ['checklistKey', 'order']),

  /**
   * Attendance tracking for events and meetings.
   * Records attendance status, reasons, and participant information.
   */
  attendanceRecords: defineTable({
    attendanceKey: v.string(), // The attendance session key (hardcoded)
    timestamp: v.number(), // When the attendance was recorded
    userId: v.optional(v.id('users')), // Optional user ID (for authenticated users)
    name: v.optional(v.string()), // Name (required for anonymous users)
    status: v.optional(v.union(v.literal('attending'), v.literal('not_attending'))), // Attendance status
    reason: v.optional(v.string()), // Optional reason for not attending
    remarks: v.optional(v.string()), // Optional remarks for attending
    isManuallyJoined: v.optional(v.boolean()), // Whether this person manually joined the list (vs being in expected list)
  })
    .index('by_attendance', ['attendanceKey'])
    .index('by_name_attendance', ['attendanceKey', 'name'])
    .index('by_user_attendance', ['attendanceKey', 'userId']),

  /**
   * User accounts supporting authenticated, anonymous, and Google OAuth users.
   * Stores user credentials, names, and recovery information.
   */
  users: defineTable(
    v.union(
      v.object({
        type: v.literal('full'),
        name: v.string(),
        username: v.optional(v.string()),
        email: v.string(),
        recoveryCode: v.optional(v.string()),
        accessLevel: v.optional(v.union(v.literal('user'), v.literal('system_admin'))),
        google: v.optional(
          v.object({
            id: v.string(),
            email: v.string(),
            verified_email: v.optional(v.boolean()),
            name: v.string(),
            given_name: v.optional(v.string()),
            family_name: v.optional(v.string()),
            picture: v.optional(v.string()),
            locale: v.optional(v.string()),
            hd: v.optional(v.string()),
          })
        ),
      }),
      v.object({
        type: v.literal('anonymous'),
        name: v.string(), //system generated name
        recoveryCode: v.optional(v.string()),
        accessLevel: v.optional(v.union(v.literal('user'), v.literal('system_admin'))),
      })
    )
  )
    .index('by_username', ['username'])
    .index('by_email', ['email'])
    .index('by_name', ['name'])
    .index('by_googleId', ['google.id']),

  /**
   * User sessions for authentication and state management.
   * Links session IDs to user accounts with creation timestamps.
   */
  sessions: defineTable({
    sessionId: v.string(), //this is provided by the client
    userId: v.id('users'), // null means session exists but not authenticated
    createdAt: v.number(),
    authMethod: v.optional(
      v.union(
        v.literal('google'), // Authenticated via Google OAuth
        v.literal('login_code'), // Authenticated via login code
        v.literal('recovery_code'), // Authenticated via recovery code
        v.literal('anonymous'), // Anonymous session
        v.literal('username_password') // Traditional username/password (for future use)
      )
    ), // How the user authenticated for this session
    expiresAt: v.optional(v.number()), // DEPRECATED: No longer used for session expiry. Kept for migration compatibility.
    expiresAtLabel: v.optional(v.string()), // DEPRECATED: No longer used for session expiry. Kept for migration compatibility.
  }).index('by_sessionId', ['sessionId']),

  /**
   * Temporary login codes for cross-device authentication.
   * Stores time-limited codes for secure device-to-device login.
   */
  loginCodes: defineTable({
    code: v.string(), // The 8-letter login code
    userId: v.id('users'), // The user who generated this code
    createdAt: v.number(), // When the code was created
    expiresAt: v.number(), // When the code expires (1 minute after creation)
  }).index('by_code', ['code']),

  /**
   * Authentication provider configuration for dynamic auth provider setup.
   * Supports multiple auth providers (Google, GitHub, etc.) with unified structure.
   */
  auth_providerConfigs: defineTable({
    type: v.union(v.literal('google')), // Auth provider type (extensible for future providers)
    enabled: v.boolean(), // Whether this auth provider is enabled
    projectId: v.optional(v.string()), // Google Cloud Project ID (optional, for convenience links)
    clientId: v.optional(v.string()), // OAuth client ID
    clientSecret: v.optional(v.string()), // OAuth client secret (encrypted storage recommended)
    redirectUris: v.array(v.string()), // Allowed redirect URIs for OAuth
    configuredBy: v.id('users'), // User who configured this (must be system_admin)
    configuredAt: v.number(), // When this configuration was created/updated
  }).index('by_type', ['type']),

  /**
   * Login requests for authentication provider flows (e.g., Google OAuth).
   * Tracks the state of a login attempt and links to sessions and users.
   */
  auth_loginRequests: defineTable({
    sessionId: v.string(), // Session initiating the login
    status: v.union(v.literal('pending'), v.literal('completed'), v.literal('failed')), // Status of the login request
    error: v.optional(v.string()), // Error message if failed
    createdAt: v.number(), // Timestamp of creation
    completedAt: v.optional(v.number()), // Timestamp of completion
    provider: v.union(v.literal('google')), // e.g., 'google'
    expiresAt: v.number(), // When this login request expires (15 minutes from creation)
    redirectUri: v.string(), // The OAuth redirect URI used for this login request
  }),

  /**
   * Connect requests for authentication provider account linking flows (e.g., Google OAuth).
   * Tracks the state of a connect attempt and links to sessions and users.
   * Separate from login requests to make flow types explicit and ensure proper validation.
   */
  auth_connectRequests: defineTable({
    sessionId: v.string(), // Session initiating the connect
    status: v.union(v.literal('pending'), v.literal('completed'), v.literal('failed')), // Status of the connect request
    error: v.optional(v.string()), // Error message if failed
    createdAt: v.number(), // Timestamp of creation
    completedAt: v.optional(v.number()), // Timestamp of completion
    provider: v.union(v.literal('google')), // e.g., 'google'
    expiresAt: v.number(), // When this connect request expires (15 minutes from creation)
    redirectUri: v.string(), // The OAuth redirect URI used for this connect request
  }),

  /**
   * Machine registrations for the assistant orchestrator.
   * Tracks physical machines that can host workers/assistants.
   * Machine ID is generated client-side using nanoid.
   * Note: Machines no longer have authentication tokens - workers authenticate individually.
   */
  machines: defineTable({
    machineId: v.string(), // Client-generated nanoid (not Convex _id)
    name: v.string(), // User-friendly name (e.g., "MacBook Pro", "Desktop PC")
    status: v.union(v.literal('online'), v.literal('offline')), // Connection status
    lastHeartbeat: v.number(), // Timestamp of last heartbeat/activity
    userId: v.id('users'), // Owner of this machine
  })
    .index('by_machine_id', ['machineId'])
    .index('by_user_id', ['userId']),

  /**
   * Worker registrations for individual assistant instances.
   * Each worker requires explicit user approval before it can start.
   * Workers are tied to a specific machine and have their own authentication token.
   *
   * Status dimensions:
   * - approvalStatus: Authorization state (pending/approved/revoked) - persistent
   * - status: Operational state (offline/online) - transient
   */
  workers: defineTable({
    workerId: v.string(), // Client-generated nanoid
    machineId: v.string(), // Reference to parent machine
    name: v.optional(v.string()), // Optional user-friendly name
    secret: v.string(), // Cryptographic secret for authentication (stored plain for retrieval)
    approvalStatus: v.union(v.literal('pending'), v.literal('approved'), v.literal('revoked')),
    status: v.union(v.literal('offline'), v.literal('online')),
    createdAt: v.number(), // When worker was created
    approvedAt: v.optional(v.number()), // When worker was approved
    approvedBy: v.optional(v.id('users')), // User who approved
    lastHeartbeat: v.optional(v.number()), // Last activity timestamp
    connectRequestedAt: v.optional(v.number()), // When frontend requested connection
    connectedAt: v.optional(v.number()), // When worker completed connection
  })
    .index('by_worker_id', ['workerId'])
    .index('by_machine_id', ['machineId'])
    .index('by_machine_and_worker', ['machineId', 'workerId'])
    .index('by_approval_status', ['approvalStatus'])
    .index('by_status', ['status'])
    .index('by_machine_and_approval_status', ['machineId', 'approvalStatus']),

  /**
   * Available AI models for each worker.
   * Updated by worker when opencode client initializes.
   */
  workerModels: defineTable({
    workerId: v.string(), // Worker this model list belongs to
    models: v.array(
      v.object({
        id: v.string(), // Model ID (e.g., "anthropic/claude-3-5-sonnet-20241022")
        name: v.string(), // Display name (e.g., "Claude 3.5 Sonnet")
        provider: v.string(), // Provider (e.g., "anthropic")
      })
    ),
    updatedAt: v.number(), // When this list was last updated
  }).index('by_worker_id', ['workerId']),

  /**
   * Sync state for worker session synchronization.
   * Tracks last successful sync time to enable incremental syncing.
   */
  workerSyncState: defineTable({
    workerId: v.string(), // Worker ID
    lastSyncedAt: v.number(), // Timestamp of last successful session sync
  }).index('by_worker_id', ['workerId']),

  /**
   * Chat sessions for worker conversations.
   * Each session represents a conversation with an AI model on a specific worker.
   * Sessions can be active, idle (resumable), or terminated.
   *
   * Session ID Mapping:
   * - sessionId: Convex-generated ID (ChatSessionId) - primary identifier
   * - opencodeSessionId: OpenCode SDK-generated ID - maps to OpenCode's internal session
   *
   * Soft Deletion:
   * - deletedAt: If set, session was deleted from OpenCode (soft delete for history preservation)
   * - deletedInOpencode: Flag indicating the session no longer exists in OpenCode
   *
   * Model Field (DEPRECATED):
   * - model: Deprecated field - model is now tracked per-message for complete audit trail
   *   This field may still be updated for backward compatibility but should not be relied upon
   */
  chatSessions: defineTable({
    sessionId: v.string(), // Primary key (ChatSessionId - nanoid generated by backend)
    opencodeSessionId: v.optional(v.string()), // OpenCode session ID (OpencodeSessionId - set by worker)
    name: v.optional(v.string()), // Session name/title from OpenCode
    lastSyncedNameAt: v.optional(v.number()), // When session name was last synced from OpenCode
    workerId: v.string(), // Worker handling this session
    userId: v.id('users'), // User who owns this session
    model: v.optional(v.string()), // DEPRECATED: AI model (now tracked per-message)
    status: v.union(v.literal('active'), v.literal('inactive')),
    createdAt: v.number(), // When session was created
    lastActivity: v.number(), // Last message or interaction timestamp
    deletedAt: v.optional(v.number()), // When session was soft-deleted (if deleted from OpenCode)
    deletedInOpencode: v.optional(v.boolean()), // True if session no longer exists in OpenCode
    syncedFromOpencode: v.optional(v.boolean()), // True if session was created directly in OpenCode (not via UI)
  })
    .index('by_session_id', ['sessionId'])
    .index('by_opencode_session_id', ['opencodeSessionId'])
    .index('by_worker_id', ['workerId'])
    .index('by_user_id', ['userId'])
    .index('by_status', ['status'])
    .index('by_worker_and_status', ['workerId', 'status'])
    .index('by_deleted', ['deletedInOpencode']),

  /**
   * Chat messages within sessions.
   * Stores both user messages and assistant responses.
   * Messages can be incomplete while streaming (completed: false).
   * Each message stores the model that was used, providing an audit trail.
   */
  chatMessages: defineTable({
    messageId: v.string(), // Primary key (nanoid)
    sessionId: v.string(), // Session this message belongs to
    role: v.union(v.literal('user'), v.literal('assistant'), v.literal('system')),
    content: v.string(), // Full message content
    timestamp: v.number(), // When message was created
    completed: v.boolean(), // False while streaming, true when done
    model: v.optional(v.string()), // AI model used for this message (e.g., "claude-sonnet-4-5")
  })
    .index('by_message_id', ['messageId'])
    .index('by_session_id', ['sessionId'])
    .index('by_session_and_timestamp', ['sessionId', 'timestamp']),

  /**
   * Chat chunks for streaming responses.
   * Stores individual chunks of assistant responses as they stream in.
   * Ordered by sequence number for proper reassembly.
   */
  chatChunks: defineTable({
    chunkId: v.string(), // Primary key (nanoid)
    messageId: v.string(), // Message this chunk belongs to
    sessionId: v.string(), // Session for faster querying
    chunk: v.string(), // The text chunk
    sequence: v.number(), // Order of this chunk in the message
    timestamp: v.number(), // When chunk was received
  })
    .index('by_chunk_id', ['chunkId'])
    .index('by_message_id', ['messageId'])
    .index('by_session_and_sequence', ['sessionId', 'sequence'])
    .index('by_message_and_sequence', ['messageId', 'sequence']),
});
