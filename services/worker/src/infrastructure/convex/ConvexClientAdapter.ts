import { api } from '@workspace/backend/convex/_generated/api';
import { ConvexHttpClient } from 'convex/browser';
import type { WorkerConfig } from '../../config';

/**
 * Adapter for Convex backend communication.
 * Handles worker registration, authorization, heartbeat, and status updates.
 */
export class ConvexClientAdapter {
  private client: ConvexHttpClient;
  private config: WorkerConfig;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

  /**
   * Creates a new Convex client adapter.
   *
   * @param convexUrl - Convex deployment URL
   * @param config - Worker configuration with credentials
   */
  constructor(convexUrl: string, config: WorkerConfig) {
    this.client = new ConvexHttpClient(convexUrl);
    this.config = config;
  }

  /**
   * Register worker with Convex and check authorization status.
   * @returns Registration result with approval status
   */
  async register(): Promise<{
    status: 'pending_authorization' | 'ready';
    approved: boolean;
    workerId: string;
    name?: string;
  }> {
    try {
      const result = await this.client.mutation(api.workers.register, {
        machineId: this.config.machineId,
        workerId: this.config.workerId,
      });

      // If approved, start heartbeat
      if (result.approved) {
        this.startHeartbeat();
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
    await this.client.mutation(api.workers.heartbeat, {
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
      await this.client.mutation(api.workers.setOffline, {
        machineId: this.config.machineId,
        workerId: this.config.workerId,
      });
    } catch (error) {
      console.error(
        '❌ Failed to set offline status:',
        error instanceof Error ? error.message : String(error)
      );
    }

    // Note: ConvexHttpClient doesn't have a close method
    // The client will be garbage collected
  }
}
