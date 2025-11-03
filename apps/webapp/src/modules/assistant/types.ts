/**
 * Type definitions for the assistant orchestration module.
 * Defines interfaces for machines, assistants, chat sessions, and related data structures.
 */

// Machine-related types

/**
 * Represents a registered machine that can host assistants.
 * Machines are physical or virtual computers where the assistant runtime is installed.
 */
export interface Machine {
  /** Unique identifier for the machine (nanoid) */
  machineId: string;
  /** User-friendly name for the machine */
  name: string;
  /** Current connection status of the machine */
  status: 'online' | 'offline';
  /** Timestamp of last heartbeat/activity from the machine */
  lastSeen: number;
  /** Number of assistants registered on this machine */
  assistantCount: number;
  /** Worker counts by status */
  workerCounts: {
    /** Number of online/ready workers */
    online: number;
    /** Number of offline workers */
    offline: number;
    /** Number of pending authorization workers */
    pending: number;
  };
}

/**
 * Registration information returned when creating a new machine.
 * Note: Machines no longer have authentication tokens - workers authenticate individually.
 */
export interface MachineRegistration {
  /** Unique identifier for the machine */
  machineId: string;
  /** User-friendly name for the machine */
  name: string;
}

/**
 * Result data from fetching machines for the current user.
 */
export interface MachinesData {
  /** Array of machines, or undefined if still loading */
  machines: Machine[] | undefined;
  /** Whether the fetch operation is in progress */
  loading: boolean;
  /** Error object if fetch failed, null otherwise */
  error: Error | null;
}

/**
 * Return value from the useCreateMachine hook.
 * Provides machine creation function and loading state.
 */
export interface CreateMachineReturn {
  /**
   * Creates a new machine with the given name.
   * @param name - User-friendly name for the machine
   * @returns Promise resolving to machine registration token
   */
  createMachine: (name: string) => Promise<MachineRegistration>;
  /** Whether machine creation is in progress */
  isCreating: boolean;
  /** Error object if creation failed, null otherwise */
  error: Error | null;
}

// Assistant-related types

/**
 * Represents an assistant instance running on a machine.
 * Assistants are created in specific working directories and can have multiple chat sessions.
 */
export interface Assistant {
  /** Unique identifier for the assistant (nanoid) */
  assistantId: string;
  /** ID of the machine hosting this assistant */
  machineId: string;
  /** Name of the machine hosting this assistant */
  machineName: string;
  /** Working directory path where the assistant operates */
  workingDirectory: string;
  /** Display name in format `<machine_name>:<working_directory>` */
  displayName: string;
  /** Current connection status of the assistant */
  status: 'online' | 'offline';
  /** Number of active chat sessions for this assistant */
  activeSessionCount: number;
  /** List of AI models available for this assistant */
  availableModels: string[];
}

/**
 * Result data from fetching assistants.
 */
export interface AssistantsData {
  /** Array of assistants, or undefined if still loading */
  assistants: Assistant[] | undefined;
  /** Whether the fetch operation is in progress */
  loading: boolean;
  /** Error object if fetch failed, null otherwise */
  error: Error | null;
}

/**
 * Represents a single message in a chat session.
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** Session this message belongs to */
  sessionId: string;
  /** Role of the message sender */
  role: 'user' | 'assistant' | 'system';
  /** Message content/text */
  content: string;
  /** Timestamp when the message was created */
  timestamp: number;
  /** Whether the message is complete (false while streaming) */
  completed: boolean;
  /** Whether the message is currently being streamed (frontend-only flag) */
  isStreaming?: boolean;
}

/**
 * Represents a chat session with a worker.
 * Sessions are created per worker and can be restored after idle timeout.
 */
export interface ChatSession {
  /** Unique identifier for the session */
  sessionId: string;
  /** ID of the worker handling this session */
  workerId: string;
  /** AI model being used for this session */
  model: string;
  /** Current status of the session */
  status: 'active' | 'idle' | 'terminated';
  /** Timestamp when the session was created */
  createdAt: number;
  /** Timestamp of last activity */
  lastActivity: number;
}

/**
 * Represents a chunk of streaming response.
 */
export interface ChatChunk {
  /** Unique identifier for the chunk */
  chunkId: string;
  /** Message this chunk belongs to */
  messageId: string;
  /** Session this chunk belongs to */
  sessionId: string;
  /** The text chunk */
  chunk: string;
  /** Order of this chunk in the message */
  sequence: number;
  /** Timestamp when chunk was received */
  timestamp: number;
}

/**
 * Return value from the useAssistantChat hook.
 * Provides session management, messaging, and state information.
 */
export interface AssistantChatReturn {
  // Session management
  /** Currently active session, or null if no session */
  session: ChatSession | null;
  /**
   * Starts a new chat session with the specified model.
   * @param model - AI model identifier to use for the session
   * @returns Promise resolving to the new session ID
   */
  startSession: (model: string) => Promise<string>;
  /**
   * Restores an existing session by its ID.
   * @param sessionId - ID of the session to restore
   * @returns Promise that resolves when session is restored
   */
  restoreSession: (sessionId: string) => Promise<void>;
  /**
   * Ends the current active session.
   * @returns Promise that resolves when session is ended
   */
  endSession: () => Promise<void>;
  /**
   * Clears the current active session (without terminating it).
   * Used when navigating away from a session.
   */
  clearSession: () => void;

  // Messaging
  /** Array of messages in the current session */
  messages: ChatMessage[];
  /**
   * Sends a message to the active session.
   * @param content - Message text to send
   * @returns Promise that resolves when message is sent
   */
  sendMessage: (content: string) => Promise<void>;

  // State
  /** Whether any operation is in progress */
  isLoading: boolean;
  /** Error object if operation failed, null otherwise */
  error: Error | null;
}

// Worker-related types

/**
 * Represents a worker instance that requires authentication.
 * Workers are individual processes that need explicit user approval.
 */
export interface Worker {
  /** Unique identifier for the worker (nanoid) */
  workerId: string;
  /** ID of the machine this worker belongs to */
  machineId: string;
  /** Optional user-friendly name for the worker */
  name?: string;
  /** Authorization status (persistent across restarts) */
  approvalStatus: 'pending' | 'approved' | 'revoked';
  /** Operational status (transient) */
  status: 'offline' | 'online';
  /** Timestamp when the worker was created */
  createdAt: number;
  /** Timestamp when the worker was approved (if approved) */
  approvedAt?: number;
  /** Timestamp of last heartbeat/activity from the worker */
  lastHeartbeat?: number;
}

/**
 * Represents a worker pending authorization.
 */
export interface PendingWorker {
  /** Unique identifier for the worker */
  workerId: string;
  /** ID of the machine this worker belongs to */
  machineId: string;
  /** Optional user-friendly name for the worker */
  name?: string;
  /** Authorization status is always pending for this type */
  approvalStatus: 'pending';
  /** Operational status (always offline when pending) */
  status: 'offline';
  /** Timestamp when the worker was created */
  createdAt: number;
}

/**
 * Registration information returned when creating a new worker.
 * Contains the worker token needed for worker authentication.
 */
export interface WorkerRegistration {
  /** Unique identifier for the worker */
  workerId: string;
  /** Worker token in format `machine_<machine_id>:worker_<worker_id>` */
  token: string;
}

/**
 * Result data from fetching workers for a machine.
 */
export interface WorkersData {
  /** Array of workers, or undefined if still loading */
  workers: Worker[] | undefined;
  /** Whether the fetch operation is in progress */
  loading: boolean;
  /** Error object if fetch failed, null otherwise */
  error: Error | null;
}

/**
 * Result data from fetching pending workers for a machine.
 */
export interface PendingWorkersData {
  /** Array of pending workers, or undefined if still loading */
  workers: PendingWorker[] | undefined;
  /** Whether the fetch operation is in progress */
  loading: boolean;
  /** Error object if fetch failed, null otherwise */
  error: Error | null;
}

/**
 * Return value from the useCreateWorker hook.
 * Provides worker creation function and loading state.
 */
export interface CreateWorkerReturn {
  /**
   * Creates a new worker for the specified machine.
   * @param machineId - ID of the machine to create worker for
   * @param name - Optional user-friendly name for the worker
   * @returns Promise resolving to worker registration token
   */
  createWorker: (machineId: string, name?: string) => Promise<WorkerRegistration>;
  /** Whether worker creation is in progress */
  isCreating: boolean;
  /** Error object if creation failed, null otherwise */
  error: Error | null;
}

/**
 * Return value from the useApproveWorker hook.
 * Provides worker approval function and loading state.
 */
export interface ApproveWorkerReturn {
  /**
   * Approves a pending worker authorization request.
   * @param workerId - ID of the worker to approve
   * @returns Promise that resolves when worker is approved
   */
  approveWorker: (workerId: string) => Promise<void>;
  /** Whether approval is in progress */
  isApproving: boolean;
  /** Error object if approval failed, null otherwise */
  error: Error | null;
}

/**
 * Return value from the useRejectWorker hook.
 * Provides worker rejection function and loading state.
 */
export interface RejectWorkerReturn {
  /**
   * Rejects a pending worker authorization request.
   * @param workerId - ID of the worker to reject
   * @returns Promise that resolves when worker is rejected
   */
  rejectWorker: (workerId: string) => Promise<void>;
  /** Whether rejection is in progress */
  isRejecting: boolean;
  /** Error object if rejection failed, null otherwise */
  error: Error | null;
}

/**
 * Return value from the useRemoveWorker hook.
 * Provides worker removal function and loading state.
 */
export interface RemoveWorkerReturn {
  /**
   * Removes a worker from the system.
   * @param workerId - ID of the worker to remove
   * @returns Promise that resolves when worker is removed
   */
  removeWorker: (workerId: string) => Promise<void>;
  /** Whether removal is in progress */
  isRemoving: boolean;
  /** Error object if removal failed, null otherwise */
  error: Error | null;
}

// Model-related types

/**
 * Represents an AI model available for a worker.
 */
export interface WorkerModel {
  /** Model ID (e.g., "anthropic/claude-3-5-sonnet-20241022") */
  id: string;
  /** Display name (e.g., "Claude 3.5 Sonnet") */
  name: string;
  /** Provider (e.g., "anthropic") */
  provider: string;
}

/**
 * Available models data for a worker.
 */
export interface WorkerModelsData {
  /** Array of available models, or null if not yet loaded */
  models: WorkerModel[] | null;
  /** When the models list was last updated */
  updatedAt: number | null;
  /** Whether models are currently loading */
  loading: boolean;
}
