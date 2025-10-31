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
}

/**
 * Registration information returned when creating a new machine.
 * Contains the machine token needed for initial machine registration.
 */
export interface MachineRegistration {
  /** Unique identifier for the machine */
  machineId: string;
  /** Registration token in format `<machine_id>:<machine_secret>` */
  token: string;
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
  /** Role of the message sender */
  role: 'user' | 'assistant' | 'system';
  /** Message content/text */
  content: string;
  /** Timestamp when the message was created */
  timestamp: number;
  /** Whether the message is currently being streamed */
  isStreaming?: boolean;
}

/**
 * Represents a chat session with an assistant.
 * Sessions are created per assistant and can be restored after idle timeout.
 */
export interface ChatSession {
  /** Unique identifier for the session (from assistant runtime) */
  sessionId: string;
  /** ID of the assistant this session belongs to */
  assistantId: string;
  /** AI model being used for this session */
  model: string;
  /** Current status of the session */
  status: 'active' | 'idle' | 'terminated';
  /** Timestamp when the session was created */
  createdAt: number;
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
