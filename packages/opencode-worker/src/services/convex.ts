import { ConvexClient } from 'convex/browser';
import { Effect, Queue } from 'effect';

import type { EnvConfig } from '../config/env';

export interface ConvexEvent {
  readonly type: string;
  readonly data: unknown;
}

/**
 * Creates a Convex client that subscribes to the worker event stream.
 * Returns an Effect that manages the client lifecycle and provides a queue of events.
 */
export const createConvexService = (config: EnvConfig) =>
  Effect.gen(function* () {
    console.log('Initializing Convex client...');
    const client = new ConvexClient(config.CONVEX_URL);

    // Create a queue for events from Convex
    const eventQueue = yield* Queue.unbounded<ConvexEvent>();

    console.log('Subscribing to worker event stream...');

    // Subscribe to the worker event stream
    // Note: We'll need to import the API types once they're generated
    const unsubscribe = client.onUpdate(
      'workerEvents:workerEventStream' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      {},
      async (events: any[]) => {
        console.log(`Received ${events.length} events from Convex`);
        for (const event of events) {
          await Effect.runPromise(
            Queue.offer(eventQueue, {
              type: 'convex_event',
              data: event,
            })
          );
        }
      }
    );

    // Add cleanup handler
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        console.log('Cleaning up Convex client...');
        unsubscribe();
        yield* Effect.promise(() => client.close());
        console.log('Convex client closed');
      })
    );

    console.log('Convex client ready');

    return {
      client,
      eventQueue,
    };
  }).pipe(Effect.scoped);
