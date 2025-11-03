import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import type { OrchestratorConfig, WorkerConfig, WorkerConfigEntry, WorkersConfig } from './types';

/**
 * Configuration directory name in user's home directory.
 */
const CONFIG_DIR_NAME = '.config/opencode-orchestrator';

/**
 * Workers configuration file name.
 */
const WORKERS_JSON_FILENAME = 'workers.json';

/**
 * Validation schema for worker config entry.
 */
const workerConfigEntrySchema = z.object({
  token: z
    .string()
    .min(1, 'Worker token is required')
    .regex(
      /^machine_[a-zA-Z0-9_-]+:worker_[a-zA-Z0-9_-]+:secret_[a-zA-Z0-9_-]+$/,
      'Worker token must be in format: machine_<machine_id>:worker_<worker_id>:secret_<secret>'
    ),
  working_directory: z
    .string()
    .min(1, 'Working directory is required')
    .describe("Absolute or relative path to the worker's working directory. Supports ~ expansion."),
  convex_url: z
    .string()
    .min(1, 'Convex URL is required')
    .url('Convex URL must be a valid URL')
    .startsWith('https://', 'Convex URL must use HTTPS'),
});

/**
 * Validation schema for workers.json file.
 */
const workersConfigSchema = z.object({
  workers: z.array(workerConfigEntrySchema).min(1, 'At least one worker configuration is required'),
});

/**
 * Get the configuration directory path.
 * Returns ~/.config/opencode-orchestrator
 */
export function getConfigDir(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, CONFIG_DIR_NAME);
}

/**
 * Get the workers.json file path.
 */
export function getWorkersJsonPath(): string {
  return path.join(getConfigDir(), WORKERS_JSON_FILENAME);
}

/**
 * Expand tilde (~) in paths to user home directory.
 * Also resolves relative paths to absolute paths.
 *
 * @param filepath - Path that may contain ~
 * @returns Absolute path with ~ expanded
 *
 * @example
 * ```typescript
 * expandPath('~/Documents/project') // => '/Users/username/Documents/project'
 * expandPath('./project')           // => '/current/dir/project'
 * ```
 */
export function expandPath(filepath: string): string {
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2));
  }
  return path.resolve(filepath);
}

/**
 * Create a template workers.json file with instructions.
 *
 * @param filepath - Path to create the template file
 */
async function createTemplateWorkersJson(filepath: string): Promise<void> {
  const template: WorkersConfig = {
    workers: [
      {
        token: 'machine_abc123:worker_xyz789:secret_def456ghi789jkl012',
        working_directory: '~/Documents/Projects/my-project',
        convex_url: 'https://your-deployment.convex.cloud',
      },
    ],
  };

  const content = JSON.stringify(template, null, 2);
  await fs.writeFile(filepath, content, 'utf-8');
}

/**
 * Ensure configuration directory exists.
 * Creates it if missing.
 *
 * @returns Path to configuration directory
 */
async function ensureConfigDir(): Promise<string> {
  const configDir = getConfigDir();

  try {
    await fs.access(configDir);
  } catch {
    // Directory doesn't exist, create it
    await fs.mkdir(configDir, { recursive: true });
  }

  return configDir;
}

/**
 * Strip comments from JSON content to support JSONC format.
 * Removes both single-line (//) and multi-line (/* *\/) comments.
 *
 * @param content - JSON content that may contain comments
 * @returns JSON content with comments removed
 */
function stripJsonComments(content: string): string {
  // Remove multi-line comments /* ... */
  let result = content.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove single-line comments // ...
  // But preserve URLs (http://, https://)
  result = result.replace(/(?<!:)\/\/.*$/gm, '');

  return result;
}

/**
 * Load and validate workers configuration from workers.json.
 * Creates a template file if it doesn't exist.
 * Supports JSONC format (JSON with comments).
 *
 * @returns Validated workers configuration
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * const config = await loadWorkersJson();
 * for (const worker of config.workers) {
 *   console.log(`Worker: ${worker.token}`);
 * }
 * ```
 */
export async function loadWorkersJson(): Promise<WorkersConfig> {
  const configDir = await ensureConfigDir();
  const workersJsonPath = path.join(configDir, WORKERS_JSON_FILENAME);

  // Check if workers.json exists
  try {
    await fs.access(workersJsonPath);
  } catch {
    // File doesn't exist, create template
    console.log(`📝 Creating template configuration at: ${workersJsonPath}`);
    await createTemplateWorkersJson(workersJsonPath);

    throw new Error(
      `\nNo workers configuration found. A template has been created at:\n${workersJsonPath}\n\nPlease edit this file and add your worker configurations, then run the command again.`
    );
  }

  // Read and parse the file
  const content = await fs.readFile(workersJsonPath, 'utf-8');

  try {
    // Strip comments to support JSONC format
    const strippedContent = stripJsonComments(content);
    const json = JSON.parse(strippedContent);
    const validated = workersConfigSchema.parse(json);
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => {
        const path = err.path.join('.');
        return `  ❌ ${path}: ${err.message}`;
      });

      throw new Error(
        `Workers configuration validation failed:\n${errorMessages.join('\n')}\n\nPlease check your workers.json file at:\n${workersJsonPath}`
      );
    }

    if (error instanceof SyntaxError) {
      throw new Error(
        `Invalid JSON in workers.json:\n${error.message}\n\nFile location:\n${workersJsonPath}\n\nNote: Comments are supported using // or /* */`
      );
    }

    throw error;
  }
}

/**
 * Parse a worker config entry into a WorkerConfig.
 * Extracts machine ID, worker ID, and secret from token.
 * Expands working directory path.
 *
 * @param entry - Worker configuration entry from JSON
 * @returns Parsed worker configuration
 *
 * @example
 * ```typescript
 * const entry = {
 *   token: 'machine_abc:worker_xyz:secret_123',
 *   working_directory: '~/project',
 *   convex_url: 'https://example.convex.cloud'
 * };
 * const config = parseWorkerConfigEntry(entry);
 * console.log(config.workingDirectory); // => '/Users/username/project'
 * ```
 */
export function parseWorkerConfigEntry(entry: WorkerConfigEntry): WorkerConfig {
  // Parse token: machine_<machine_id>:worker_<worker_id>:secret_<secret>
  const [machinePart, workerPart, secretPart] = entry.token.split(':');

  const machineId = machinePart.replace('machine_', '');
  const workerId = workerPart.replace('worker_', '');
  const secret = secretPart.replace('secret_', '');

  // Expand working directory path
  const workingDirectory = expandPath(entry.working_directory);

  return {
    machineId,
    workerId,
    secret,
    convexUrl: entry.convex_url,
    workerToken: entry.token,
    workingDirectory,
  };
}

/**
 * Load orchestrator configuration for production mode.
 * Loads workers.json and parses all worker configurations.
 *
 * @returns Complete orchestrator configuration
 * @throws Error if workers.json doesn't exist or is invalid
 *
 * @example
 * ```typescript
 * try {
 *   const config = await loadOrchestratorConfig();
 *   console.log(`Loaded ${config.workers.length} worker configurations`);
 *   for (const worker of config.workers) {
 *     console.log(`  - Worker ${worker.workerId} in ${worker.workingDirectory}`);
 *   }
 * } catch (error) {
 *   console.error('Failed to load config:', error.message);
 * }
 * ```
 */
export async function loadOrchestratorConfig(): Promise<OrchestratorConfig> {
  const configDir = await ensureConfigDir();
  const workersJsonPath = getWorkersJsonPath();

  // Load and validate workers.json
  const workersConfig = await loadWorkersJson();

  // Parse all worker configurations
  const workers = workersConfig.workers.map((entry) => parseWorkerConfigEntry(entry));

  return {
    configDir,
    workersJsonPath,
    workers,
  };
}

/**
 * Check if orchestrator configuration exists.
 * Returns true if workers.json file exists.
 */
export async function hasOrchestratorConfig(): Promise<boolean> {
  try {
    const workersJsonPath = getWorkersJsonPath();
    await fs.access(workersJsonPath);
    return true;
  } catch {
    return false;
  }
}
