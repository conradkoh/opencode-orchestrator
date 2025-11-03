/**
 * Shared configuration types for worker orchestration.
 *
 * This module defines the core configuration structures used across
 * both development mode (single worker from .env) and production mode
 * (multiple workers from workers.json).
 */

/**
 * Parsed worker configuration.
 * Contains all information needed to start a worker instance.
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
  /** Working directory for this worker */
  workingDirectory: string;
}

/**
 * Single worker configuration entry from workers.json.
 * This is the JSON structure users write in the config file.
 */
export interface WorkerConfigEntry {
  /** Worker authentication token in format: machine_<id>:worker_<id>:secret_<secret> */
  token: string;
  /** Working directory path (supports ~ expansion) */
  working_directory: string;
  /** Convex backend URL (must be HTTPS) */
  convex_url: string;
}

/**
 * Complete workers.json structure.
 * Contains an array of worker configurations.
 */
export interface WorkersConfig {
  /** Array of worker configurations */
  workers: WorkerConfigEntry[];
}

/**
 * Orchestrator configuration for production mode.
 * Contains parsed worker configs and file paths.
 */
export interface OrchestratorConfig {
  /** Path to configuration directory (~/.config/opencode-orchestrator) */
  configDir: string;
  /** Path to workers.json file */
  workersJsonPath: string;
  /** Parsed worker configurations ready to use */
  workers: WorkerConfig[];
}
