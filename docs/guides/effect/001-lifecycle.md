# Lifecycle Management with Effect-TS

This guide covers application lifecycle management, graceful shutdown handling, and signal processing using Effect-TS.

## Table of Contents

- [Overview](#overview)
- [Key Concepts](#key-concepts)
- [Running Long-Lived Applications](#running-long-lived-applications)
- [Graceful Shutdown Patterns](#graceful-shutdown-patterns)
- [Resource Cleanup](#resource-cleanup)
- [Working with Bun Runtime](#working-with-bun-runtime)
- [Complete Example](#complete-example)
- [Best Practices](#best-practices)

---

## Overview

Effect-TS provides powerful primitives for managing application lifecycle, including:
- Automatic resource cleanup on interruption
- Signal handling (SIGTERM/SIGINT)
- Graceful shutdown of background tasks
- Scoped resource management

**Key Learning**: All finalizers (`Effect.ensuring`, `Effect.addFinalizer`) run on interruption, making it safe to use Effect patterns with SIGTERM/SIGINT signal handlers.

---

## Key Concepts

### Effect.never

Blocks an Effect indefinitely until it's interrupted. Useful for keeping long-running applications alive.

```typescript
import { Effect } from "effect";

const program = Effect.gen(function* () {
  yield* Effect.log("Starting...");
  
  // Start background tasks
  yield* backgroundWorker.pipe(Effect.fork);
  
  // Keep running until interrupted
  yield* Effect.never;
});
```

### Effect.ensuring

Guarantees cleanup code runs, even on interruption or failure.

```typescript
const program = Effect.gen(function* () {
  yield* doWork;
}).pipe(
  Effect.ensuring(
    Effect.sync(() => {
      console.log("Cleanup always runs");
    })
  )
);
```

### Effect.addFinalizer

Adds cleanup logic within a scoped context. Receives the Exit value to distinguish success/failure/interruption.

```typescript
const program = Effect.gen(function* () {
  yield* Effect.addFinalizer((exit) =>
    Effect.sync(() => {
      if (Exit.isInterrupted(exit)) {
        console.log("Interrupted - cleanup");
      }
    })
  );
  
  yield* Effect.never;
}).pipe(Effect.scoped);
```

### Effect.fork

Runs an Effect in a background fiber that's supervised by the parent scope.

```typescript
const program = Effect.gen(function* () {
  // Background task
  const fiber = yield* longRunningTask.pipe(Effect.fork);
  
  // Do other work
  yield* otherWork;
  
  // Wait for background task
  yield* Fiber.join(fiber);
});
```

### Fiber.interrupt

Gracefully interrupts a fiber, triggering all its cleanup handlers.

```typescript
const fiber = yield* Effect.fork(longRunningTask);

// Later...
yield* Fiber.interrupt(fiber); // Cleanup handlers run
```

---

## Running Long-Lived Applications

### Pattern 1: NodeRuntime.runMain (Node.js Only)

**Recommended for Node.js applications**. Provides automatic SIGTERM/SIGINT handling.

```typescript
import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  console.log("Starting server...");
  
  yield* startServer;
  
  // Keeps running until signal received
  yield* Effect.never;
}).pipe(
  Effect.ensuring(
    Effect.sync(() => console.log("Shutdown complete"))
  )
);

// Handles SIGTERM/SIGINT automatically
NodeRuntime.runMain(program);
```

**How it works internally:**
- Sets up a keep-alive interval to prevent process exit
- Registers SIGTERM/SIGINT handlers
- Calls `fiber.unsafeInterruptAsFork()` on signal
- Triggers all cleanup handlers
- Exits with appropriate code

### Pattern 2: Manual Signal Handling (Bun Compatible)

**Required for Bun or custom runtimes** that don't support `@effect/platform-node`.

```typescript
import { Effect, Exit, Fiber } from "effect";

const program = Effect.gen(function* () {
  console.log("Starting server...");
  
  // Fork the server as a background fiber
  const serverFiber = yield* Server.pipe(Effect.fork);
  
  // Setup signal handlers
  const handleShutdown = (signal: string) => {
    console.log(`Received ${signal} - shutting down`);
    
    Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Fiber.interrupt(serverFiber);
        process.exit(Exit.isSuccess(exit) ? 0 : 1);
      })
    );
  };
  
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
  
  // Wait for server to complete
  yield* Fiber.join(serverFiber);
});

Effect.runPromise(program);
```

---

## Graceful Shutdown Patterns

### Server with Background Tasks

```typescript
import { Effect, Queue, Stream } from "effect";

export const Server = Effect.gen(function* () {
  console.log("Server initialized");
  
  const messageQueue = yield* Queue.unbounded<string>();
  
  // Background message processor
  yield* Stream.fromQueue(messageQueue).pipe(
    Stream.tap((message) =>
      Effect.gen(function* () {
        console.log("Processing:", message);
        yield* Effect.sleep("100 millis");
      })
    ),
    Stream.runDrain,
    Effect.fork
  );
  
  // Background message producer
  yield* Effect.gen(function* () {
    let count = 0;
    while (true) {
      yield* Effect.sleep("5 seconds");
      yield* Queue.offer(messageQueue, `Message ${++count}`);
    }
  }).pipe(Effect.fork);
  
  console.log("Server ready");
  
  // Keep running until interrupted
  yield* Effect.never;
}).pipe(
  Effect.ensuring(
    Effect.sync(() => {
      console.log("=== Server Cleanup ===");
      console.log("Closing queue...");
      console.log("Waiting for in-flight messages...");
      console.log("Cleanup complete");
    })
  )
);
```

### Database Connection with Cleanup

```typescript
import { Effect, Scope } from "effect";

const makeConnection = Effect.gen(function* () {
  const db = yield* Effect.sync(() => createDatabase());
  
  // Register cleanup
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      console.log("Closing database connection");
      db.close();
    })
  );
  
  return db;
}).pipe(Effect.scoped);

// Usage
const program = Effect.gen(function* () {
  const db = yield* makeConnection;
  
  // Use database
  yield* Effect.gen(function* () {
    while (true) {
      yield* Effect.sync(() => db.query("SELECT 1"));
      yield* Effect.sleep("1 second");
    }
  });
});
// Database automatically closes on interruption
```

---

## Resource Cleanup

### Using acquireUseRelease

The `acquireUseRelease` pattern ensures resources are always cleaned up:
- **Acquire** is uninterruptible
- **Use** is interruptible
- **Release** always runs

```typescript
const program = Effect.acquireUseRelease(
  // Acquire (uninterruptible)
  Effect.sync(() => {
    console.log("Opening file");
    return fs.openSync("data.txt", "w");
  }),
  // Use (interruptible)
  (fd) =>
    Effect.gen(function* () {
      while (true) {
        yield* Effect.sync(() => fs.writeSync(fd, "data\n"));
        yield* Effect.sleep("1 second");
      }
    }),
  // Release (always runs)
  (fd) =>
    Effect.sync(() => {
      console.log("Closing file");
      fs.closeSync(fd);
    })
);
```

### Scoped Resources

Use `Effect.scoped` to automatically manage resource lifetimes:

```typescript
const resource = (id: number) =>
  Effect.gen(function* () {
    console.log(`Acquiring resource ${id}`);
    
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => console.log(`Releasing resource ${id}`))
    );
    
    return { id, data: "resource" };
  });

const program = Effect.scoped(
  Effect.gen(function* () {
    const r1 = yield* resource(1);
    const r2 = yield* resource(2);
    
    // Use resources
    yield* Effect.sleep("5 seconds");
    
    // Resources automatically released when scope exits
  })
);
```

---

## Working with Bun Runtime

### Why Custom Signal Handling?

Bun doesn't support `@effect/platform-node` due to missing Node.js-specific dependencies (`@effect/cluster`). We use manual signal handling instead.

### Complete Bun-Compatible Setup

**Main Entry Point:**

```typescript
import { Effect, Exit, Fiber } from "effect";
import { Server } from "./app/server";

let shuttingDown = false;

const program = Effect.gen(function* () {
  console.log("Starting...");
  
  const serverFiber = yield* Effect.fork(Server);
  
  const handleShutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    
    console.log(`\n=== Received ${signal} ===`);
    console.log("Beginning graceful shutdown...");
    
    Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.sync(() => console.log("Interrupting server..."));
        const exit = yield* Fiber.interrupt(serverFiber);
        yield* Effect.sync(() => console.log("Shutdown complete"));
        yield* Effect.sync(() => process.exit(Exit.isSuccess(exit) ? 0 : 1));
      })
    ).catch((error) => {
      console.error("Error during shutdown:", error);
      process.exit(1);
    });
  };
  
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
  
  console.log("Signal handlers registered");
  
  yield* Fiber.join(serverFiber);
});

Effect.runPromise(program).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

**Server Implementation:**

```typescript
import { Effect, Queue, Stream } from "effect";

export const Server = Effect.gen(function* () {
  console.log("Server initialized");
  
  const messageQueue = yield* Queue.unbounded<string>();
  
  // Background processor
  yield* Stream.fromQueue(messageQueue).pipe(
    Stream.tap((msg) =>
      Effect.gen(function* () {
        console.log("Processing:", msg);
        yield* Effect.sleep("100 millis");
      })
    ),
    Stream.runDrain,
    Effect.fork
  );
  
  console.log("Server ready");
  
  yield* Effect.never;
}).pipe(
  Effect.ensuring(
    Effect.sync(() => {
      console.log("=== Cleanup ===");
      console.log("Server cleanup complete");
    })
  )
);
```

---

## Complete Example

See our implementation in:
- **Server**: `packages/opencode-worker/src/app/server.ts`
- **Main**: `packages/opencode-worker/src/main.ts`

**Expected Output on Shutdown:**

```
Server initialized
Server starting to listen for messages...
Server is now listening
Server ready - all background tasks started
Processing message: Test message 1
^C
SIGINT handler called

=== Received SIGINT signal ===
Beginning graceful shutdown...
Interrupting server fiber...

=== Server Cleanup ===
Server cleanup: Shutting down gracefully...
Server cleanup: Closing message queue...
Server cleanup: Waiting for in-flight messages to complete...
Server cleanup: Complete
Fiber interrupted
Server shutdown complete
```

---

## Best Practices

### 1. Always Use Cleanup Handlers

Use `Effect.ensuring` or `Effect.addFinalizer` for all resources that need cleanup.

```typescript
// ✅ Good
const program = doWork.pipe(
  Effect.ensuring(cleanup)
);

// ❌ Bad - cleanup might not run
const program = Effect.gen(function* () {
  yield* doWork;
  yield* cleanup; // Only runs on success
});
```

### 2. Fork Background Tasks

Use `Effect.fork` for concurrent work that should be supervised.

```typescript
// ✅ Good - supervised
const fiber = yield* backgroundTask.pipe(Effect.fork);

// ❌ Bad - unsupervised, won't be cleaned up
const fiber = yield* backgroundTask.pipe(Effect.forkDaemon);
```

### 3. Use Effect.never for Keep-Alive

Don't use promises or intervals - use `Effect.never`.

```typescript
// ✅ Good
yield* Effect.never;

// ❌ Bad
await new Promise(() => {});
```

### 4. Handle Shutdown Idempotently

Ensure shutdown can be called multiple times safely.

```typescript
let shuttingDown = false;

const handleShutdown = () => {
  if (shuttingDown) return; // Idempotent
  shuttingDown = true;
  // ... cleanup
};
```

### 5. Exit with Appropriate Code

Check the Exit value and exit accordingly.

```typescript
const exit = yield* Fiber.interrupt(fiber);
process.exit(Exit.isSuccess(exit) ? 0 : 1);
```

### 6. Use Scoped for Resource Management

Prefer `Effect.scoped` over manual cleanup when possible.

```typescript
// ✅ Good
const program = Effect.scoped(
  Effect.gen(function* () {
    const resource = yield* acquireResource;
    yield* useResource(resource);
    // Automatic cleanup
  })
);
```

### 7. Test Graceful Shutdown

Always test that cleanup handlers run:

```bash
# Start server
pnpm start

# Send SIGINT (Ctrl+C)
# Verify cleanup logs appear

# Send SIGTERM
kill -SIGTERM <pid>
# Verify cleanup logs appear
```

---

## Reference: Key Effect Constructs

| Construct | Purpose | Use Case |
|-----------|---------|----------|
| `Effect.never` | Block indefinitely | Keep application alive |
| `Effect.ensuring` | Always run cleanup | Resource cleanup |
| `Effect.addFinalizer` | Scoped cleanup | Resource in scope |
| `Effect.fork` | Supervised background task | Concurrent work |
| `Effect.forkDaemon` | Unsupervised background task | Fire-and-forget |
| `Fiber.interrupt` | Graceful fiber shutdown | Signal handling |
| `Fiber.join` | Wait for fiber completion | Synchronization |
| `Effect.scoped` | Automatic resource management | Resource boundaries |
| `Effect.acquireUseRelease` | Guaranteed cleanup | Critical resources |
| `NodeRuntime.runMain` | Auto signal handling (Node.js) | Node.js apps only |

---

## Troubleshooting

### Cleanup Handlers Not Running

**Problem**: Finalizers don't execute on SIGTERM/SIGINT

**Solutions**:
1. Ensure you're interrupting the correct fiber
2. Verify signal handler is registered before the Effect runs
3. Check that the fiber hasn't already completed
4. For Bun: Don't use `NodeRuntime.runMain` - use manual signal handling

### Process Won't Stay Alive

**Problem**: Application exits immediately

**Solutions**:
1. Add `Effect.never` after starting background tasks
2. Use `Fiber.join` to wait for the main fiber
3. Verify you're not calling `process.exit()` prematurely

### Multiple Cleanup Invocations

**Problem**: Cleanup runs multiple times

**Solutions**:
1. Add idempotency guard with boolean flag
2. Remove signal listeners after first invocation
3. Track shutdown state globally

---

## Additional Resources

- [Effect Documentation](https://effect.website/)
- [Effect Reference Implementation](packages/opencode-worker/references/effect/)
- [Our Server Implementation](packages/opencode-worker/src/)
