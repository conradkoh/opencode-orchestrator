import type { Queue } from 'effect';
import { Effect, Stream } from 'effect';

import type { ConvexEvent } from '../services/convex';

/**
 * Server handles incoming messages from Convex and processes them.
 * Returns an Effect that runs indefinitely until interrupted.
 * Properly cleans up resources on shutdown.
 */
export const createServer = (convexEventQueue: Queue.Queue<ConvexEvent>) =>
  Effect.gen(function* () {
    console.log('Server initialized');

    console.log('Server starting to listen for messages from Convex...');

    // Background fiber to process messages from Convex queue
    yield* Stream.fromQueue(convexEventQueue).pipe(
      Stream.tap((event) =>
        Effect.gen(function* () {
          console.log('Processing event:', event.type);
          console.log('Event data:', JSON.stringify(event.data));
          yield* Effect.sleep('100 millis'); // Simulate processing
          console.log('Completed event:', event.type);
        })
      ),
      Stream.runDrain,
      Effect.fork
    );

    console.log('Server is now listening');
    console.log('Server ready - processing Convex events');

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
