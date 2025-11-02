# Worker Configuration System

## Overview

The worker service uses a robust, Zod-based environment configuration system that ensures all required environment variables are present and valid before the application starts. This provides fail-fast behavior and clear error messages.

## Key Features

### ✅ Single Source of Truth
- All environment variables are defined in one place (`src/config/env.ts`)
- Schema-driven validation using Zod
- Type-safe access throughout the application

### ✅ Fail-Fast Validation
- Environment is validated once at startup
- Invalid configuration prevents the application from starting
- Clear, actionable error messages

### ✅ Interactive Setup
- Prompts for missing environment variables
- Validates input format before saving
- Provides helpful instructions for obtaining values

### ✅ Singleton Pattern
- Environment is parsed and validated only once
- Cached instance is reused throughout the application
- Prevents redundant parsing and validation

## Environment Variables

### Required Variables

#### `WORKER_TOKEN`
- **Format**: `machine_<machine_id>:worker_<worker_id>:secret_<secret>`
- **Example**: `machine_abc123:worker_xyz789:secret_def456ghi789jkl012`
- **Security**: The secret is a cryptographically secure random string (32 bytes, base64url-encoded) that authenticates this worker with the backend
- **How to Get**:
  1. Go to the web UI
  2. Select your machine
  3. Click the menu (⋮) next to the machine
  4. Select "Add Worker"
  5. Copy the token shown (includes the secret)
- **Note**: Keep this token secure! Anyone with this token can authenticate as this worker

#### `CONVEX_URL`
- **Format**: HTTPS URL
- **Example**: `https://your-deployment.convex.cloud`
- **How to Get**: From your Convex dashboard

## Usage

### Basic Usage

```typescript
import { loadEnv, parseWorkerConfig } from './config';

// Load and validate environment (call once at startup)
const env = loadEnv();

// Parse worker configuration
const config = parseWorkerConfig(env);

console.log(`Machine: ${config.machineId}`);
console.log(`Worker: ${config.workerId}`);
console.log(`Convex: ${config.convexUrl}`);
```

### With Interactive Setup

```typescript
import { loadConfig, interactiveSetup, loadEnv } from './config';

// Try to load configuration
let config = await loadConfig();

// If missing, run interactive setup
if (!config) {
  await interactiveSetup();
  loadEnv(); // Reload after setup
  config = await loadConfig();
}

// Config is now guaranteed to be valid
console.log(`Worker ${config.workerId} ready!`);
```

### Accessing Environment Anywhere

```typescript
import { getEnv } from './config';

// Get validated environment (must be loaded first)
const env = getEnv();

// Use environment variables
const url = env.CONVEX_URL;
```

## File Structure

```
src/config/
├── env.ts          # Zod schema, validation, parsing
└── index.ts        # Interactive setup, convenience exports
```

### `env.ts` - Core Environment System

**Responsibilities:**
- Define Zod schema for all environment variables
- Validate environment on load
- Parse worker token into machineId and workerId
- Provide singleton access to validated environment

**Key Functions:**
- `loadEnv()` - Load and validate environment (call once at startup)
- `getEnv()` - Get validated environment (must be loaded first)
- `parseWorkerConfig(env)` - Parse worker configuration from environment
- `checkMissingEnvVars()` - Check which variables are missing (no validation)

### `index.ts` - Interactive Setup

**Responsibilities:**
- Provide high-level configuration loading
- Handle interactive prompts for missing variables
- Save configuration to .env file
- Re-export core functions for convenience

**Key Functions:**
- `loadConfig()` - Load config or return null if invalid
- `interactiveSetup()` - Prompt for missing variables and save to .env

## Validation Rules

### Worker Token
- Must match format: `machine_<machine_id>:worker_<worker_id>:secret_<secret>`
- Machine ID, worker ID, and secret must all be non-empty
- Uses regex validation: `/^machine_[a-zA-Z0-9_-]+:worker_[a-zA-Z0-9_-]+:secret_[a-zA-Z0-9_-]+$/`
- Secret is a base64url-encoded string (URL-safe characters only)

### Convex URL
- Must be a valid URL
- Must start with `https://`
- Must be non-empty

## Error Handling

### Validation Errors

When validation fails, you get clear error messages:

```
Environment validation failed:
  ❌ WORKER_TOKEN: WORKER_TOKEN must be in format: machine_<machine_id>:worker_<worker_id>
  ❌ CONVEX_URL: CONVEX_URL must be a valid URL

Please check your .env file and ensure all required variables are set correctly.
```

### Missing Variables

When variables are missing, the interactive setup guides you:

```
🚀 Worker Setup

📋 Worker Token Setup
   To get your worker token:
   1. Go to the web UI
   2. Select your machine
   3. Click the menu (⋮) next to the machine
   4. Select "Add Worker"
   5. Copy the token shown

Enter worker token: _
```

## Example .env File

```bash
# Worker authentication token
# Format: machine_<machine_id>:worker_<worker_id>
# Get this from the web UI by selecting your machine and clicking "Add Worker"
WORKER_TOKEN=machine_abc123:worker_xyz789

# Convex backend URL
# Get this from your Convex dashboard
CONVEX_URL=https://your-deployment.convex.cloud
```

## Migration from Old System

### Old System (Machine Token)
```bash
MACHINE_TOKEN=abc123:def456
CONVEX_URL=https://...  # Optional
```

### New System (Worker Token)
```bash
WORKER_TOKEN=machine_abc123:worker_xyz789
CONVEX_URL=https://...  # Required
```

### Breaking Changes
1. Environment variable renamed: `MACHINE_TOKEN` → `WORKER_TOKEN`
2. Token format changed: `<id>:<secret>` → `machine_<id>:worker_<id>`
3. `CONVEX_URL` is now required (was optional)
4. Validation is now strict (fails fast on invalid config)

## Benefits

### Developer Experience
- ✅ Clear error messages when configuration is wrong
- ✅ Interactive setup for first-time users
- ✅ Type-safe access to environment variables
- ✅ No need to manually validate each variable

### Production Safety
- ✅ Application won't start with invalid configuration
- ✅ Fail-fast behavior prevents runtime errors
- ✅ Single source of truth for all environment variables
- ✅ Validated once, used everywhere

### Maintainability
- ✅ Easy to add new environment variables (update schema)
- ✅ Centralized validation logic
- ✅ Self-documenting through Zod schema
- ✅ Type inference from schema

## Testing

### Unit Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { loadEnv, resetEnv } from './config/env';

describe('Environment Configuration', () => {
  beforeEach(() => {
    resetEnv(); // Reset singleton between tests
  });

  it('should validate correct environment', () => {
    process.env.WORKER_TOKEN = 'machine_abc:worker_xyz';
    process.env.CONVEX_URL = 'https://test.convex.cloud';

    expect(() => loadEnv()).not.toThrow();
  });

  it('should reject invalid worker token format', () => {
    process.env.WORKER_TOKEN = 'invalid-format';
    process.env.CONVEX_URL = 'https://test.convex.cloud';

    expect(() => loadEnv()).toThrow('WORKER_TOKEN must be in format');
  });

  it('should reject non-HTTPS Convex URL', () => {
    process.env.WORKER_TOKEN = 'machine_abc:worker_xyz';
    process.env.CONVEX_URL = 'http://test.convex.cloud';

    expect(() => loadEnv()).toThrow('CONVEX_URL must use HTTPS');
  });
});
```

## Future Enhancements

Potential improvements for the configuration system:

1. **Environment-specific configs** - Support for dev/staging/prod environments
2. **Config file support** - Load from JSON/YAML in addition to .env
3. **Secret rotation** - Support for rotating worker tokens
4. **Health checks** - Validate Convex URL connectivity at startup
5. **Config validation API** - Expose validation endpoint for debugging

## Troubleshooting

### "Environment not loaded" Error

**Problem**: Called `getEnv()` before `loadEnv()`

**Solution**: Call `loadEnv()` once at application startup before using `getEnv()`

### "Invalid token format" Error

**Problem**: Worker token doesn't match expected format

**Solution**: Ensure token is in format `machine_<id>:worker_<id>`. Get a new token from the web UI.

### "CONVEX_URL must use HTTPS" Error

**Problem**: Convex URL uses HTTP instead of HTTPS

**Solution**: Update CONVEX_URL to use HTTPS. Convex only supports secure connections.

### Interactive Setup Not Triggering

**Problem**: Application starts without prompting for missing variables

**Solution**: Delete or rename your `.env` file and restart the application.

## Best Practices

1. **Load once at startup** - Call `loadEnv()` in your main entry point
2. **Use getEnv() for access** - Don't access `process.env` directly
3. **Don't commit .env** - Add `.env` to `.gitignore`
4. **Use env.example** - Keep `env.example` updated with required variables
5. **Validate early** - Load environment before any other initialization
6. **Handle errors gracefully** - Show clear messages when validation fails

## Related Documentation

- [Worker Token Authentication Flow](../../codemaps/worker-token-authentication.codemap.md)
- [Design Document](../../spec/design.md)
- [Environment Variables Example](./env.example)

