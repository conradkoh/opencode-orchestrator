# OpenCode Orchestrator - Convex Backend

This directory contains the Convex backend functions and schema for OpenCode Orchestrator.

## Overview

The Convex backend provides:
- 🔐 **Authentication**: Session-based auth with Google OAuth and anonymous login
- 💬 **Chat Management**: Real-time chat sessions and message handling
- 🤖 **Worker Orchestration**: Machine registration and worker lifecycle management
- 📋 **Feature Modules**: Attendance, checklists, discussions, presentations
- 🔄 **Real-time Sync**: Reactive queries and subscriptions

## Structure

```
convex/
├── _generated/           # Auto-generated Convex types
├── auth/                 # Authentication functions
│   └── google.ts         # Google OAuth implementation
├── system/               # System-level functions
│   └── auth/             # System auth helpers
├── types/                # Shared types
│   └── sessionIds.ts     # Session ID types
├── lib/                  # Shared utilities
├── auth.ts               # Authentication API
├── chat.ts               # Chat session management
├── workers.ts            # Worker management
├── machines.ts           # Machine registration
├── workerActions.ts      # Worker action handlers
├── workerModels.ts       # Worker data models
├── attendance.ts         # Attendance tracking
├── checklists.ts         # Checklist features
├── discussions.ts        # Discussion forums
├── presentations.ts      # Presentation mode
├── serviceDesk.ts        # Service desk features
├── appinfo.ts            # Application info
├── cleanupTasks.ts       # Maintenance tasks
├── crypto.ts             # Cryptographic utilities
├── migration.ts          # Data migrations
└── schema.ts             # Database schema
```

## Key Features

### Authentication
- Session-based authentication using `convex-helpers/server/sessions`
- All authenticated functions require `SessionIdArg`
- Google OAuth and anonymous login support
- System admin access levels

### Chat System
- Real-time chat sessions with OpenCode assistants
- Message streaming and chunking
- Session state management
- Worker routing and coordination

### Worker Management
- Secure machine registration with tokens
- Worker lifecycle tracking (idle, active, offline)
- State synchronization with worker processes
- Graceful shutdown handling

## Development

### Running the Backend

```bash
# From services/backend
pnpm run dev

# Or from project root
pnpm run dev
```

### Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Type checking
pnpm typecheck
```

### Deployment

```bash
# Deploy to Convex production
pnpm run deploy
```

See [root README](../../../README.md#deployment) for complete deployment instructions.

## Authentication Conventions

All queries/mutations requiring authentication must use `SessionIdArg`:

```ts
import { SessionIdArg } from "convex-helpers/server/sessions";
import { query } from "./_generated/server";

export const myAuthQuery = query({
  args: {
    ...SessionIdArg,
    // other args
  },
  handler: async (ctx, args) => {
    // Implementation
  },
});
```

## Learn More

- [Convex Documentation](https://docs.convex.dev)
- [Convex Functions](https://docs.convex.dev/functions)
- [Convex Schema](https://docs.convex.dev/database/schemas)
- [Convex Helpers](https://github.com/get-convex/convex-helpers)
