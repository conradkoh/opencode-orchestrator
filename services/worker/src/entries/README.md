# Entry Points

This directory contains all entry point files for the OpenCode Worker service. Each entry point serves a specific purpose and runtime mode.

## Entry Points Overview

### `dev.ts`
**Purpose**: Development mode entry point for single worker development

**Used by**: 
- `pnpm run dev` (with auto-reload)
- `pnpm start` (without auto-reload)

**Configuration**: 
- Reads from `.env` file in `services/worker/`
- Required variables:
  - `WORKER_TOKEN` - Worker authentication token
  - `CONVEX_URL` - Convex backend URL

**Working Directory**: 
- Uses `process.cwd()` (current directory)

**Behavior**:
- Prompts for configuration on first run if `.env` is missing
- Saves configuration to `.env` for future runs
- Runs a single worker instance
- Ideal for local development and testing

**Usage**:
```bash
# With auto-reload (development)
pnpm run dev

# Without auto-reload
pnpm start

# Show help
pnpm run dev --help
```

**When to use**:
- Local development
- Testing worker functionality
- Quick iteration with hot reload
- Single project/directory development

---

### `orchestrator.ts`
**Purpose**: Production mode entry point for multi-worker orchestration

**Used by**: 
- `pnpm run opencode-orchestrator`

**Configuration**: 
- Reads from `~/.config/opencode-orchestrator/workers.json`
- Supports JSONC format (JSON with comments)
- Required per worker:
  - `token` - Worker authentication token (mandatory)
  - `working_directory` - Working directory path (mandatory, supports ~ expansion)
  - `convex_url` - Convex backend URL (mandatory)

**Working Directory**: 
- Each worker uses its configured `working_directory`
- Supports tilde (~) expansion to home directory
- Supports relative paths (resolved from current directory)

**Behavior**:
- Creates template configuration on first run
- Validates all worker configurations
- Starts workers in parallel
- Continues running if any worker starts successfully
- Handles graceful shutdown of all workers (30s timeout)
- Logs startup status for each worker

**Usage**:
```bash
# Start all configured workers
pnpm run opencode-orchestrator

# Show help
pnpm run opencode-orchestrator --help
```

**When to use**:
- Production deployments
- Running multiple workers across different directories
- Centralized configuration management
- Persistent worker configurations

**Example Configuration**:
```jsonc
// ~/.config/opencode-orchestrator/workers.json
{
  "workers": [
    {
      // Main project worker
      "token": "machine_abc123:worker_xyz789:secret_def456ghi789jkl012",
      "working_directory": "~/Documents/Projects/main-project",
      "convex_url": "https://your-deployment.convex.cloud"
    },
    {
      // Client project worker
      "token": "machine_def456:worker_uvw123:secret_ghi789jkl012mno345",
      "working_directory": "~/Documents/Clients/client-a",
      "convex_url": "https://your-deployment.convex.cloud"
    }
  ]
}
```

---

## Configuration Comparison

| Aspect | dev.ts | orchestrator.ts |
|--------|--------|-----------------|
| **Config File** | `.env` | `workers.json` |
| **Config Location** | `services/worker/` | `~/.config/opencode-orchestrator/` |
| **Format** | Environment variables | JSON/JSONC |
| **Workers** | Single | Multiple |
| **Working Directory** | `process.cwd()` | Per-worker configuration (mandatory) |
| **Auto-reload** | Yes (with `--watch`) | No |
| **Use Case** | Development | Production |
| **Comments** | Not supported | Supported (JSONC) |

---

## Working Directory Configuration

### Development Mode (`dev.ts`)
The working directory is **automatically set to the current directory** where you run the command:

```bash
cd ~/my-project
pnpm run dev  # Working directory: ~/my-project
```

### Production Mode (`orchestrator.ts`)
The working directory is **explicitly configured per worker** in `workers.json`:

```json
{
  "workers": [
    {
      "token": "...",
      "working_directory": "~/Documents/project-a",  // Required field
      "convex_url": "..."
    }
  ]
}
```

**Path formats supported**:
- **Absolute**: `/Users/username/Documents/project`
- **Tilde expansion**: `~/Documents/project` (expands to home directory)
- **Relative**: `./my-project` (relative to current directory)

---

## JSONC Support

The orchestrator configuration (`workers.json`) supports JSONC format, which allows comments:

```jsonc
{
  "workers": [
    // Production worker for main project
    {
      "token": "machine_abc:worker_xyz:secret_123",
      "working_directory": "~/Documents/Projects/main",  // Main project directory
      "convex_url": "https://prod.convex.cloud"
    },
    
    /* 
     * Development worker for testing
     * Uses a separate token and directory
     */
    {
      "token": "machine_def:worker_uvw:secret_456",
      "working_directory": "~/test-env",
      "convex_url": "https://dev.convex.cloud"
    }
  ]
}
```

**Supported comment styles**:
- Single-line: `// comment`
- Multi-line: `/* comment */`

---

## Error Handling

### dev.ts
- Missing `.env` → Interactive setup prompt
- Invalid token format → Validation error with format help
- Missing required variables → Interactive prompt for missing values
- Connection failure → Detailed error message, exits

### orchestrator.ts
- Missing `workers.json` → Creates template, exits with instructions
- Invalid JSON syntax → Syntax error with line number
- Validation errors → Lists all validation issues with field paths
- Worker startup failure → Logs error, continues with other workers
- All workers fail → Exits with error after logging all failures

---

## Adding New Entry Points

When adding a new entry point:

1. Create the entry file in `src/entries/`
2. Add shebang: `#!/usr/bin/env node`
3. Add script to `package.json`
4. Document in this README with:
   - Purpose
   - Configuration requirements
   - Usage examples
   - When to use

**Template**:
```typescript
#!/usr/bin/env node

// Imports
import { ... } from '../...';

// Main function
async function main(): Promise<void> {
  // Implementation
}

// Error handling
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

---

## Troubleshooting

### Command not found
Ensure you're running commands from the `services/worker` directory:
```bash
cd services/worker
pnpm run dev  # or pnpm run opencode-orchestrator
```

### Import errors
If you see import errors after moving files, verify all import paths use relative imports (`../`) and not path aliases.

### Permission errors
Ensure entry point files have execute permissions:
```bash
chmod +x src/entries/*.ts
```

---

## Related Documentation

- **Setup Guide**: [ORCHESTRATOR-SETUP.md](../../ORCHESTRATOR-SETUP.md)
- **Implementation**: [IMPLEMENTATION-SUMMARY.md](../../IMPLEMENTATION-SUMMARY.md)
- **Testing**: [TEST-ORCHESTRATOR.md](../../TEST-ORCHESTRATOR.md)
- **Main README**: [README.md](../../README.md)

