import { Effect, Exit, Fiber } from 'effect';

import { Server } from './app/server';

/**
 * Main entry point for the OpenCode Worker.
 * Custom Bun-compatible runtime with SIGTERM/SIGINT handling.
 */

// Track if shutdown has been initiated
let shuttingDown = false;

// Create a custom runtime that handles signals properly
const program = Effect.gen(function* () {
  console.log('Starting OpenCode Worker...');

  // Get the current fiber
  const fiber = yield* Effect.fork(Server);

  // Setup signal handlers
  const handleShutdown = (signal: string) => {
    if (shuttingDown) {
      console.log('Already shutting down, ignoring signal');
      return;
    }
    shuttingDown = true;

    console.log(`\n=== Received ${signal} signal ===`);
    console.log('Beginning graceful shutdown...');

    // Interrupt the server fiber
    Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.sync(() => console.log('Interrupting server fiber...'));
        const exit = yield* Fiber.interrupt(fiber);
        yield* Effect.sync(() => console.log('Fiber interrupted'));
        yield* Effect.sync(() => console.log('Server shutdown complete'));
        yield* Effect.sync(() => process.exit(Exit.isSuccess(exit) ? 0 : 1));
      })
    ).catch((error) => {
      console.error('Error during shutdown:', error);
      process.exit(1);
    });
  };

  process.on('SIGTERM', () => {
    console.log('SIGTERM handler called');
    handleShutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    console.log('SIGINT handler called');
    handleShutdown('SIGINT');
  });

  console.log('Signal handlers registered');
  console.log('Process PID:', process.pid);

  // Wait for the server fiber to complete
  yield* Fiber.join(fiber);

  console.log('OpenCode Worker shutdown complete');
});

// Run the program
Effect.runPromise(program).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
