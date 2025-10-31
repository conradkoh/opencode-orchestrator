#!/usr/bin/env node

import { MachineServer } from '@presentation/MachineServer';

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
 *   pnpm start                    # Start with stored token
 *   pnpm start --token <token>    # Start with explicit token
 *   pnpm start --help             # Show help
 */

/**
 * Parses command line arguments.
 */
function _parseArgs(): { token?: string; help: boolean } {
  const args = process.argv.slice(2);
  const result: { token?: string; help: boolean } = { help: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--token' || arg === '-t') {
      result.token = args[++i];
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
  --token, -t <token>    Machine token in format <machine_id>:<machine_secret>
  --help, -h             Show this help message

Environment Variables:
  CONVEX_URL            Convex backend URL (required)
  MACHINE_TOKEN         Machine token (alternative to --token)
  ROOT_DIRECTORY        Root directory for worker operations
  IDLE_TIMEOUT          Session idle timeout in ms (default: 300000)

Examples:
  # Start with stored token
  pnpm start

  # Start with explicit token
  pnpm start --token mch_abc123:sec_xyz789

  # First-time setup (will prompt for token)
  pnpm start

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

  console.log('🚀 Assistant Worker Runtime');
  console.log('============================\n');

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
    // Start the server with token from args or environment
    await server.start({
      token: args.token || process.env.MACHINE_TOKEN,
      rootDirectory: process.env.ROOT_DIRECTORY,
    });

    console.log('\n✅ Machine server is running');
    console.log('Press Ctrl+C to stop\n');

    // Keep the process alive
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Failed to start machine server:', error);
    process.exit(1);
  }
}

// Run the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
