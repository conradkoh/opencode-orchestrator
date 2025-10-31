import type { SessionId, WorkerId } from '../valueObjects/Ids';
import { validateSessionId, validateWorkerId } from '../valueObjects/Ids';

/**
 * Valid session status values.
 */
export type SessionStatus = 'active' | 'idle' | 'terminated';

/**
 * Configuration for creating a Session.
 */
export interface SessionConfig {
  /** Unique session identifier from OpenCode */
  id: string;
  /** Worker ID this session belongs to */
  workerId: string;
  /** AI model being used */
  model: string;
  /** Initial session status */
  status?: SessionStatus;
  /** Creation timestamp */
  createdAt?: number;
  /** Last activity timestamp */
  lastActivity?: number;
}

/**
 * Interface for Session entity.
 * Represents a chat session with an assistant.
 */
export interface ISession {
  readonly id: SessionId;
  readonly workerId: WorkerId;
  readonly model: string;
  readonly createdAt: number;
  status: SessionStatus;
  lastActivity: number;

  /**
   * Checks if the session has been idle for longer than the given timeout.
   * @param timeoutMs - Timeout duration in milliseconds
   * @returns True if session is idle beyond timeout
   */
  isIdle(timeoutMs: number): boolean;

  /**
   * Updates the last activity timestamp to current time.
   */
  updateActivity(): void;

  /**
   * Marks the session as terminated.
   */
  terminate(): void;
}

/**
 * Session entity representing a chat session with an assistant.
 * Tracks activity and manages idle timeout detection.
 */
export class Session implements ISession {
  readonly id: SessionId;
  readonly workerId: WorkerId;
  readonly model: string;
  readonly createdAt: number;
  status: SessionStatus;
  lastActivity: number;

  private constructor(
    id: SessionId,
    workerId: WorkerId,
    model: string,
    status: SessionStatus,
    createdAt: number,
    lastActivity: number
  ) {
    this.id = id;
    this.workerId = workerId;
    this.model = model;
    this.status = status;
    this.createdAt = createdAt;
    this.lastActivity = lastActivity;
  }

  /**
   * Creates a new Session instance.
   * @param config - Session configuration
   * @returns A new Session instance
   * @throws Error if configuration is invalid
   */
  static create(config: SessionConfig): Session {
    if (!config.model || typeof config.model !== 'string') {
      throw new Error('Session model must be a non-empty string');
    }

    const id = validateSessionId(config.id);
    const workerId = validateWorkerId(config.workerId);
    const now = Date.now();

    return new Session(
      id,
      workerId,
      config.model,
      config.status || 'active',
      config.createdAt || now,
      config.lastActivity || now
    );
  }

  /**
   * Checks if the session has been idle for longer than the given timeout.
   * @param timeoutMs - Timeout duration in milliseconds
   * @returns True if session is idle beyond timeout
   */
  isIdle(timeoutMs: number): boolean {
    if (this.status === 'terminated') {
      return false; // Terminated sessions are not considered idle
    }
    const timeSinceActivity = Date.now() - this.lastActivity;
    return timeSinceActivity > timeoutMs;
  }

  /**
   * Updates the last activity timestamp to current time.
   */
  updateActivity(): void {
    this.lastActivity = Date.now();
    if (this.status === 'idle') {
      this.status = 'active';
    }
  }

  /**
   * Marks the session as terminated.
   */
  terminate(): void {
    this.status = 'terminated';
  }
}
