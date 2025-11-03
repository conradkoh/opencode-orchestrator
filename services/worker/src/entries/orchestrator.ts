#!/usr/bin/env node

import type { OrchestratorConfig } from '../config';
import { loadOrchestratorConfig } from '../config';
import { OrchestratorManager } from '../orchestrator/OrchestratorManager';

/**
 * Main entry point for the OpenCode Orchestrator.
 *
 * This runs multiple workers from ~/.config/opencode-orchestrator/workers.json
 *
 * Usage:
 *   pnpm run opencode-orchestrator
 */

/**
 * Parse command line arguments.
 */
function parseArgs(): { help: boolean } {
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
 * Display help information.
 */
function showHelp(): void {
  console.log(`
OpenCode Orchestrator - Multi-Worker Manager

Usage:
  pnpm run opencode-orchestrator [options]

Options:
  --help, -h             Show this help message

Configuration:
  Workers are configured in: ~/.config/opencode-orchestrator/workers.json
  
  Example configuration:
  {
    "workers": [
      {
        "token": "machine_abc123:worker_xyz789:secret_def456ghi789jkl012",
        "working_directory": "~/Documents/Projects/my-project",
        "convex_url": "https://your-deployment.convex.cloud"
      }
    ]
  }

First-Time Setup:
  On first run, a template configuration file will be created.
  Edit the file to add your worker configurations, then run again.

For more information, visit:
  https://github.com/your-org/opencode-orchestrator
  `);
}

/**
 * Main application function.
 */
async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  console.log('🚀 OpenCode Orchestrator\n');

  // Load orchestrator configuration
  let config: OrchestratorConfig;
  try {
    config = await loadOrchestratorConfig();
  } catch (error) {
    console.error('❌ Failed to load configuration:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log(`📋 Loaded ${config.workers.length} worker configuration(s)\n`);

  // Create orchestrator manager
  const manager = new OrchestratorManager(config.workers);

  // Track if shutdown is already in progress
  let isShuttingDown = false;

  // Handle graceful shutdown with timeout
  const shutdown = async (signal: string) => {
    // Prevent multiple shutdown attempts
    if (isShuttingDown) {
      console.log(`\n⚠️  Shutdown already in progress, ignoring ${signal}`);
      return;
    }
    isShuttingDown = true;

    console.log(`\n\n👋 Received ${signal}, shutting down gracefully...`);

    // Set a timeout to force exit if graceful shutdown takes too long
    const forceExitTimeout = setTimeout(() => {
      console.error('\n⚠️  Graceful shutdown timed out after 30 seconds, forcing exit...');
      process.exit(1);
    }, 30000); // 30 second timeout for multiple workers

    try {
      await manager.stopAll();
      clearTimeout(forceExitTimeout);
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimeout);
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle various termination signals
  process.on('SIGINT', () => shutdown('SIGINT')); // Ctrl+C
  process.on('SIGTERM', () => shutdown('SIGTERM')); // Kill command
  process.on('SIGQUIT', () => shutdown('SIGQUIT')); // Quit signal
  process.on('SIGHUP', () => shutdown('SIGHUP')); // Terminal closed

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('\n💥 Uncaught exception:', error);
    shutdown('uncaughtException').catch(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('\n💥 Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection').catch(() => process.exit(1));
  });

  try {
    // Start all workers
    await manager.startAll();

    console.log('\n✅ Orchestrator is running');
    console.log('Press Ctrl+C to stop all workers\n');

    // Keep the process alive
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Failed to start orchestrator:', error);
    process.exit(1);
  }
}

// Run the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
