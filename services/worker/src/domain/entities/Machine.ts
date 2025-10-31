import type { MachineId, MachineSecret, WorkerId } from '../valueObjects/Ids';
import { validateMachineId, validateMachineSecret } from '../valueObjects/Ids';
import { MachineToken } from '../valueObjects/MachineToken';
import type { IWorker } from './Worker';

/**
 * Valid machine status values.
 */
export type MachineStatus = 'online' | 'offline';

/**
 * Configuration for creating a Machine.
 */
export interface MachineConfig {
  /** Unique machine identifier */
  id: string;
  /** Machine secret for authentication */
  secret: string;
  /** Root directory for worker operations */
  rootDirectory: string;
  /** Initial machine status */
  status?: MachineStatus;
}

/**
 * Interface for Machine entity.
 * Represents a registered machine that can host workers.
 */
export interface IMachine {
  readonly id: MachineId;
  readonly secret: MachineSecret;
  readonly rootDirectory: string;
  readonly workers: ReadonlyMap<WorkerId, IWorker>;
  status: MachineStatus;

  /**
   * Gets the machine token for authentication.
   * @returns Machine token
   */
  getToken(): MachineToken;

  /**
   * Checks if machine is online.
   * @returns True if machine is online
   */
  isOnline(): boolean;

  /**
   * Sets the machine status to online.
   */
  setOnline(): void;

  /**
   * Sets the machine status to offline.
   */
  setOffline(): void;

  /**
   * Adds a worker to this machine.
   * @param worker - Worker to add
   * @throws Error if worker with same ID already exists or worker belongs to different machine
   */
  addWorker(worker: IWorker): void;

  /**
   * Removes a worker from this machine.
   * @param workerId - ID of worker to remove
   */
  removeWorker(workerId: WorkerId): void;

  /**
   * Gets a worker by ID.
   * @param workerId - ID of worker to retrieve
   * @returns Worker if found, undefined otherwise
   */
  getWorker(workerId: WorkerId): IWorker | undefined;

  /**
   * Gets the total number of workers.
   * @returns Worker count
   */
  getWorkerCount(): number;

  /**
   * Gets the total number of active sessions across all workers.
   * @returns Active session count
   */
  getActiveSessionCount(): number;
}

/**
 * Machine entity representing a registered machine that hosts workers.
 * Manages multiple directory-bound workers.
 */
export class Machine implements IMachine {
  readonly id: MachineId;
  readonly secret: MachineSecret;
  readonly rootDirectory: string;
  status: MachineStatus;
  private readonly _workers: Map<WorkerId, IWorker>;
  private readonly _token: MachineToken;

  private constructor(
    id: MachineId,
    secret: MachineSecret,
    rootDirectory: string,
    status: MachineStatus
  ) {
    this.id = id;
    this.secret = secret;
    this.rootDirectory = rootDirectory;
    this.status = status;
    this._workers = new Map();
    this._token = MachineToken.create(id, secret);
  }

  /**
   * Creates a new Machine instance.
   * @param config - Machine configuration
   * @returns A new Machine instance
   * @throws Error if configuration is invalid
   */
  static create(config: MachineConfig): Machine {
    if (!config.rootDirectory || typeof config.rootDirectory !== 'string') {
      throw new Error('Machine root directory must be a non-empty string');
    }

    const id = validateMachineId(config.id);
    const secret = validateMachineSecret(config.secret);

    return new Machine(id, secret, config.rootDirectory, config.status || 'offline');
  }

  /**
   * Gets readonly view of workers map.
   */
  get workers(): ReadonlyMap<WorkerId, IWorker> {
    return this._workers;
  }

  /**
   * Gets the machine token for authentication.
   * @returns Machine token
   */
  getToken(): MachineToken {
    return this._token;
  }

  /**
   * Checks if machine is online.
   * @returns True if machine is online
   */
  isOnline(): boolean {
    return this.status === 'online';
  }

  /**
   * Sets the machine status to online.
   */
  setOnline(): void {
    this.status = 'online';
  }

  /**
   * Sets the machine status to offline.
   */
  setOffline(): void {
    this.status = 'offline';
  }

  /**
   * Adds a worker to this machine.
   * @param worker - Worker to add
   * @throws Error if worker with same ID already exists or worker belongs to different machine
   */
  addWorker(worker: IWorker): void {
    if (worker.machineId !== this.id) {
      throw new Error(`Worker ${worker.id} belongs to machine ${worker.machineId}, not ${this.id}`);
    }

    if (this._workers.has(worker.id)) {
      throw new Error(`Worker ${worker.id} already exists in machine ${this.id}`);
    }

    this._workers.set(worker.id, worker);
  }

  /**
   * Removes a worker from this machine.
   * @param workerId - ID of worker to remove
   */
  removeWorker(workerId: WorkerId): void {
    this._workers.delete(workerId);
  }

  /**
   * Gets a worker by ID.
   * @param workerId - ID of worker to retrieve
   * @returns Worker if found, undefined otherwise
   */
  getWorker(workerId: WorkerId): IWorker | undefined {
    return this._workers.get(workerId);
  }

  /**
   * Gets the total number of workers.
   * @returns Worker count
   */
  getWorkerCount(): number {
    return this._workers.size;
  }

  /**
   * Gets the total number of active sessions across all workers.
   * @returns Active session count
   */
  getActiveSessionCount(): number {
    let count = 0;
    for (const worker of this._workers.values()) {
      count += worker.getSessionCount('active');
    }
    return count;
  }
}
