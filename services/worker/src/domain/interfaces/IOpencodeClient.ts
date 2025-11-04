import type { SessionId } from '../valueObjects/Ids';

/**
 * Opaque type representing an OpenCode client instance.
 * This wraps the actual OpenCode SDK client to maintain clean architecture boundaries.
 */
export interface IOpencodeInstance {
  readonly __brand: 'OpencodeClient';
  readonly _internal: unknown; // Actual SDK client instance
}

/**
 * Session information returned from OpenCode.
 * Based on OpenCode SDK Session type.
 *
 * Note: The SDK's Session type doesn't include model info or createdAt.
 * We track those separately in our domain entities.
 */
export interface OpencodeSessionInfo {
  /** Session identifier from OpenCode */
  id: string;
  /** Session title/name */
  title?: string;
  /** Project ID */
  projectID: string;
  /** Working directory */
  directory: string;
  /** Parent session ID if this is a forked session */
  parentID?: string;
}

/**
 * Message part structure for sending prompts.
 * Based on OpenCode SDK Part type.
 */
export interface OpencodeMessagePart {
  type: 'text' | 'image';
  text?: string;
  data?: string;
}

/**
 * Model configuration for creating sessions.
 * Based on OpenCode SDK model configuration.
 */
export interface OpencodeModelConfig {
  /** Provider ID (e.g., 'anthropic', 'openai') */
  providerID: string;
  /** Model ID (e.g., 'claude-3-5-sonnet-20241022') */
  modelID: string;
}

/**
 * Prompt configuration for sending messages.
 * Based on OpenCode SDK session.prompt parameters.
 */
export interface OpencodePromptConfig {
  /** Model configuration */
  model: OpencodeModelConfig;
  /** Message parts */
  parts: OpencodeMessagePart[];
  /** Whether to skip AI response (context injection only) */
  noReply?: boolean;
}

/**
 * Structured response from OpenCode prompt.
 * Separates user-visible content from internal reasoning and other parts.
 */
export interface OpencodeStructuredResponse {
  /** User-visible text content */
  content?: string;
  /** Internal model thinking/reasoning */
  reasoning?: string;
  /** Other parts (tool results, file references, patches, etc.) */
  otherParts?: unknown[];
}

/**
 * Port interface for OpenCode SDK integration.
 * Abstracts OpenCode operations to maintain clean architecture.
 *
 * This interface is implemented by the infrastructure layer adapter
 * that wraps the actual @opencode-ai/sdk package.
 *
 * @see https://opencode.ai/docs/sdk/
 */
export interface IOpencodeClient {
  /**
   * Creates a new OpenCode client instance for a specific directory.
   * This starts an OpenCode server and client.
   *
   * @param directory - Absolute path to working directory
   * @returns OpenCode client instance
   * @throws Error if OpenCode fails to start or directory is invalid
   *
   * @see https://opencode.ai/docs/sdk/#create-client
   */
  createClient(directory: string): Promise<IOpencodeInstance>;

  /**
   * Lists all available AI models from the OpenCode server.
   *
   * @param client - OpenCode client instance
   * @returns Array of available models with their metadata
   * @throws Error if listing fails
   *
   * @see https://opencode.ai/docs/sdk/#models
   */
  listModels(client: IOpencodeInstance): Promise<
    Array<{
      id: string;
      name: string;
      provider: string;
    }>
  >;

  /**
   * Creates a new chat session with specified model.
   *
   * @param client - OpenCode client instance
   * @param model - Model identifier (e.g., 'anthropic/claude-3-5-sonnet-20241022')
   * @returns Session information including ID
   * @throws Error if session creation fails
   *
   * @see https://opencode.ai/docs/sdk/#sessions
   */
  createSession(client: IOpencodeInstance, model: string): Promise<OpencodeSessionInfo>;

  /**
   * Lists all sessions for a client.
   *
   * @param client - OpenCode client instance
   * @returns Array of session information
   * @throws Error if listing fails
   *
   * @see https://opencode.ai/docs/sdk/#sessions
   */
  listSessions(client: IOpencodeInstance): Promise<OpencodeSessionInfo[]>;

  /**
   * Gets a specific session by ID.
   *
   * @param client - OpenCode client instance
   * @param sessionId - Session identifier
   * @returns Session information
   * @throws Error if session not found
   *
   * @see https://opencode.ai/docs/sdk/#sessions
   */
  getSession(client: IOpencodeInstance, sessionId: SessionId): Promise<OpencodeSessionInfo>;

  /**
   * Rename/update a session title in OpenCode.
   *
   * @param client - OpenCode client instance
   * @param sessionId - Session ID to rename
   * @param title - New session title
   * @throws Error if rename fails
   *
   * @see https://opencode.ai/docs/sdk/#sessions
   */
  renameSession(client: IOpencodeInstance, sessionId: string, title: string): Promise<void>;

  /**
   * Sends a prompt to a session and streams the response.
   * Returns an async iterable iterator that yields structured response chunks.
   *
   * @param client - OpenCode client instance
   * @param sessionId - Session identifier
   * @param content - Message content to send
   * @param model - Optional model override for this message
   * @returns Async iterable iterator yielding structured response chunks
   * @throws Error if prompt fails
   *
   * @see https://opencode.ai/docs/sdk/#sessions
   */
  sendPrompt(
    client: IOpencodeInstance,
    sessionId: SessionId,
    content: string,
    model?: string
  ): AsyncIterableIterator<OpencodeStructuredResponse>;

  /**
   * Closes a session and cleans up resources.
   * Note: OpenCode sessions persist and can be resumed later.
   *
   * @param client - OpenCode client instance
   * @param sessionId - Session identifier
   * @throws Error if deletion fails
   *
   * @see https://opencode.ai/docs/sdk/#sessions
   */
  deleteSession(client: IOpencodeInstance, sessionId: SessionId): Promise<void>;

  /**
   * Closes the OpenCode client and server.
   * Terminates all sessions associated with this client.
   *
   * @param client - OpenCode client instance
   * @throws Error if shutdown fails
   */
  closeClient(client: IOpencodeInstance): Promise<void>;
}
