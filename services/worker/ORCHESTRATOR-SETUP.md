# OpenCode Orchestrator Setup Guide

This guide explains how to configure and run the OpenCode Orchestrator in both development and production modes.

## Two Operating Modes

### Development Mode (Single Worker)

Use this mode when developing locally or running a single worker.

**Configuration:**
- Uses `.env` file in `services/worker/` directory
- Working directory: Current directory (`process.cwd()`)
- Suitable for local development and testing

**Command:**
```bash
cd services/worker
pnpm run dev
```

**First-Time Setup:**
On first run, you'll be prompted to enter:
1. Worker token (from web UI: Machine → ⋮ → "Add Worker")
2. Convex URL (from Convex dashboard)

These values are saved to `.env` for future runs.

**Example .env:**
```env
WORKER_TOKEN=machine_abc123:worker_xyz789:secret_def456ghi789jkl012
CONVEX_URL=https://your-deployment.convex.cloud
```

---

### Production Mode (Multiple Workers)

Use this mode to run multiple workers across different directories.

**Configuration:**
- Uses `~/.config/opencode-orchestrator/workers.json`
- Each worker can have its own working directory
- Suitable for production deployments

**Command:**
```bash
cd services/worker
pnpm run opencode-orchestrator
```

**First-Time Setup:**
On first run, a template configuration file will be created at:
```
~/.config/opencode-orchestrator/workers.json
```

Edit this file to add your worker configurations.

**Example workers.json:**
```jsonc
{
  "workers": [
    // Main project worker
    {
      "token": "machine_abc123:worker_xyz789:secret_def456ghi789jkl012",
      "working_directory": "~/Documents/Projects/my-project",
      "convex_url": "https://your-deployment.convex.cloud"
    },
    // Another project worker
    {
      "token": "machine_def456:worker_uvw123:secret_ghi789jkl012mno345",
      "working_directory": "~/Documents/Projects/another-project",
      "convex_url": "https://your-deployment.convex.cloud"
    }
  ]
}
```

---

## Configuration File Format

### workers.json Structure

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `token` | string | ✅ Yes | Worker authentication token | `machine_abc:worker_xyz:secret_123` |
| `working_directory` | string | ✅ Yes | Worker's working directory path | `~/Documents/Projects/my-project` |
| `convex_url` | string | ✅ Yes | Convex backend URL (must be HTTPS) | `https://your-deployment.convex.cloud` |

**Path Formats Supported**:
- **Absolute paths**: `/Users/username/Documents/project`
- **Tilde expansion**: `~/Documents/project` (expands to home directory)
- **Relative paths**: `./my-project` (relative to current directory)

**JSONC Support**:
- Single-line comments: `// This is a comment`
- Multi-line comments: `/* This is a comment */`
- Comments are stripped before parsing

**Notes:**
- All fields are **mandatory** for each worker
- All workers can use the same Convex URL
- Each worker must have a unique token
- Working directory must exist (create it before starting)

---

## Getting Worker Tokens

1. Open the web UI for your OpenCode Orchestrator
2. Navigate to your machine
3. Click the menu icon (⋮) next to the machine name
4. Select "Add Worker"
5. Copy the generated token

The token format is:
```
machine_<machine_id>:worker_<worker_id>:secret_<secret>
```

---

## Commands Reference

### Development Mode
```bash
# Start single worker in dev mode (with auto-reload)
pnpm run dev

# Show help
pnpm run dev --help
```

### Production Mode
```bash
# Start all configured workers
pnpm run opencode-orchestrator

# Show help
pnpm run opencode-orchestrator --help
```

### Other Commands
```bash
# Type check
pnpm run typecheck

# Run tests
pnpm run test

# Lint code
pnpm run lint
```

---

## Troubleshooting

### Workers.json not found

**Error:**
```
No workers configuration found. A template has been created at:
~/.config/opencode-orchestrator/workers.json
```

**Solution:**
Edit the template file and add your worker configurations, then run the command again.

---

### Invalid token format

**Error:**
```
Worker token must be in format: machine_<machine_id>:worker_<worker_id>:secret_<secret>
```

**Solution:**
Make sure your token includes all three parts separated by colons:
- `machine_<id>`
- `worker_<id>`
- `secret_<secret>`

Get a new token from the web UI if needed.

---

### Worker startup failed

**Behavior:**
One or more workers fail to start, but others continue running.

**What happens:**
- Failed workers are logged with error messages
- Other workers continue to run normally
- The orchestrator keeps running if at least one worker starts successfully

**Solution:**
1. Check the error message for the failed worker
2. Verify the token is valid and approved in the web UI
3. Verify the working directory exists and is accessible
4. Verify the Convex URL is correct

---

### All workers failed to start

**Error:**
```
Failed to start any workers. Check the errors above.
```

**Solution:**
1. Check that all tokens are valid
2. Verify workers are approved in the web UI
3. Check network connectivity to Convex backend
4. Verify all working directories exist

---

## Migration from .env to workers.json

If you're currently using `.env` for production, here's how to migrate:

1. Create the workers.json file:
   ```bash
   mkdir -p ~/.config/opencode-orchestrator
   ```

2. Copy your configuration from `.env`:
   ```json
   {
     "workers": [
       {
         "token": "YOUR_WORKER_TOKEN_FROM_ENV",
         "working_directory": "/your/current/directory",
         "convex_url": "YOUR_CONVEX_URL_FROM_ENV"
       }
     ]
   }
   ```

3. Test the orchestrator:
   ```bash
   pnpm run opencode-orchestrator
   ```

4. Keep `.env` for development mode only

---

## Architecture Notes

### Working Directory Behavior

- **Development Mode**: Uses `process.cwd()` (current directory)
- **Production Mode**: Uses `working_directory` from each worker config

### Graceful Shutdown

Both modes support graceful shutdown:
- Press `Ctrl+C` to stop all workers
- Workers have 10 seconds (dev) or 30 seconds (production) to shutdown
- Force exit after timeout if needed

### Error Handling

- Development mode: Stops if the single worker fails
- Production mode: Continues running if any worker succeeds
- All startup errors are logged with details

---

## Best Practices

1. **Use development mode for local work**
   - Faster iteration with auto-reload
   - Simpler configuration
   - Works with current directory

2. **Use production mode for deployments**
   - Manage multiple workers from one configuration
   - Each worker in its own directory
   - Centralized configuration management

3. **Keep tokens secure**
   - Never commit tokens to version control
   - Use different tokens for dev and production
   - Rotate tokens periodically

4. **Monitor worker status**
   - Check logs for startup errors
   - Verify workers are approved in web UI
   - Ensure working directories are accessible

---

## Support

For issues or questions:
- Check the error logs for specific error messages
- Verify configuration file syntax (must be valid JSON)
- Ensure all tokens are approved in the web UI
- Check that Convex backend is accessible

