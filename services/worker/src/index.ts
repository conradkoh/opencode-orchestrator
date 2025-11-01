#!/usr/bin/env node

import { MachineServer } from '@presentation/MachineServer';
import { interactiveSetup, loadConfig, loadEnv } from './config';

/**
 * Main entry point for the Assistant Worker Runtime.
 *
 * This CLI application manages:
 * - Worker registration and authorization
 * - OpenCode session orchestration
 * - Real-time communication with Convex backend
 *
 * Usage:
 *   pnpm start                    # Start with stored config (or prompt on first run)
 *   pnpm start --help             # Show help
 */

/**
 * Parses command line arguments.
 */
function _parseArgs(): { help: boolean } {
  const args = process.argv.slice(2);
  const result: { help: boolean } = { help: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    }
  }

  return result;
}

/**
 * Displays help information.
 */
function _showHelp(): void {
  console.log(`
Assistant Worker Runtime - OpenCode Orchestrator

Usage:
  pnpm start [options]

Options:
  --help, -h             Show this help message

Environment Variables (required):
  WORKER_TOKEN          Worker authentication token
                        Format: machine_<machine_id>:worker_<worker_id>
                        Get this from the web UI by selecting your machine
                        and clicking "Add Worker" in the action menu

  CONVEX_URL            Convex backend URL
                        Example: https://your-deployment.convex.cloud
                        Get this from your Convex dashboard

First-Time Setup:
  On first run, you will be prompted to enter your worker token and
  Convex URL. These will be saved to a .env file for future runs.

Examples:
  # Start (will prompt for config on first run)
  pnpm start

  # Show help
  pnpm start --help

For more information, visit:
  https://github.com/your-org/opencode-orchestrator
  `);
}

/**
 * Main application function.
 */
async function main(): Promise<void> {
  const args = _parseArgs();

  if (args.help) {
    _showHelp();
    process.exit(0);
  }

  console.log('🚀 Starting Opencode Worker...\n');

  // Try to load configuration
  let config = await loadConfig();

  // If config is missing or invalid, run interactive setup
  if (!config) {
    try {
      await interactiveSetup();
      // Reload environment after setup
      loadEnv();
      config = await loadConfig();
    } catch (error) {
      console.error('\n❌ Setup failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  // Validate config was loaded successfully
  if (!config) {
    console.error('❌ Failed to load configuration after setup');
    process.exit(1);
  }

  console.log(`📍 Machine ID: ${config.machineId}`);
  console.log(`🔧 Worker ID: ${config.workerId}`);
  console.log(`🌐 Convex URL: ${config.convexUrl}\n`);

  const server = new MachineServer();

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\n\n👋 Shutting down gracefully...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    // Start the server with parsed config
    await server.start(config);

    console.log('\n✅ Worker is running and connected to Convex');
    console.log('Press Ctrl+C to stop\n');

    // Keep the process alive
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
}

// Run the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
