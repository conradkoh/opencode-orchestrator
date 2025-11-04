#!/usr/bin/env bun

/**
 * Test script to verify OpenCode session rename functionality.
 *
 * This script tests:
 * 1. Creating a new session
 * 2. Renaming the session BEFORE sending a message (test if this works)
 * 3. Sending a message
 * 4. Renaming the session AFTER sending a message
 * 5. Getting all sessions to verify the rename
 * 6. Fetching the session name directly
 *
 * Run with: bun run scripts/test-session-rename.ts
 */

import { validateSessionId } from '../src/domain/valueObjects/Ids';
import { OpencodeClientAdapter } from '../src/infrastructure/opencode/OpencodeClientAdapter';

async function main() {
  console.log('🧪 Testing OpenCode Session Rename Flow\n');
  console.log('═'.repeat(80));
  console.log('');

  const adapter = new OpencodeClientAdapter();
  let client: Awaited<ReturnType<typeof adapter.createClient>> | null = null;
  let sessionId: string | null = null;

  try {
    // 1. Create client for current directory
    console.log('1️⃣  Creating OpenCode client...');
    client = await adapter.createClient(process.cwd());
    console.log('   ✅ Client created successfully');
    console.log('   📂 Directory:', process.cwd());
    console.log('');

    // 2. Create a new session
    console.log('2️⃣  Creating new chat session...');
    const model = 'anthropic/claude-3-5-sonnet-20241022';
    const session = await adapter.createSession(client, model);
    sessionId = session.id;
    console.log(`   ✅ Session created: ${sessionId}`);
    console.log(`   📝 Initial title: "${session.title || '(no title)'}"`);
    console.log('');

    // 3. Try to rename BEFORE sending a message
    console.log('3️⃣  Attempting to rename session BEFORE sending a message...');
    const preMessageName = 'Test Session - Before Message';
    try {
      await adapter.renameSession(client, sessionId, preMessageName);
      console.log(`   ✅ Successfully renamed to: "${preMessageName}"`);

      // Verify the rename
      const sessionAfterRename = await adapter.getSession(client, validateSessionId(sessionId));
      console.log(
        `   📝 Session title after rename: "${sessionAfterRename.title || '(no title)'}"`
      );

      if (sessionAfterRename.title === preMessageName) {
        console.log('   ✅ VERIFIED: Rename worked before sending a message!');
      } else {
        console.log('   ⚠️  WARNING: Rename appeared to succeed but title did not update');
      }
    } catch (error) {
      console.log(
        `   ❌ Failed to rename: ${error instanceof Error ? error.message : String(error)}`
      );
      console.log('   ℹ️  This suggests rename requires a message to be sent first');
    }
    console.log('');

    // 4. Send a message
    console.log('4️⃣  Sending a message to the session...');
    const prompt = 'Hello! This is a test message.';
    console.log(`   💬 Prompt: "${prompt}"`);
    console.log('   🔄 Streaming response...');

    let fullResponse = '';
    const responseIterator = adapter.sendPrompt(
      client,
      validateSessionId(sessionId),
      prompt,
      model
    );

    for await (const chunk of responseIterator) {
      if (chunk.content) {
        fullResponse += chunk.content;
      }
    }

    console.log(`   ✅ Message sent and response received (${fullResponse.length} chars)`);
    console.log('');

    // 5. Try to rename AFTER sending a message
    console.log('5️⃣  Attempting to rename session AFTER sending a message...');
    const postMessageName = 'Test Session - After Message';
    try {
      await adapter.renameSession(client, sessionId, postMessageName);
      console.log(`   ✅ Successfully renamed to: "${postMessageName}"`);

      // Verify the rename
      const sessionAfterRename2 = await adapter.getSession(client, validateSessionId(sessionId));
      console.log(
        `   📝 Session title after rename: "${sessionAfterRename2.title || '(no title)'}"`
      );

      if (sessionAfterRename2.title === postMessageName) {
        console.log('   ✅ VERIFIED: Rename worked after sending a message!');
      } else {
        console.log('   ⚠️  WARNING: Rename appeared to succeed but title did not update');
      }
    } catch (error) {
      console.log(
        `   ❌ Failed to rename: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    console.log('');

    // 6. Get all sessions
    console.log('6️⃣  Getting all sessions to verify rename...');
    const allSessions = await adapter.listSessions(client);
    console.log(`   ✅ Found ${allSessions.length} session(s)`);
    console.log('');

    const ourSession = allSessions.find((s) => s.id === sessionId);
    if (ourSession) {
      console.log('   📋 Our session in the list:');
      console.log(`      ID: ${ourSession.id}`);
      console.log(`      Title: "${ourSession.title || '(no title)'}"`);

      if (ourSession.title === postMessageName) {
        console.log('   ✅ VERIFIED: Session title is correct in list!');
      } else if (ourSession.title === preMessageName) {
        console.log('   ⚠️  WARNING: Session still has pre-message name');
      } else {
        console.log(`   ⚠️  WARNING: Session has unexpected title: "${ourSession.title}"`);
      }
    } else {
      console.log('   ❌ ERROR: Could not find our session in the list!');
    }
    console.log('');

    // 7. Fetch the session name directly
    console.log('7️⃣  Fetching session name directly...');
    try {
      const sessionInfo = await adapter.getSession(client, validateSessionId(sessionId));
      console.log(`   ✅ Session fetched: ${sessionInfo.id}`);
      console.log(`   📝 Title: "${sessionInfo.title || '(no title)'}"`);

      if (sessionInfo.title === postMessageName) {
        console.log('   ✅ VERIFIED: Direct fetch shows correct name!');
      } else {
        console.log(`   ⚠️  WARNING: Direct fetch shows: "${sessionInfo.title}"`);
      }
    } catch (error) {
      console.log(
        `   ❌ Failed to fetch session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    console.log('');

    // Summary
    console.log('═'.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(80));
    console.log('');

    const finalSession = await adapter.getSession(client, validateSessionId(sessionId));
    console.log(`Session ID: ${sessionId}`);
    console.log(`Final Title: "${finalSession.title || '(no title)'}"`);
    console.log('');

    if (finalSession.title === postMessageName) {
      console.log('✅ CONCLUSION: Session rename works!');
      console.log('   The session can be renamed both before and after sending messages.');
    } else if (finalSession.title === preMessageName) {
      console.log('⚠️  CONCLUSION: Rename may require a message to be sent first.');
      console.log(
        '   The first rename (before message) worked, but post-message rename may have failed.'
      );
    } else {
      console.log('❓ CONCLUSION: Inconclusive results.');
      console.log(`   Final title: "${finalSession.title}"`);
    }
    console.log('');

    // Clean up
    console.log('8️⃣  Cleaning up...');
    if (sessionId) {
      await adapter.deleteSession(client, validateSessionId(sessionId));
      console.log('   ✅ Session deleted');
    }
    if (client) {
      await adapter.closeClient(client);
      console.log('   ✅ Client closed');
    }
    console.log('');

    console.log('✨ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('\nError details:', error instanceof Error ? error.stack : error);

    // Cleanup on error
    try {
      if (sessionId && client) {
        await adapter.deleteSession(client, validateSessionId(sessionId));
      }
      if (client) {
        await adapter.closeClient(client);
      }
    } catch (cleanupError) {
      console.error('Failed to cleanup:', cleanupError);
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
