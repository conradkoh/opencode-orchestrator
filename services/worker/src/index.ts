#!/usr/bin/env node

import { MachineServer } from '@presentation/MachineServer';
import { loadConfig, promptForToken, saveToken } from './config';

/**
 * Main entry point for the Assistant Worker Runtime.
 *
 * This CLI application manages:
 * - Machine registration and authentication
 * - Worker (assistant) lifecycle management
 * - OpenCode session orchestration
 * - Real-time communication with Convex backend
 *
 * Usage:
 *   pnpm start                    # Start with stored token (or prompt on first run)
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

Environment Variables:
  MACHINE_TOKEN         Machine token (format: <machine_id>:<machine_secret>)
  CONVEX_URL            Convex backend URL (optional, defaults to production)

First-Time Setup:
  On first run, you will be prompted to enter your machine token.
  Get your token from the web UI by creating a new machine.

Examples:
  # Start (will prompt for token on first run)
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

  // Load or prompt for machine token
  let config = await loadConfig();

  if (!config.machineToken) {
    console.log('No machine token found.');
    const token = await promptForToken();

    try {
      await saveToken(token);
      config = await loadConfig();
    } catch (error) {
      console.error(
        '❌ Invalid token format:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }

  if (!config.machineId || !config.machineSecret) {
    console.error('❌ Failed to parse machine token');
    process.exit(1);
  }

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
