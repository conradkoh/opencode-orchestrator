import type { WorkerConfig } from '../../config';
import type { ConvexClientAdapter } from '../../infrastructure/convex/ConvexClientAdapter';
import type { IRegistrationHandler, RegistrationResult } from './types';

/**
 * Handles worker registration with Convex backend.
 */
export class RegistrationHandler implements IRegistrationHandler {
  /**
   * Handle worker registration.
   * @param convexClient - Convex client adapter
   * @param _config - Worker configuration (unused, for interface compatibility)
   * @returns Registration result with approval status
   */
  async handle(
    convexClient: ConvexClientAdapter,
    _config: WorkerConfig
  ): Promise<RegistrationResult> {
    console.log('🔐 Registering worker with Convex...');

    try {
      const result = await convexClient.register();

      if (result.approved) {
        console.log('✅ Worker already approved\n');
      } else {
        console.log('⏳ Worker pending approval\n');
      }

      console.log(`Worker ID: ${result.workerId}`);
      if (result.name) {
        console.log(`Worker Name: ${result.name}`);
      }

      return {
        approved: result.approved,
        workerId: result.workerId,
        name: result.name,
      };
    } catch (error) {
      throw new Error(
        `Failed to register worker: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
