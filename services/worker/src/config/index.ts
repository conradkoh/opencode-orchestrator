import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline';
import * as dotenv from 'dotenv';

/**
 * Worker configuration loaded from environment variables.
 */
export interface WorkerConfig {
  /** Combined machine token (format: <machine_id>:<machine_secret>) */
  machineToken: string | null;
  /** Machine ID extracted from token */
  machineId: string | null;
  /** Machine secret extracted from token */
  machineSecret: string | null;
}

/**
 * Load configuration from .env file.
 * Parses MACHINE_TOKEN into machineId and machineSecret.
 *
 * @returns WorkerConfig with parsed values
 * @example
 * ```typescript
 * const config = await loadConfig();
 * if (config.machineToken) {
 *   console.log(`Machine ID: ${config.machineId}`);
 * }
 * ```
 */
export async function loadConfig(): Promise<WorkerConfig> {
  // Load .env file
  dotenv.config();

  const machineToken = process.env.MACHINE_TOKEN || null;

  if (!machineToken) {
    return {
      machineToken: null,
      machineId: null,
      machineSecret: null,
    };
  }

  try {
    const [machineId, machineSecret] = parseToken(machineToken);

    return {
      machineToken,
      machineId,
      machineSecret,
    };
  } catch (error) {
    console.error(
      '❌ Error parsing machine token:',
      error instanceof Error ? error.message : String(error)
    );
    return {
      machineToken: null,
      machineId: null,
      machineSecret: null,
    };
  }
}

/**
 * Prompt user for machine token via stdin.
 * Displays instructions and waits for user input.
 *
 * @returns Promise resolving to the entered token
 * @example
 * ```typescript
 * const token = await promptForToken();
 * await saveToken(token);
 * ```
 */
export async function promptForToken(): Promise<string> {
  console.log('📋 To get your machine token:');
  console.log('   1. Go to the web UI');
  console.log('   2. Create a new machine');
  console.log('   3. Copy the token shown\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter machine token: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Save machine token to .env file.
 * Creates or overwrites the .env file with the token.
 *
 * @param token - Machine token to save
 * @throws Error if file write fails
 * @example
 * ```typescript
 * await saveToken('abc123:def456');
 * console.log('Token saved!');
 * ```
 */
export async function saveToken(token: string): Promise<void> {
  // Validate token format before saving
  parseToken(token); // Will throw if invalid

  const envPath = path.join(process.cwd(), '.env');
  const envContent = `# Machine authentication token\n# Format: <machine_id>:<machine_secret>\nMACHINE_TOKEN=${token}\n`;

  await fs.writeFile(envPath, envContent, 'utf-8');
  console.log('✅ Machine token saved to .env\n');
}

/**
 * Parse machine token into machineId and machineSecret.
 * Validates the token format.
 *
 * @param token - Token to parse (format: <machine_id>:<machine_secret>)
 * @returns Tuple of [machineId, machineSecret]
 * @throws Error if token format is invalid
 * @example
 * ```typescript
 * const [id, secret] = parseToken('abc123:def456');
 * console.log(`ID: ${id}, Secret: ${secret}`);
 * ```
 */
function parseToken(token: string): [string, string] {
  const parts = token.split(':');

  if (parts.length !== 2) {
    throw new Error('Invalid token format. Expected: <machine_id>:<machine_secret>');
  }

  const [machineId, machineSecret] = parts;

  if (!machineId || !machineSecret) {
    throw new Error('Invalid token: machine ID and secret cannot be empty');
  }

  return [machineId, machineSecret];
}
