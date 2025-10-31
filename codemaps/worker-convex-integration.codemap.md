# Worker Convex Integration & Command Handling Codemap

## Overview

This codemap defines the Convex integration layer for the worker, including the message/command structure and subscription handling. The system must handle three distinct layers of commands while maintaining clean architecture boundaries.

## Command Hierarchy

### Layer 1: Terminal Commands (Direct Shell Execution)
Commands that bypass OpenCode and execute directly on the machine's shell.

**Use Cases:**
- `git clone <repo>` - Clone repositories
- `mkdir <dir>` - Create directories
- `ls`, `cd`, `pwd` - File system operations
- System administration tasks

**Security Considerations:**
- Must validate commands against whitelist
- Execute within root directory sandbox
- No privileged operations without explicit approval

### Layer 2: OpenCode Control Commands (Session Management)
Commands that control the OpenCode client and session lifecycle.

**Use Cases:**
- Start new session with specific model
- Switch active session
- Change model for current session
- List available models
- Fork session at message
- Terminate session

### Layer 3: Chat Messages (Normal Conversation)
Standard user messages sent to the active OpenCode session for processing.

**Use Cases:**
- Natural language requests
- Code generation
- File operations via OpenCode
- Normal chat interaction

## Message/Command DTOs

### Convex Schema (Backend)

```typescript
// services/backend/convex/schema.ts

import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Machine registration
  machines: defineTable({
    machineId: v.string(),      // Client-generated nanoid
    secret: v.string(),          // For authentication
    name: v.string(),            // User-friendly name
    status: v.union(v.literal('online'), v.literal('offline')),
    rootDirectory: v.string(),   // Sandboxed root path
    lastHeartbeat: v.number(),   // Timestamp
  })
    .index('by_machine_id', ['machineId']),

  // Worker registrations
  workers: defineTable({
    workerId: v.string(),        // Machine-generated nanoid
    machineId: v.string(),       // Parent machine
    directory: v.string(),       // Absolute path on machine
    displayName: v.string(),     // <machine>:<directory>
    status: v.union(v.literal('online'), v.literal('offline')),
    availableModels: v.array(v.string()), // Fetched from OpenCode
    activeSessionCount: v.number(),
  })
    .index('by_worker_id', ['workerId'])
    .index('by_machine_id', ['machineId']),

  // Chat sessions
  sessions: defineTable({
    sessionId: v.string(),       // OpenCode session ID
    workerId: v.string(),        // Parent worker
    machineId: v.string(),       // Parent machine
    model: v.string(),           // AI model identifier
    status: v.union(
      v.literal('active'),
      v.literal('idle'),
      v.literal('terminated')
    ),
    createdAt: v.number(),
    lastActivity: v.number(),
  })
    .index('by_session_id', ['sessionId'])
    .index('by_worker_id', ['workerId'])
    .index('by_machine_id', ['machineId']),

  // Commands/Messages (unified queue)
  commands: defineTable({
    commandId: v.string(),       // Client-generated nanoid
    machineId: v.string(),       // Target machine
    workerId: v.optional(v.string()), // Target worker (if applicable)
    sessionId: v.optional(v.string()), // Target session (if applicable)
    
    // Command classification
    type: v.union(
      v.literal('terminal'),     // Layer 1: Direct shell
      v.literal('opencode_control'), // Layer 2: Session management
      v.literal('chat_message')  // Layer 3: Normal conversation
    ),
    
    // Terminal commands
    terminalCommand: v.optional(v.object({
      command: v.string(),       // e.g., "git clone https://..."
      workingDirectory: v.optional(v.string()), // Relative to rootDirectory
    })),
    
    // OpenCode control commands
    opencodeControl: v.optional(v.object({
      action: v.union(
        v.literal('start_session'),
        v.literal('switch_session'),
        v.literal('change_model'),
        v.literal('list_models'),
        v.literal('terminate_session'),
        v.literal('fork_session')
      ),
      parameters: v.any(), // Action-specific parameters
    })),
    
    // Chat message
    chatMessage: v.optional(v.object({
      content: v.string(),       // User message
      model: v.optional(v.string()), // Optional model override
    })),
    
    // Metadata
    status: v.union(
      v.literal('pending'),      // Waiting for machine to pick up
      v.literal('processing'),   // Machine is executing
      v.literal('completed'),    // Successfully executed
      v.literal('failed')        // Execution failed
    ),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index('by_machine_pending', ['machineId', 'status'])
    .index('by_command_id', ['commandId']),

  // Response chunks (streaming)
  responseChunks: defineTable({
    commandId: v.string(),       // Parent command
    sessionId: v.optional(v.string()), // Parent session (for chat)
    chunkId: v.string(),         // Client-generated nanoid
    sequence: v.number(),        // Order within response
    content: v.string(),         // Chunk text
    timestamp: v.number(),
  })
    .index('by_command_id', ['commandId', 'sequence'])
    .index('by_session_id', ['sessionId', 'sequence']),

  // Complete messages (final)
  messages: defineTable({
    messageId: v.string(),       // Client-generated nanoid
    commandId: v.string(),       // Parent command
    sessionId: v.optional(v.string()), // Parent session (for chat)
    role: v.union(v.literal('user'), v.literal('assistant'), v.literal('system')),
    content: v.string(),         // Complete message
    timestamp: v.number(),
  })
    .index('by_session_id', ['sessionId', 'timestamp'])
    .index('by_command_id', ['commandId']),
});
```

### Worker-Side DTOs

```typescript
// services/worker/src/domain/interfaces/IConvexRepository.ts

/**
 * Command received from Convex for processing.
 */
export interface ConvexCommand {
  commandId: string;
  machineId: string;
  workerId?: string;
  sessionId?: string;
  type: 'terminal' | 'opencode_control' | 'chat_message';
  
  // Discriminated union based on type
  payload:
    | { type: 'terminal'; command: string; workingDirectory?: string }
    | { type: 'opencode_control'; action: OpencodeControlAction; parameters: unknown }
    | { type: 'chat_message'; content: string; model?: string };
  
  createdAt: number;
}

/**
 * OpenCode control actions (Layer 2 commands).
 */
export type OpencodeControlAction =
  | 'start_session'
  | 'switch_session'
  | 'change_model'
  | 'list_models'
  | 'terminate_session'
  | 'fork_session';

/**
 * Response chunk for streaming updates.
 */
export interface ResponseChunk {
  commandId: string;
  sessionId?: string;
  chunkId: string;
  sequence: number;
  content: string;
  timestamp: number;
}

/**
 * Complete message after processing.
 */
export interface CompleteMessage {
  messageId: string;
  commandId: string;
  sessionId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/**
 * Repository interface for Convex operations.
 * This is a PORT in clean architecture.
 */
export interface IConvexRepository {
  // Authentication
  authenticate(machineId: string, secret: string): Promise<void>;
  
  // Machine operations
  updateMachineStatus(machineId: string, status: 'online' | 'offline'): Promise<void>;
  sendHeartbeat(machineId: string): Promise<void>;
  
  // Worker operations
  createWorker(machineId: string, workerId: string, directory: string): Promise<void>;
  updateWorkerModels(workerId: string, models: string[]): Promise<void>;
  updateWorkerSessionCount(workerId: string, count: number): Promise<void>;
  
  // Session operations
  createSession(sessionId: string, workerId: string, machineId: string, model: string): Promise<void>;
  updateSessionStatus(sessionId: string, status: 'active' | 'idle' | 'terminated'): Promise<void>;
  updateSessionActivity(sessionId: string): Promise<void>;
  
  // Command operations
  subscribeToCommands(machineId: string, callback: (command: ConvexCommand) => void): () => void;
  updateCommandStatus(commandId: string, status: 'processing' | 'completed' | 'failed', error?: string): Promise<void>;
  
  // Response operations
  writeChunk(chunk: ResponseChunk): Promise<void>;
  writeMessage(message: CompleteMessage): Promise<void>;
  
  // State recovery
  syncMachineState(machineId: string): Promise<{
    workers: Array<{ workerId: string; directory: string }>;
    sessions: Array<{ sessionId: string; workerId: string; model: string; status: string }>;
  }>;
}
```

## Implementation Structure

### 1. Infrastructure - Convex Adapter

```
services/worker/src/infrastructure/convex/
├── ConvexRepository.ts          - Main repository implementation
├── ConvexClient.ts              - Convex client wrapper
├── mappers/                     - DTO mappers
│   ├── commandMapper.ts         - Map Convex commands to domain
│   ├── sessionMapper.ts         - Map session data
│   └── workerMapper.ts          - Map worker data
└── __tests__/
    └── ConvexRepository.test.ts
```

### 2. Application - Command Handlers

```
services/worker/src/application/
├── handlers/
│   ├── TerminalCommandHandler.ts      - Layer 1: Execute shell commands
│   ├── OpencodeControlHandler.ts      - Layer 2: Manage OpenCode sessions
│   └── ChatMessageHandler.ts          - Layer 3: Process chat messages
├── usecases/
│   ├── ProcessCommand.ts              - Main command processing orchestrator
│   ├── StartSession.ts                - Start new OpenCode session
│   ├── ResumeSession.ts               - Resume idle session
│   └── StreamResponse.ts              - Handle response streaming
└── __tests__/
    ├── handlers/
    └── usecases/
```

### 3. Presentation - Command Router

```
services/worker/src/presentation/
├── MachineServer.ts              - Main orchestrator (updated)
└── CommandRouter.ts              - Routes commands to appropriate handlers
```

## Command Processing Flow

```typescript
// Pseudo-code flow

// 1. Subscribe to commands
convexRepo.subscribeToCommands(machineId, async (command) => {
  // 2. Route to appropriate handler
  const handler = commandRouter.getHandler(command.type);
  
  // 3. Update status
  await convexRepo.updateCommandStatus(command.commandId, 'processing');
  
  try {
    // 4. Execute command
    const result = await handler.execute(command);
    
    // 5. Stream chunks (if applicable)
    if (result.isStreaming) {
      for await (const chunk of result.stream) {
        await convexRepo.writeChunk({
          commandId: command.commandId,
          sessionId: command.sessionId,
          chunkId: generateId(),
          sequence: chunkSequence++,
          content: chunk,
          timestamp: Date.now(),
        });
      }
    }
    
    // 6. Write complete message
    await convexRepo.writeMessage({
      messageId: generateId(),
      commandId: command.commandId,
      sessionId: command.sessionId,
      role: 'assistant',
      content: result.content,
      timestamp: Date.now(),
    });
    
    // 7. Update status
    await convexRepo.updateCommandStatus(command.commandId, 'completed');
  } catch (error) {
    await convexRepo.updateCommandStatus(
      command.commandId,
      'failed',
      error.message
    );
  }
});
```

## Security Considerations

### Terminal Command Whitelist

```typescript
// services/worker/src/application/security/TerminalCommandValidator.ts

const ALLOWED_COMMANDS = [
  'git',
  'npm',
  'pnpm',
  'yarn',
  'node',
  'mkdir',
  'ls',
  'cat',
  'pwd',
  'cd',
];

export class TerminalCommandValidator {
  validate(command: string): { valid: boolean; reason?: string } {
    const parts = command.trim().split(/\s+/);
    const baseCommand = parts[0];
    
    if (!ALLOWED_COMMANDS.includes(baseCommand)) {
      return {
        valid: false,
        reason: `Command '${baseCommand}' is not in the whitelist`,
      };
    }
    
    // Additional validation: no dangerous flags, no shell operators, etc.
    if (command.includes('&&') || command.includes('||') || command.includes(';')) {
      return {
        valid: false,
        reason: 'Shell operators are not allowed',
      };
    }
    
    return { valid: true };
  }
}
```

## Testing Strategy

### Unit Tests
- Command mappers (DTO conversions)
- Command validators
- Individual handlers

### Integration Tests
- Convex subscription handling
- Command routing
- End-to-end command execution (mocked Convex)

### E2E Tests
- Actual Convex backend interaction
- OpenCode SDK integration
- Multi-layer command processing

## Implementation Phases

### Phase 1: Foundation (Current)
- ✅ Domain entities (Machine, Worker, Session)
- ✅ OpenCode adapter interface & implementation
- ⏳ Convex repository interface (IConvexRepository)

### Phase 2: Convex Integration
- [ ] ConvexRepository implementation
- [ ] Command subscription handling
- [ ] Response streaming (chunks + messages)
- [ ] State recovery on restart

### Phase 3: Command Handlers
- [ ] Layer 3: ChatMessageHandler (normal conversation)
- [ ] Layer 2: OpencodeControlHandler (session management)
- [ ] Layer 1: TerminalCommandHandler (shell execution)

### Phase 4: Orchestration
- [ ] CommandRouter implementation
- [ ] Wire up MachineServer with all handlers
- [ ] Add heartbeat and monitoring

### Phase 5: Production Readiness
- [ ] Error handling and retry logic
- [ ] Logging and observability
- [ ] Security hardening
- [ ] Performance optimization

## Key Design Decisions

1. **Unified Command Queue**: Single `commands` table for all three layers, discriminated by `type` field
2. **Dual-Channel Response**: Separate tables for chunks (streaming) and complete messages (final state)
3. **Client-Generated IDs**: All IDs use nanoid, Convex IDs ignored for business logic
4. **Stateless Worker**: All state recoverable from Convex using machine token
5. **Command Whitelist**: Terminal commands validated against explicit whitelist
6. **Session Routing**: Commands include `sessionId` for proper routing to OpenCode process

## Next Steps

1. Define Convex backend schema and mutations/queries
2. Implement IConvexRepository interface
3. Create ConvexRepository adapter with Convex client
4. Implement command handlers (Layer 3 → 2 → 1 priority)
5. Wire up command routing in MachineServer
6. Add comprehensive testing

---

**References:**
- [@design.md](../spec/design.md) - Overall system design
- [@assistant-worker-runtime.codemap.md](./assistant-worker-runtime.codemap.md) - Worker architecture

