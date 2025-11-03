# OpenCode Orchestrator - Worker Service

The worker service is a Node.js application that runs on a user's local machine to orchestrate OpenCode AI assistants. It connects to the Convex backend, manages multiple directory-bound workers (assistants), and processes chat sessions.

## Architecture

This project follows **Clean Architecture** principles with strict separation of concerns:

```
┌─────────────────────────────────────┐
│      Presentation Layer (CLI)      │  ← User Interaction
├─────────────────────────────────────┤
│       Application Layer (Use Cases) │  ← Business Rules
├─────────────────────────────────────┤
│    Domain Layer (Entities/Values)   │  ← Core Business Logic
└─────────────────────────────────────┘
          ↑                    ↑
    ┌─────┴────────┐    ┌─────┴─────┐
    │ Infrastructure │    │Infrastructure│
    │   (Convex)     │    │  (OpenCode) │
    └────────────────┘    └────────────┘
```

### Layers

- **Domain**: Pure business logic, entities, value objects, and port interfaces
- **Application**: Use cases that orchestrate domain entities
- **Infrastructure**: External service implementations (Convex, OpenCode SDK)
- **Presentation**: CLI interface and MachineServer orchestrator

## Key Features

- 🔐 **Secure Authentication**: Token-based machine registration
- 🔄 **Stateless Design**: Full state recovery from Convex
- 📁 **Directory-Bound Workers**: Multiple assistants per machine
- 💬 **Session Management**: Concurrent chat sessions with idle timeout
- 🔄 **Graceful Recovery**: Automatic restart and state restoration
- 📊 **High Test Coverage**: 80%+ coverage requirement

## Installation

```bash
# Install dependencies
pnpm install

# Copy environment template
cp env.example .env

# Edit .env with your Convex URL
# CONVEX_URL will be provided by the webapp during registration
```

## Usage

The worker service supports two operating modes:

### Development Mode (Single Worker)

For local development with a single worker:

```bash
# Start in development mode with auto-reload
pnpm run dev
```

On first run, you'll be prompted to enter:
- Worker token (from web UI: Machine → ⋮ → "Add Worker")
- Convex URL (from your Convex dashboard)

Configuration is saved to `.env` for future runs.

### Production Mode (Multiple Workers)

For running multiple workers from a centralized configuration:

```bash
# Start all configured workers
pnpm run opencode-orchestrator
```

On first run, a template configuration will be created at:
```
~/.config/opencode-orchestrator/workers.json
```

Edit this file to add your worker configurations.

📖 **For detailed setup instructions, see [ORCHESTRATOR-SETUP.md](./ORCHESTRATOR-SETUP.md)**

### Development

```bash
# Development mode with hot reload
pnpm dev

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run unit tests only
pnpm test:unit

# Run integration tests
pnpm test:integration

# Run E2E tests
pnpm test:e2e

# Type checking
pnpm typecheck

# Linting
pnpm lint
pnpm lint:fix
```

## Configuration

### Development Mode (.env file)

Create a `.env` file in `services/worker/`:

```bash
# Worker authentication token (required)
# Format: machine_<machine_id>:worker_<worker_id>:secret_<secret>
WORKER_TOKEN=machine_abc123:worker_xyz789:secret_def456ghi789jkl012

# Convex Backend URL (required)
CONVEX_URL=https://your-convex-deployment.convex.cloud
```

The working directory will be the current directory (`process.cwd()`).

### Production Mode (workers.json file)

Create `~/.config/opencode-orchestrator/workers.json`:

```jsonc
{
  "workers": [
    // Main project worker  
    {
      "token": "machine_abc123:worker_xyz789:secret_def456ghi789jkl012",
      "working_directory": "~/Documents/Projects/my-project",  // Required
      "convex_url": "https://your-deployment.convex.cloud"
    }
  ]
}
```

**Configuration Notes:**
- Supports JSONC format (JSON with `//` and `/* */` comments)
- `working_directory` is **mandatory** for each worker
- Supports tilde (`~`) expansion and relative paths
- Each worker can have its own working directory and configuration

📖 **For complete configuration guide, see [ORCHESTRATOR-SETUP.md](./ORCHESTRATOR-SETUP.md)**

## Project Structure

```
services/worker/
├── src/
│   ├── index.ts                    # CLI entry point
│   ├── domain/                     # Core business logic
│   │   ├── entities/               # Domain entities
│   │   ├── valueObjects/           # Value objects (IDs, Token)
│   │   └── interfaces/             # Port interfaces
│   ├── application/                # Use cases
│   │   └── usecases/               # Application-specific logic
│   ├── infrastructure/             # External adapters
│   │   ├── convex/                 # Convex client implementations
│   │   ├── opencode/               # OpenCode SDK adapter
│   │   └── config/                 # Configuration management
│   ├── presentation/               # User interface
│   │   └── MachineServer.ts        # Main server orchestrator
│   └── __tests__/                  # Tests
│       ├── domain/                 # Domain layer tests
│       ├── application/            # Application layer tests
│       ├── integration/            # Integration tests
│       └── e2e/                    # End-to-end tests
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## How It Works

### Machine Lifecycle

1. **Registration**:
   - User creates machine in webapp, receives token
   - Worker starts with token, authenticates with Convex
   - Token is stored locally for future starts

2. **State Recovery**:
   - On startup, worker queries Convex for all registered workers and sessions
   - WorkerManager initializes all workers
   - Active sessions are prepared for restoration on first message

3. **Session Management**:
   - Each chat session spawns its own OpenCode process
   - Sessions idle after 5 minutes of inactivity
   - On next message, worker resumes session automatically

4. **Message Processing**:
   - Worker subscribes to Convex for real-time messages
   - Routes messages to appropriate worker by session ID
   - Streams chunks to Convex for frontend display
   - Writes complete message when done

### Clean Architecture Benefits

- **Testability**: Domain logic is pure and easily tested
- **Flexibility**: Easy to swap infrastructure (e.g., different backend)
- **Maintainability**: Clear separation of concerns
- **Scalability**: Business rules independent of frameworks

## Testing

The project has comprehensive test coverage:

- **Unit Tests** (`__tests__/domain`, `__tests__/application`):
  - Test domain entities, value objects, and use cases
  - Mocked dependencies
  - Fast execution

- **Integration Tests** (`__tests__/integration`):
  - Test infrastructure implementations
  - Real Convex/OpenCode interactions in test environment
  - Slower execution

- **E2E Tests** (`__tests__/e2e`):
  - Test complete user flows
  - Full system integration
  - Most realistic scenarios

### Running Tests

```bash
# All tests
pnpm test

# With coverage report
pnpm test:coverage

# Specific test suites
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# Watch mode during development
pnpm test:watch
```

## Troubleshooting

### Common Issues

**"Invalid token format"**
- Ensure token is in format `<machine_id>:<machine_secret>`
- Check for extra whitespace or special characters

**"Failed to connect to Convex"**
- Verify CONVEX_URL in .env is correct
- Check network connectivity
- Ensure Convex deployment is running

**"Directory not found"**
- Ensure ROOT_DIRECTORY exists and is accessible
- Check directory permissions

**"Session not found"**
- Session may have been terminated due to idle timeout
- Send a new message to automatically resume

## Development Notes

### Key Design Decisions

1. **Clean Architecture**: Enables easy testing and maintenance
2. **Stateless**: All state recoverable from Convex
3. **Branded Types**: Prevents ID confusion with type safety
4. **High Coverage**: 80%+ test coverage requirement
5. **Graceful Degradation**: Automatic recovery from failures

### Adding New Features

1. Define domain interfaces in `domain/interfaces/`
2. Create use cases in `application/usecases/`
3. Implement infrastructure adapters in `infrastructure/`
4. Update MachineServer in `presentation/`
5. Write comprehensive tests

## Contributing

1. Follow Clean Architecture principles
2. Maintain 80%+ test coverage
3. Use Biome for linting and formatting
4. Write descriptive commit messages
5. Update documentation as needed

## License

MIT

