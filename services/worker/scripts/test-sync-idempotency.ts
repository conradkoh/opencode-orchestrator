#!/usr/bin/env bun

/**
 * Integration test script to verify sync idempotency in realistic scenarios.
 *
 * This script simulates multiple worker restarts with the same data
 * to ensure the sync is truly idempotent.
 */

import type { ChatSessionId, OpencodeSessionId } from '@backend/convex/types/sessionIds';
import {
  type ConvexSession,
  calculateSyncPlan,
  executeSync,
  type OpencodeSession,
  type SyncDependencies,
} from '../src/application/OpencodeConvexSync';

// ============================================================================
// Simulated State
// ============================================================================

const mockOpencodeSessions: OpencodeSession[] = [
  { id: 'oc-1', title: 'Session 1762162810703' },
  { id: 'oc-2', title: 'Session 1762162810138' },
  { id: 'oc-3', title: 'Session 1762162809846' },
  { id: 'oc-new-1', title: 'Brand New Session' },
  { id: 'oc-new-2', title: 'Another New Session' },
];

const mockConvexSessions: ConvexSession[] = [
  {
    chatSessionId: 'chat-1' as ChatSessionId,
    opencodeSessionId: 'oc-1' as OpencodeSessionId,
    name: undefined, // Never synced before
  },
  {
    chatSessionId: 'chat-2' as ChatSessionId,
    opencodeSessionId: 'oc-2' as OpencodeSessionId,
    name: undefined, // Never synced before
  },
  {
    chatSessionId: 'chat-3' as ChatSessionId,
    opencodeSessionId: 'oc-3' as OpencodeSessionId,
    name: 'Old Name For Session 3', // Outdated name
  },
  {
    chatSessionId: 'chat-deleted' as ChatSessionId,
    opencodeSessionId: 'oc-deleted' as OpencodeSessionId,
    name: 'This Was Deleted in OpenCode',
    deletedInOpencode: false,
  },
];

const syncCounter = 0;

// ============================================================================
// Mock Dependencies
// ============================================================================

const mockDeps: SyncDependencies = {
  async fetchOpencodeSessions() {
    return mockOpencodeSessions;
  },

  async fetchConvexSessions() {
    return mockConvexSessions;
  },

  async updateSessionName(chatSessionId: ChatSessionId, name: string) {
    const session = mockConvexSessions.find((s) => s.chatSessionId === chatSessionId);
    if (session) {
      session.name = name;
    }
  },

  async markSessionDeleted(chatSessionId: ChatSessionId) {
    const session = mockConvexSessions.find((s) => s.chatSessionId === chatSessionId);
    if (session) {
      session.deletedInOpencode = true;
    }
  },

  async createSyncedSession(opencodeSessionId: string, title?: string) {
    const newId = `chat-new-${Date.now()}` as ChatSessionId;
    mockConvexSessions.push({
      chatSessionId: newId,
      opencodeSessionId: opencodeSessionId as OpencodeSessionId,
      name: title,
      deletedInOpencode: false,
    });
    return newId;
  },

  async recordSyncTimestamp(timestamp: number) {
    console.log(`📅 Recorded sync timestamp: ${new Date(timestamp).toISOString()}`);
  },
};

// ============================================================================
// Test Scenarios
// ============================================================================

async function runSync(iteration: number) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔄 SYNC ITERATION #${iteration}`);
  console.log('='.repeat(80));

  const result = await executeSync(mockDeps);

  return result;
}

function printState() {
  console.log('\n📊 Current State:');
  console.log(`  OpenCode sessions: ${mockOpencodeSessions.length}`);
  console.log(`  Convex sessions: ${mockConvexSessions.length}`);
  console.log(`  Convex deleted: ${mockConvexSessions.filter((s) => s.deletedInOpencode).length}`);
}

async function main() {
  console.log('🧪 Testing Sync Idempotency\n');
  console.log('This test simulates multiple worker restarts with the same data.');
  console.log('After the first sync, all subsequent syncs should be no-ops.\n');

  printState();

  // First sync - should do a lot of work
  const result1 = await runSync(1);
  console.log('\n📈 First Sync Results:');
  console.log(`  ✓ Name updates: ${result1.nameUpdates}`);
  console.log(`  ✓ Deletions: ${result1.deletions}`);
  console.log(`  ✓ New sessions: ${result1.newSessions}`);
  console.log(`  ✗ Errors: ${result1.errors.length}`);

  if (result1.errors.length > 0) {
    console.error('\n❌ Errors during first sync:');
    result1.errors.forEach((e) => console.error(`  - ${e.operation}: ${e.error}`));
  }

  printState();

  // Second sync - should be a no-op
  const result2 = await runSync(2);
  console.log('\n📈 Second Sync Results:');
  console.log(`  ✓ Name updates: ${result2.nameUpdates}`);
  console.log(`  ✓ Deletions: ${result2.deletions}`);
  console.log(`  ✓ New sessions: ${result2.newSessions}`);

  const isIdempotent =
    result2.nameUpdates === 0 &&
    result2.deletions === 0 &&
    result2.newSessions === 0 &&
    result2.errors.length === 0;

  if (isIdempotent) {
    console.log('\n✅ SUCCESS: Sync is idempotent!');
    console.log('   Running the sync twice produces no changes on the second run.');
  } else {
    console.log('\n❌ FAILURE: Sync is NOT idempotent!');
    console.log('   The second sync still found work to do.');
    process.exit(1);
  }

  // Third sync - just to be sure
  const result3 = await runSync(3);

  const stillIdempotent =
    result3.nameUpdates === 0 && result3.deletions === 0 && result3.newSessions === 0;

  if (stillIdempotent) {
    console.log('\n✅ VERIFIED: Sync remains idempotent on third run!');
  } else {
    console.log('\n❌ REGRESSION: Third sync found work!');
    process.exit(1);
  }

  // Test with no changes
  console.log('\n\n' + '='.repeat(80));
  console.log('🧪 Testing with no changes (simulating immediate restart)');
  console.log('='.repeat(80));

  const result4 = await runSync(4);

  if (result4.nameUpdates === 0 && result4.deletions === 0 && result4.newSessions === 0) {
    console.log('\n✅ PERFECT: Immediate restart also produces no changes!');
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎉 All idempotency tests passed!');
  console.log('='.repeat(80));
}

main().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
