import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { checkMissingEnvVars, loadEnv, parseWorkerConfig, type WorkerConfig } from './env';

/**
 * Load worker configuration from environment.
 * If environment variables are missing, returns null to indicate setup is needed.
 *
 * @returns WorkerConfig if all variables are present and valid, null otherwise
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * if (!config) {
 *   console.log('Configuration needed');
 *   // Prompt for missing values
 * }
 * ```
 */
export async function loadConfig(): Promise<WorkerConfig | null> {
  try {
    const env = loadEnv();
    return parseWorkerConfig(env);
  } catch (error) {
    // Environment validation failed or variables missing
    return null;
  }
}

/**
 * Interactive setup for missing environment variables.
 * Prompts user for worker token and Convex URL if not present.
 *
 * @returns Promise that resolves when setup is complete
 *
 * @example
 * ```typescript
 * await interactiveSetup();
 * const config = await loadConfig();
 * ```
 */
export async function interactiveSetup(): Promise<void> {
  console.log('🚀 Worker Setup\n');

  const missing = checkMissingEnvVars();

  let workerToken = process.env.WORKER_TOKEN || '';
  let convexUrl = process.env.CONVEX_URL || '';

  // Prompt for worker token if missing
  if (missing.WORKER_TOKEN) {
    console.log('📋 Worker Token Setup');
    console.log('   To get your worker token:');
    console.log('   1. Go to the web UI');
    console.log('   2. Select your machine');
    console.log('   3. Click the menu (⋮) next to the machine');
    console.log('   4. Select "Add Worker"');
    console.log('   5. Copy the token shown\n');

    workerToken = await promptForInput('Enter worker token: ');

    // Validate token format
    if (!workerToken.match(/^machine_[a-zA-Z0-9_-]+:worker_[a-zA-Z0-9_-]+$/)) {
      throw new Error(
        'Invalid worker token format. Expected: machine_<machine_id>:worker_<worker_id>'
      );
    }
  }

  // Prompt for Convex URL if missing
  if (missing.CONVEX_URL) {
    console.log('\n📡 Convex Backend URL');
    console.log('   Get this from your Convex dashboard');
    console.log('   Example: https://your-deployment.convex.cloud\n');

    convexUrl = await promptForInput('Enter Convex URL: ');

    // Validate URL format
    if (!convexUrl.startsWith('https://')) {
      throw new Error('Convex URL must start with https://');
    }
  }

  // Save to .env file
  await saveEnvFile(workerToken, convexUrl);

  console.log('\n✅ Configuration saved to .env');
  console.log('   You can now start the worker\n');
}

/**
 * Prompt user for input via stdin.
 *
 * @param prompt - Prompt message to display
 * @returns Promise resolving to user input
 */
async function promptForInput(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Save environment variables to .env file.
 *
 * @param workerToken - Worker authentication token
 * @param convexUrl - Convex backend URL
 */
async function saveEnvFile(workerToken: string, convexUrl: string): Promise<void> {
  const envPath = path.join(process.cwd(), '.env');

  const envContent = `# Worker authentication token
# Format: machine_<machine_id>:worker_<worker_id>
# Get this from the web UI by selecting your machine and clicking "Add Worker"
WORKER_TOKEN=${workerToken}

# Convex backend URL
# Get this from your Convex dashboard
CONVEX_URL=${convexUrl}
`;

  await fs.writeFile(envPath, envContent, 'utf-8');
}

// Re-export types and functions from env module
export { getEnv, loadEnv, parseWorkerConfig, type WorkerConfig } from './env';
