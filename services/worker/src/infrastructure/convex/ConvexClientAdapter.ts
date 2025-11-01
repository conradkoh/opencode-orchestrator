import { api } from '@workspace/backend/convex/_generated/api';
import { ConvexHttpClient } from 'convex/browser';
import type { WorkerConfig } from '../../config';

/**
 * Adapter for Convex backend communication.
 * Handles authentication, heartbeat, and status updates.
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
   * @param config - Worker configuration with machine credentials
   */
  constructor(convexUrl: string, config: WorkerConfig) {
    this.client = new ConvexHttpClient(convexUrl);
    this.config = config;
  }

  /**
   * Authenticate with Convex and update machine status to online.
   * Starts periodic heartbeat to maintain online status.
   *
   * @returns Machine details from Convex
   * @throws Error if authentication fails
   */
  async authenticate(): Promise<{ machineId: string; name: string }> {
    if (!this.config.machineId || !this.config.machineSecret) {
      throw new Error('Machine ID and secret are required');
    }

    try {
      const result = await this.client.mutation(api.machines.authenticate, {
        machineId: this.config.machineId,
        secret: this.config.machineSecret,
      });

      // Start heartbeat
      this.startHeartbeat();

      return {
        machineId: result.machineId,
        name: result.name,
      };
    } catch (error) {
      throw new Error(
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`
      );
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
    if (!this.config.machineId || !this.config.machineSecret) {
      return;
    }

    await this.client.mutation(api.machines.heartbeat, {
      machineId: this.config.machineId,
      secret: this.config.machineSecret,
    });
  }

  /**
   * Stop heartbeat and update machine status to offline.
   * Called during graceful shutdown.
   */
  async disconnect(): Promise<void> {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Update status to offline
    if (this.config.machineId && this.config.machineSecret) {
      try {
        await this.client.mutation(api.machines.setOffline, {
          machineId: this.config.machineId,
          secret: this.config.machineSecret,
        });
      } catch (error) {
        console.error(
          '❌ Failed to set offline status:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Note: ConvexHttpClient doesn't have a close method
    // The client will be garbage collected
  }
}
