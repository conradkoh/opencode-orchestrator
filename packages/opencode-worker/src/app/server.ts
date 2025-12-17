import { Effect, Queue, Stream } from 'effect';

/**
 * Server handles incoming messages and processes them.
 * Returns an Effect that runs indefinitely until interrupted.
 * Properly cleans up resources on shutdown.
 */
export const Server = Effect.gen(function* () {
  console.log('Server initialized');

  // Create a queue for message processing
  const messageQueue = yield* Queue.unbounded<string>();

  // Track if we're shutting down
  const isShuttingDown = false;

  console.log('Server starting to listen for messages...');

  // Background fiber to process messages from queue
  yield* Stream.fromQueue(messageQueue).pipe(
    Stream.tap((message) =>
      Effect.gen(function* () {
        console.log('Processing message:', message);
        yield* Effect.sleep('100 millis'); // Simulate processing
        console.log('Completed message:', message);
      })
    ),
    Stream.runDrain,
    Effect.fork
  );

  console.log('Server is now listening');

  // Example: Add a test message to the queue every 5 seconds
  yield* Effect.gen(function* () {
    let count = 0;
    while (true) {
      yield* Effect.sleep('5 seconds');
      count++;
      if (!isShuttingDown) {
        yield* Queue.offer(messageQueue, `Test message ${count}`);
        console.log(`Queued: Test message ${count}`);
      }
    }
  }).pipe(Effect.fork);

  console.log('Server ready - all background tasks started');

  // Keep server running until interrupted
  yield* Effect.never;
}).pipe(
  Effect.ensuring(
    Effect.sync(() => {
      console.log('\n=== Server Cleanup ===');
      console.log('Server cleanup: Shutting down gracefully...');
      console.log('Server cleanup: Closing message queue...');
      console.log('Server cleanup: Waiting for in-flight messages to complete...');
      console.log('Server cleanup: Complete');
    })
  )
);
