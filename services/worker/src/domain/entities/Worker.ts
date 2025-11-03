import type { MachineId, SessionId, WorkerId } from '../valueObjects/Ids';
import { validateMachineId, validateWorkerId } from '../valueObjects/Ids';
import type { ISession } from './Session';

/**
 * Configuration for creating a Worker entity.
 * This is for the domain entity, not the service configuration.
 */
export interface WorkerEntityConfig {
  /** Unique worker identifier */
  id: string;
  /** Machine ID this worker belongs to */
  machineId: string;
  /** Absolute path to worker's working directory */
  directory: string;
}

/**
 * Interface for Worker entity.
 * Represents an assistant bound to a specific directory.
 */
export interface IWorker {
  readonly id: WorkerId;
  readonly machineId: MachineId;
  readonly directory: string;
  readonly sessions: ReadonlyMap<SessionId, ISession>;

  /**
   * Adds a session to this worker.
   * @param session - Session to add
   * @throws Error if session with same ID already exists
   */
  addSession(session: ISession): void;

  /**
   * Removes a session from this worker.
   * @param sessionId - ID of session to remove
   */
  removeSession(sessionId: SessionId): void;

  /**
   * Gets a session by ID.
   * @param sessionId - ID of session to retrieve
   * @returns Session if found, undefined otherwise
   */
  getSession(sessionId: SessionId): ISession | undefined;

  /**
   * Gets count of sessions by status.
   * @param status - Optional status filter
   * @returns Count of sessions matching status, or total if no filter
   */
  getSessionCount(status?: 'active' | 'idle' | 'terminated'): number;
}

/**
 * Worker entity representing a directory-bound assistant.
 * Manages multiple concurrent chat sessions.
 */
export class Worker implements IWorker {
  readonly id: WorkerId;
  readonly machineId: MachineId;
  readonly directory: string;
  private readonly _sessions: Map<SessionId, ISession>;

  private constructor(id: WorkerId, machineId: MachineId, directory: string) {
    this.id = id;
    this.machineId = machineId;
    this.directory = directory;
    this._sessions = new Map();
  }

  /**
   * Creates a new Worker instance.
   * @param config - Worker entity configuration
   * @returns A new Worker instance
   * @throws Error if configuration is invalid
   */
  static create(config: WorkerEntityConfig): Worker {
    if (!config.directory || typeof config.directory !== 'string') {
      throw new Error('Worker directory must be a non-empty string');
    }

    const id = validateWorkerId(config.id);
    const machineId = validateMachineId(config.machineId);

    return new Worker(id, machineId, config.directory);
  }

  /**
   * Gets readonly view of sessions map.
   */
  get sessions(): ReadonlyMap<SessionId, ISession> {
    return this._sessions;
  }

  /**
   * Adds a session to this worker.
   * @param session - Session to add
   * @throws Error if session with same ID already exists or session belongs to different worker
   */
  addSession(session: ISession): void {
    if (session.workerId !== this.id) {
      throw new Error(
        `Session ${session.id} belongs to worker ${session.workerId}, not ${this.id}`
      );
    }

    if (this._sessions.has(session.id)) {
      throw new Error(`Session ${session.id} already exists in worker ${this.id}`);
    }

    this._sessions.set(session.id, session);
  }

  /**
   * Removes a session from this worker.
   * @param sessionId - ID of session to remove
   */
  removeSession(sessionId: SessionId): void {
    this._sessions.delete(sessionId);
  }

  /**
   * Gets a session by ID.
   * @param sessionId - ID of session to retrieve
   * @returns Session if found, undefined otherwise
   */
  getSession(sessionId: SessionId): ISession | undefined {
    return this._sessions.get(sessionId);
  }

  /**
   * Gets count of sessions by status.
   * @param status - Optional status filter
   * @returns Count of sessions matching status, or total if no filter
   */
  getSessionCount(status?: 'active' | 'idle' | 'terminated'): number {
    if (!status) {
      return this._sessions.size;
    }

    let count = 0;
    for (const session of this._sessions.values()) {
      if (session.status === status) {
        count++;
      }
    }
    return count;
  }
}
