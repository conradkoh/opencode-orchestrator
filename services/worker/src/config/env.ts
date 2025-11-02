import * as dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Environment variable schema definition.
 * This is the single source of truth for all required environment variables.
 */
const envSchema = z.object({
  /**
   * Worker authentication token with cryptographic secret.
   * Format: machine_<machine_id>:worker_<worker_id>:secret_<secret>
   * Example: machine_abc123:worker_xyz789:secret_def456ghi789
   */
  WORKER_TOKEN: z
    .string()
    .min(1, 'WORKER_TOKEN is required')
    .regex(
      /^machine_[a-zA-Z0-9_-]+:worker_[a-zA-Z0-9_-]+:secret_[a-zA-Z0-9_-]+$/,
      'WORKER_TOKEN must be in format: machine_<machine_id>:worker_<worker_id>:secret_<secret>'
    ),

  /**
   * Convex backend URL.
   * Must be a valid HTTPS URL.
   * Example: https://your-deployment.convex.cloud
   */
  CONVEX_URL: z
    .string()
    .min(1, 'CONVEX_URL is required')
    .url('CONVEX_URL must be a valid URL')
    .startsWith('https://', 'CONVEX_URL must use HTTPS'),
});

/**
 * Validated environment variables type.
 * Inferred from the Zod schema to ensure type safety.
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Parsed worker configuration derived from environment variables.
 */
export interface WorkerConfig {
  /** Machine ID extracted from worker token */
  machineId: string;
  /** Worker ID extracted from worker token */
  workerId: string;
  /** Cryptographic secret extracted from worker token */
  secret: string;
  /** Convex backend URL */
  convexUrl: string;
  /** Original worker token */
  workerToken: string;
}

/**
 * Singleton instance of validated environment variables.
 * Ensures environment is only parsed and validated once.
 */
let envInstance: Env | null = null;

/**
 * Load and validate environment variables.
 * This function should be called once at application startup.
 * Subsequent calls return the cached instance.
 *
 * @returns Validated environment variables
 * @throws Error if validation fails with detailed error messages
 *
 * @example
 * ```typescript
 * try {
 *   const env = loadEnv();
 *   console.log('Environment validated successfully');
 * } catch (error) {
 *   console.error('Environment validation failed:', error);
 *   process.exit(1);
 * }
 * ```
 */
export function loadEnv(): Env {
  // Return cached instance if already loaded
  if (envInstance) {
    return envInstance;
  }

  // Load .env file into process.env
  dotenv.config();

  try {
    // Validate environment variables against schema
    envInstance = envSchema.parse(process.env);
    return envInstance;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format validation errors for better readability
      const errorMessages = error.errors.map((err) => {
        const path = err.path.join('.');
        return `  ❌ ${path}: ${err.message}`;
      });

      throw new Error(
        `Environment validation failed:\n${errorMessages.join('\n')}\n\nPlease check your .env file and ensure all required variables are set correctly.`
      );
    }
    throw error;
  }
}

/**
 * Get validated environment variables.
 * Must be called after loadEnv() has been called at least once.
 *
 * @returns Validated environment variables
 * @throws Error if environment has not been loaded yet
 *
 * @example
 * ```typescript
 * const env = getEnv();
 * console.log('Convex URL:', env.CONVEX_URL);
 * ```
 */
export function getEnv(): Env {
  if (!envInstance) {
    throw new Error('Environment not loaded. Call loadEnv() first at application startup.');
  }
  return envInstance;
}

/**
 * Parse worker configuration from validated environment.
 * Extracts machine ID, worker ID, and secret from the worker token.
 *
 * @param env - Validated environment variables
 * @returns Parsed worker configuration
 *
 * @example
 * ```typescript
 * const env = loadEnv();
 * const config = parseWorkerConfig(env);
 * console.log(`Machine: ${config.machineId}, Worker: ${config.workerId}`);
 * ```
 */
export function parseWorkerConfig(env: Env): WorkerConfig {
  // Token format: machine_<machine_id>:worker_<worker_id>:secret_<secret>
  const [machinePart, workerPart, secretPart] = env.WORKER_TOKEN.split(':');

  const machineId = machinePart.replace('machine_', '');
  const workerId = workerPart.replace('worker_', '');
  const secret = secretPart.replace('secret_', '');

  return {
    machineId,
    workerId,
    secret,
    convexUrl: env.CONVEX_URL,
    workerToken: env.WORKER_TOKEN,
  };
}

/**
 * Check if environment variables are present (without validation).
 * Useful for determining if we need to prompt for configuration.
 *
 * @returns Object indicating which variables are missing
 *
 * @example
 * ```typescript
 * const missing = checkMissingEnvVars();
 * if (missing.WORKER_TOKEN) {
 *   console.log('Worker token is missing');
 * }
 * ```
 */
export function checkMissingEnvVars(): {
  WORKER_TOKEN: boolean;
  CONVEX_URL: boolean;
} {
  dotenv.config();

  return {
    WORKER_TOKEN: !process.env.WORKER_TOKEN,
    CONVEX_URL: !process.env.CONVEX_URL,
  };
}

/**
 * Reset the environment singleton.
 * Useful for testing purposes.
 * @internal
 */
export function resetEnv(): void {
  envInstance = null;
}
