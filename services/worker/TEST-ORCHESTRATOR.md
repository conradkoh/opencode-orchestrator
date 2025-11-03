# Manual Testing Guide for Orchestrator Implementation

This guide provides step-by-step instructions to manually test the orchestrator implementation.

## Prerequisites

- Node.js and pnpm installed
- Access to Convex backend
- Worker token(s) from the web UI

## Test Suite

### Test 1: Development Mode - First Time Setup

**Objective**: Verify interactive setup works correctly

**Steps**:
1. Ensure no `.env` file exists in `services/worker/`
   ```bash
   cd services/worker
   rm .env 2>/dev/null || true
   ```

2. Start in dev mode:
   ```bash
   pnpm run dev
   ```

3. Verify prompts appear for:
   - Worker token
   - Convex URL

4. Enter valid values and verify:
   - `.env` file is created
   - Worker starts successfully
   - Working directory is logged (should be current directory)

**Expected Result**: Worker starts and connects to Convex

---

### Test 2: Development Mode - Existing .env

**Objective**: Verify dev mode uses existing .env

**Steps**:
1. Ensure `.env` exists from Test 1 or create one:
   ```bash
   cat > .env << 'EOF'
   WORKER_TOKEN=machine_abc123:worker_xyz789:secret_def456ghi789jkl012
   CONVEX_URL=https://your-deployment.convex.cloud
   EOF
   ```

2. Start in dev mode:
   ```bash
   pnpm run dev
   ```

3. Verify:
   - No prompts appear
   - Worker starts with values from .env
   - Working directory is current directory

**Expected Result**: Worker starts without prompting

---

### Test 3: Production Mode - Template Creation

**Objective**: Verify template file is created on first run

**Steps**:
1. Remove existing workers.json if it exists:
   ```bash
   rm ~/.config/opencode-orchestrator/workers.json 2>/dev/null || true
   ```

2. Run orchestrator:
   ```bash
   pnpm run opencode-orchestrator
   ```

3. Verify:
   - Error message explains template was created
   - File exists at `~/.config/opencode-orchestrator/workers.json`
   - File contains valid JSON with example worker

4. Check file contents:
   ```bash
   cat ~/.config/opencode-orchestrator/workers.json
   ```

**Expected Result**: Template file created with example configuration

---

### Test 4: Production Mode - Invalid Configuration

**Objective**: Verify validation errors are helpful

**Steps**:
1. Create invalid workers.json:
   ```bash
   cat > ~/.config/opencode-orchestrator/workers.json << 'EOF'
   {
     "workers": [
       {
         "token": "invalid-token-format",
         "working_directory": "",
         "convex_url": "http://insecure.example.com"
       }
     ]
   }
   EOF
   ```

2. Run orchestrator:
   ```bash
   pnpm run opencode-orchestrator
   ```

3. Verify error messages mention:
   - Token format issue
   - Working directory required (min 1 character)
   - HTTPS required for Convex URL

**Expected Result**: Clear validation errors for each issue

---

### Test 4b: JSONC Format Support

**Objective**: Verify comments in configuration are supported

**Steps**:
1. Create workers.json with comments:
   ```bash
   cat > ~/.config/opencode-orchestrator/workers.json << 'EOF'
   {
     "workers": [
       // Main project worker
       {
         "token": "YOUR_TOKEN_HERE",
         /* Working directory for main project */
         "working_directory": "~/test-worker-1",
         "convex_url": "https://your-deployment.convex.cloud"  // Production URL
       }
     ]
   }
   EOF
   ```

2. Create the working directory:
   ```bash
   mkdir -p ~/test-worker-1
   ```

3. Run orchestrator:
   ```bash
   pnpm run opencode-orchestrator
   ```

4. Verify:
   - Configuration parses successfully despite comments
   - Worker starts normally
   - No errors about comment syntax

**Expected Result**: Comments are stripped and configuration works

---

### Test 4c: Missing Mandatory Field

**Objective**: Verify mandatory field validation

**Steps**:
1. Create workers.json without working_directory:
   ```bash
   cat > ~/.config/opencode-orchestrator/workers.json << 'EOF'
   {
     "workers": [
       {
         "token": "machine_abc:worker_xyz:secret_123",
         "convex_url": "https://your-deployment.convex.cloud"
       }
     ]
   }
   EOF
   ```

2. Run orchestrator:
   ```bash
   pnpm run opencode-orchestrator
   ```

3. Verify error message mentions:
   - `working_directory` is required
   - Validation failed with field path

**Expected Result**: Clear error indicating missing mandatory field

---

### Test 5: Production Mode - Single Worker

**Objective**: Verify single worker starts correctly

**Steps**:
1. Create valid workers.json with one worker:
   ```bash
   cat > ~/.config/opencode-orchestrator/workers.json << 'EOF'
   {
     "workers": [
       {
         "token": "YOUR_ACTUAL_TOKEN_HERE",
         "working_directory": "~/test-worker-1",
         "convex_url": "https://your-deployment.convex.cloud"
       }
     ]
   }
   EOF
   ```

2. Create the working directory:
   ```bash
   mkdir -p ~/test-worker-1
   ```

3. Run orchestrator:
   ```bash
   pnpm run opencode-orchestrator
   ```

4. Verify:
   - Worker starts successfully
   - Working directory is logged correctly
   - Connection to Convex succeeds

5. Test shutdown:
   - Press Ctrl+C
   - Verify graceful shutdown message
   - Verify worker stops cleanly

**Expected Result**: Worker starts and stops gracefully

---

### Test 6: Production Mode - Multiple Workers

**Objective**: Verify multiple workers can run simultaneously

**Steps**:
1. Create valid workers.json with multiple workers:
   ```bash
   cat > ~/.config/opencode-orchestrator/workers.json << 'EOF'
   {
     "workers": [
       {
         "token": "YOUR_FIRST_TOKEN_HERE",
         "working_directory": "~/test-worker-1",
         "convex_url": "https://your-deployment.convex.cloud"
       },
       {
         "token": "YOUR_SECOND_TOKEN_HERE",
         "working_directory": "~/test-worker-2",
         "convex_url": "https://your-deployment.convex.cloud"
       }
     ]
   }
   EOF
   ```

2. Create working directories:
   ```bash
   mkdir -p ~/test-worker-1 ~/test-worker-2
   ```

3. Run orchestrator:
   ```bash
   pnpm run opencode-orchestrator
   ```

4. Verify:
   - Both workers start
   - Each logs its own working directory
   - Both connect to Convex
   - Status shows "2 of 2 workers started"

5. Test shutdown:
   - Press Ctrl+C
   - Verify both workers stop gracefully

**Expected Result**: Multiple workers run simultaneously

---

### Test 7: Production Mode - Partial Failure

**Objective**: Verify orchestrator continues if one worker fails

**Steps**:
1. Create workers.json with one valid and one invalid token:
   ```bash
   cat > ~/.config/opencode-orchestrator/workers.json << 'EOF'
   {
     "workers": [
       {
         "token": "YOUR_VALID_TOKEN_HERE",
         "working_directory": "~/test-worker-1",
         "convex_url": "https://your-deployment.convex.cloud"
       },
       {
         "token": "machine_invalid:worker_invalid:secret_invalid",
         "working_directory": "~/test-worker-2",
         "convex_url": "https://your-deployment.convex.cloud"
       }
     ]
   }
   EOF
   ```

2. Run orchestrator:
   ```bash
   pnpm run opencode-orchestrator
   ```

3. Verify:
   - First worker starts successfully
   - Second worker fails with error message
   - Orchestrator continues running
   - Status shows "1 of 2 workers started"

**Expected Result**: Valid worker runs despite invalid worker

---

### Test 8: Tilde Expansion

**Objective**: Verify ~ expands to home directory

**Steps**:
1. Create workers.json with tilde in path:
   ```bash
   cat > ~/.config/opencode-orchestrator/workers.json << 'EOF'
   {
     "workers": [
       {
         "token": "YOUR_TOKEN_HERE",
         "working_directory": "~/test-tilde-expansion",
         "convex_url": "https://your-deployment.convex.cloud"
       }
     ]
   }
   EOF
   ```

2. Create directory:
   ```bash
   mkdir -p ~/test-tilde-expansion
   ```

3. Run orchestrator:
   ```bash
   pnpm run opencode-orchestrator
   ```

4. Verify:
   - Log shows full path (not ~/...)
   - Path starts with /Users/username/ or /home/username/

**Expected Result**: Tilde expands to absolute path

---

### Test 9: Relative Path Resolution

**Objective**: Verify relative paths resolve correctly

**Steps**:
1. Create workers.json with relative path:
   ```bash
   cat > ~/.config/opencode-orchestrator/workers.json << 'EOF'
   {
     "workers": [
       {
         "token": "YOUR_TOKEN_HERE",
         "working_directory": "./test-relative",
         "convex_url": "https://your-deployment.convex.cloud"
       }
     ]
   }
   EOF
   ```

2. Create directory from services/worker:
   ```bash
   cd services/worker
   mkdir -p ./test-relative
   ```

3. Run orchestrator:
   ```bash
   pnpm run opencode-orchestrator
   ```

4. Verify:
   - Path resolves to absolute path
   - Path is relative to services/worker directory

**Expected Result**: Relative path converts to absolute

---

### Test 10: Help Text

**Objective**: Verify help text is useful

**Steps**:
1. Test dev mode help:
   ```bash
   pnpm run dev -- --help
   ```

2. Test orchestrator help:
   ```bash
   pnpm run opencode-orchestrator -- --help
   ```

3. Verify both show:
   - Usage instructions
   - Available options
   - Configuration details
   - Examples

**Expected Result**: Clear, helpful documentation

---

## Quick Validation Checklist

Use this checklist for rapid validation:

**Build & Type Safety:**
- [ ] `pnpm run typecheck` passes
- [ ] No linter errors in new files

**Development Mode:**
- [ ] Dev mode starts with existing .env
- [ ] Dev mode prompts when .env missing
- [ ] Working directory defaults to process.cwd()

**Production Mode - Setup:**
- [ ] Orchestrator creates template on first run
- [ ] Template includes all mandatory fields
- [ ] Orchestrator validates configuration

**Production Mode - JSONC Support:**
- [ ] Single-line comments (`//`) are supported
- [ ] Multi-line comments (`/* */`) are supported
- [ ] URLs are preserved (http://, https://)

**Production Mode - Validation:**
- [ ] Missing `working_directory` shows error
- [ ] Invalid token format shows error
- [ ] Invalid Convex URL shows error
- [ ] Empty `working_directory` shows error

**Production Mode - Execution:**
- [ ] Single worker starts successfully
- [ ] Multiple workers start in production mode
- [ ] Partial failures don't stop other workers

**Path Resolution:**
- [ ] Tilde expansion works (`~/path`)
- [ ] Relative paths resolve (`./path`)
- [ ] Absolute paths work (`/full/path`)

**Shutdown & Help:**
- [ ] Graceful shutdown works (Ctrl+C)
- [ ] Help text displays correctly for dev mode
- [ ] Help text displays correctly for orchestrator
- [ ] Error messages are clear and actionable

**Entry Points:**
- [ ] `pnpm run dev` works
- [ ] `pnpm start` works
- [ ] `pnpm run opencode-orchestrator` works
- [ ] Entry points documented in src/entries/README.md

## Cleanup

After testing, clean up test files:

```bash
# Remove test directories
rm -rf ~/test-worker-1 ~/test-worker-2 ~/test-tilde-expansion
cd services/worker
rm -rf ./test-relative

# Keep or remove workers.json as needed
# rm ~/.config/opencode-orchestrator/workers.json

# Keep or remove .env as needed  
# rm .env
```

## Troubleshooting Tests

### Worker fails to connect
- Verify Convex URL is correct
- Check network connectivity
- Ensure worker token is valid and approved in web UI

### Permission errors
- Ensure working directories exist
- Check directory permissions
- Verify user has write access

### Port conflicts
- Workers don't bind to ports, so this shouldn't occur
- If issues persist, check OpenCode SDK requirements

## Notes

- Replace `YOUR_TOKEN_HERE`, `YOUR_FIRST_TOKEN_HERE`, etc. with actual tokens from your web UI
- Replace `https://your-deployment.convex.cloud` with your actual Convex URL
- Some tests require approved worker tokens to fully complete

