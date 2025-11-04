/**
 * Test script to list available models using the opencode CLI.
 *
 * This script:
 * 1. Runs `opencode models` command to get the list of available models
 * 2. Parses the output
 * 3. Displays the results in our format
 *
 * Run with: bun run scripts/opencode-models-list.ts
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

async function main() {
  console.log('🚀 Testing OpenCode CLI - Listing Available Models\n');
  console.log('📂 Working directory:', process.cwd());
  console.log('');

  try {
    // 1. Run opencode models command
    console.log('1️⃣  Running `opencode models` command...');
    const { stdout, stderr } = await execAsync('opencode models');

    if (stderr) {
      console.warn('   ⚠️  Stderr:', stderr);
    }

    console.log('   ✅ Command executed successfully');
    console.log('');

    // 2. Display raw output
    console.log('2️⃣  Raw Output:');
    console.log('   ═══════════════════════════════════════════════════════');
    console.log(stdout);
    console.log('   ═══════════════════════════════════════════════════════');
    console.log('');

    // 3. Parse the output
    console.log('3️⃣  Parsing models...');
    const lines = stdout.split('\n').filter((line) => line.trim());
    const models: Array<{ id: string; name: string; provider: string }> = [];

    for (const line of lines) {
      // Skip header lines and empty lines
      if (
        line.includes('Available models') ||
        line.includes('─') ||
        line.includes('Provider') ||
        !line.trim()
      ) {
        continue;
      }

      // Try to parse model lines
      // Expected format might be: "provider/model-id" or similar
      const trimmed = line.trim();
      if (trimmed.includes('/')) {
        const [provider, ...modelParts] = trimmed.split('/');
        const modelId = modelParts.join('/');
        if (provider && modelId) {
          models.push({
            id: trimmed,
            name: modelId,
            provider: provider.trim(),
          });
        }
      }
    }

    console.log(`   ✅ Parsed ${models.length} models`);
    console.log('');

    // 4. Display in our format
    console.log('4️⃣  Transformed Model List (our format):');
    console.log('   ═══════════════════════════════════════════════════════');
    console.log('');

    if (models.length === 0) {
      console.log('   ⚠️  No models found from opencode CLI');
    } else {
      console.log(`   Total: ${models.length} models`);
      console.log('');
      for (const model of models) {
        console.log(`   • ${model.id}`);
        console.log(`     Provider: ${model.provider}`);
        console.log(`     Name: ${model.name}`);
        console.log('');
      }
    }

    console.log('✅ Test completed successfully!');
  } catch (error) {
    console.error('');
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      if ('stdout' in error) {
        console.error('   Stdout:', (error as { stdout?: string }).stdout);
      }
      if ('stderr' in error) {
        console.error('   Stderr:', (error as { stderr?: string }).stderr);
      }
    }
    process.exit(1);
  }
}

main();
