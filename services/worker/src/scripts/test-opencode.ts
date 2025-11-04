/**
 * Test script to validate OpenCode SDK integration.
 *
 * This script:
 * 1. Creates an OpenCode client for the current directory
 * 2. Lists available models
 * 3. Creates a session
 * 4. Sends a simple prompt
 * 5. Streams and displays the response
 * 6. Cleans up resources
 *
 * Run with: pnpm tsx src/scripts/test-opencode.ts
 */

import { validateSessionId } from '../domain/valueObjects/Ids';
import { OpencodeClientAdapter } from '../infrastructure/opencode/OpencodeClientAdapter';

async function main() {
  console.log('🚀 Testing OpenCode SDK Integration\n');

  const adapter = new OpencodeClientAdapter();

  try {
    // 1. Create client for current directory
    console.log('1️⃣  Creating OpenCode client...');
    const client = await adapter.createClient(process.cwd());
    console.log('   ✅ Client created successfully\n');

    // 2. Create a session
    console.log('2️⃣  Creating chat session...');
    const model = 'anthropic/claude-3-5-sonnet-20241022'; // Use a known model
    const session = await adapter.createSession(client, model);
    console.log(`   ✅ Session created: ${session.id}`);
    console.log(`   📂 Directory: ${session.directory}`);
    console.log(`   🤖 Model: ${model}\n`);

    // 3. List sessions
    console.log('3️⃣  Listing sessions...');
    const sessions = await adapter.listSessions(client);
    console.log(`   ✅ Found ${sessions.length} session(s)\n`);

    // 4. Send a prompt and stream response
    console.log('4️⃣  Sending prompt...');
    const prompt = 'Hello! Please respond with a brief greeting.';
    console.log(`   💬 Prompt: "${prompt}"`);
    console.log('   🔄 Streaming response...\n');
    console.log('   Response:');
    console.log('   ─────────────────────────────────────────');

    let fullResponse = '';

    // The adapter returns an AsyncIterator, we need to iterate it properly
    const responseIterator = adapter.sendPrompt(
      client,
      validateSessionId(session.id),
      prompt,
      model
    );
    for await (const chunk of responseIterator) {
      if (chunk.content) {
        process.stdout.write(chunk.content);
        fullResponse += chunk.content;
      }
      if (chunk.reasoning) {
        console.log(`\n   [Reasoning: ${chunk.reasoning}]`);
      }
    }

    console.log('\n   ─────────────────────────────────────────');
    console.log(`   ✅ Received ${fullResponse.length} characters\n`);

    // 5. Clean up
    console.log('5️⃣  Cleaning up...');
    await adapter.deleteSession(client, validateSessionId(session.id));
    console.log('   ✅ Session deleted');

    await adapter.closeClient(client);
    console.log('   ✅ Client closed\n');

    console.log('✨ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('\nError details:', error instanceof Error ? error.stack : error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
