import type { WorkerConfig } from '../config/types';
import type { WorkerState } from '../domain/entities/WorkerStateMachine';
import { MachineServer } from '../presentation/MachineServer';

/**
 * Represents a single worker instance managed by the orchestrator.
 */
export interface WorkerInstance {
  /** Worker configuration */
  config: WorkerConfig;
  /** MachineServer instance */
  server: MachineServer;
  /** Current running state */
  isRunning: boolean;
  /** Current worker state */
  state: WorkerState;
  /** Error message if startup failed */
  error?: string;
}

/**
 * Manages multiple worker instances in production mode.
 *
 * This class is responsible for:
 * - Starting all configured workers
 * - Managing their lifecycle
 * - Handling graceful shutdown
 * - Providing status information
 *
 * @example
 * ```typescript
 * const config = await loadOrchestratorConfig();
 * const manager = new OrchestratorManager(config.workers);
 *
 * await manager.startAll();
 * console.log(`Started ${manager.getRunningCount()} workers`);
 *
 * // Later...
 * await manager.stopAll();
 * ```
 */
export class OrchestratorManager {
  private workers: Map<string, WorkerInstance>;

  /**
   * Create a new orchestrator manager.
   *
   * @param configs - Array of worker configurations to manage
   */
  constructor(configs: WorkerConfig[]) {
    this.workers = new Map();

    // Initialize worker instances
    for (const config of configs) {
      const key = this.getWorkerKey(config);
      this.workers.set(key, {
        config,
        server: new MachineServer(),
        isRunning: false,
        state: 'UNINITIALIZED' as WorkerState,
      });
    }
  }

  /**
   * Generate a unique key for a worker.
   * Format: machineId:workerId
   */
  private getWorkerKey(config: WorkerConfig): string {
    return `${config.machineId}:${config.workerId}`;
  }

  /**
   * Start all configured workers.
   * Workers are started in parallel, and failures are logged but don't stop other workers.
   *
   * @throws Error if all workers fail to start
   */
  async startAll(): Promise<void> {
    console.log(`🚀 Starting ${this.workers.size} worker(s)...\n`);

    const startPromises = Array.from(this.workers.entries()).map(async ([_key, instance]) => {
      try {
        console.log(`📍 Starting worker: ${instance.config.workerId}`);
        console.log(`   Machine ID: ${instance.config.machineId}`);
        console.log(`   Working Directory: ${instance.config.workingDirectory}`);
        console.log(`   Convex URL: ${instance.config.convexUrl}\n`);

        await instance.server.start(instance.config);

        instance.isRunning = true;
        instance.state = instance.server.getState();

        console.log(`✅ Worker ${instance.config.workerId} started successfully\n`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        instance.error = errorMessage;
        instance.isRunning = false;

        console.error(`❌ Failed to start worker ${instance.config.workerId}:`);
        console.error(`   ${errorMessage}\n`);
      }
    });

    await Promise.allSettled(startPromises);

    // Check if any workers started successfully
    const runningCount = this.getRunningCount();
    if (runningCount === 0) {
      throw new Error('Failed to start any workers. Check the errors above.');
    }

    console.log(`\n✅ ${runningCount} of ${this.workers.size} worker(s) started successfully`);
  }

  /**
   * Stop all running workers gracefully.
   * Workers are stopped in parallel with a timeout.
   */
  async stopAll(): Promise<void> {
    console.log(`\n👋 Stopping ${this.getRunningCount()} running worker(s)...`);

    const stopPromises = Array.from(this.workers.values())
      .filter((instance) => instance.isRunning)
      .map(async (instance) => {
        try {
          await instance.server.stop();
          instance.isRunning = false;
          instance.state = instance.server.getState();
          console.log(`✅ Worker ${instance.config.workerId} stopped`);
        } catch (error) {
          console.error(
            `❌ Error stopping worker ${instance.config.workerId}:`,
            error instanceof Error ? error.message : String(error)
          );
        }
      });

    await Promise.allSettled(stopPromises);
    console.log('✅ All workers stopped');
  }

  /**
   * Get the number of currently running workers.
   */
  getRunningCount(): number {
    return Array.from(this.workers.values()).filter((w) => w.isRunning).length;
  }

  /**
   * Get the total number of configured workers.
   */
  getTotalCount(): number {
    return this.workers.size;
  }

  /**
   * Check if all workers are running.
   */
  isAllRunning(): boolean {
    return this.getRunningCount() === this.workers.size;
  }

  /**
   * Get status of all workers.
   */
  getStatus(): WorkerInstance[] {
    return Array.from(this.workers.values()).map((instance) => ({
      ...instance,
      state: instance.isRunning ? instance.server.getState() : instance.state,
    }));
  }

  /**
   * Get a specific worker instance by machine and worker ID.
   */
  getWorker(machineId: string, workerId: string): WorkerInstance | undefined {
    const key = `${machineId}:${workerId}`;
    return this.workers.get(key);
  }
}
