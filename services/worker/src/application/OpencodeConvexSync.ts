import type { ChatSessionId, OpencodeSessionId } from '@workspace/backend/convex/types/sessionIds';

/**
 * Clean, focused sync component for OpenCode <-> Convex integration.
 *
 * Design Principles:
 * 1. Idempotent - running multiple times produces same result
 * 2. Explicit - each sync operation is clearly defined
 * 3. Testable - pure functions that can be unit tested
 * 4. Simple - no complex conditional logic
 */

// ============================================================================
// Types
// ============================================================================

export interface OpencodeSession {
  id: string;
  title?: string;
}

export interface ConvexSession {
  chatSessionId: ChatSessionId;
  opencodeSessionId?: OpencodeSessionId;
  name?: string;
  deletedInOpencode?: boolean;
}

export interface SyncPlan {
  nameUpdates: Array<{ chatSessionId: ChatSessionId; newName: string }>;
  deletions: Array<{ chatSessionId: ChatSessionId }>;
  newSessions: Array<{ opencodeSessionId: string; title?: string }>;
}

export interface SyncResult {
  nameUpdates: number;
  deletions: number;
  newSessions: number;
  errors: Array<{ operation: string; error: string }>;
}

// ============================================================================
// Core Sync Logic (Pure Functions)
// ============================================================================

/**
 * Calculate what sync operations need to happen.
 * Pure function - no side effects, easy to test.
 */
export function calculateSyncPlan(
  opencodeSessions: OpencodeSession[],
  convexSessions: ConvexSession[]
): SyncPlan {
  const plan: SyncPlan = {
    nameUpdates: [],
    deletions: [],
    newSessions: [],
  };

  // Build lookup maps for efficient searching
  const opencodeById = new Map(opencodeSessions.map((s) => [s.id, s]));
  const convexByOpencodeId = new Map(
    convexSessions.filter((s) => s.opencodeSessionId).map((s) => [s.opencodeSessionId as string, s])
  );

  // 1. Find name updates: sessions exist in both, but names differ
  for (const ocSession of opencodeSessions) {
    const convexSession = convexByOpencodeId.get(ocSession.id);

    if (convexSession && ocSession.title) {
      // Only update if names actually differ
      if (convexSession.name !== ocSession.title) {
        plan.nameUpdates.push({
          chatSessionId: convexSession.chatSessionId,
          newName: ocSession.title,
        });
      }
    }
  }

  // 2. Find deletions: sessions in Convex but not in OpenCode (and not already marked deleted)
  for (const convexSession of convexSessions) {
    if (
      convexSession.opencodeSessionId &&
      !opencodeById.has(convexSession.opencodeSessionId as string) &&
      !convexSession.deletedInOpencode
    ) {
      plan.deletions.push({
        chatSessionId: convexSession.chatSessionId,
      });
    }
  }

  // 3. Find new sessions: sessions in OpenCode but not in Convex
  for (const ocSession of opencodeSessions) {
    if (!convexByOpencodeId.has(ocSession.id)) {
      plan.newSessions.push({
        opencodeSessionId: ocSession.id,
        title: ocSession.title,
      });
    }
  }

  return plan;
}

/**
 * Validate that a sync plan is idempotent.
 * If we apply the plan and recalculate, we should get an empty plan.
 */
export function validateIdempotency(
  plan: SyncPlan,
  opencodeSessions: OpencodeSession[],
  convexSessions: ConvexSession[]
): boolean {
  // Simulate applying the plan
  const updatedConvexSessions = applyPlanToConvexSessions(plan, convexSessions);

  // Recalculate plan with updated state
  const newPlan = calculateSyncPlan(opencodeSessions, updatedConvexSessions);

  // Plan should be empty (no more work to do)
  return (
    newPlan.nameUpdates.length === 0 &&
    newPlan.deletions.length === 0 &&
    newPlan.newSessions.length === 0
  );
}

/**
 * Helper: Simulate applying a plan to Convex sessions (for testing).
 */
function applyPlanToConvexSessions(
  plan: SyncPlan,
  convexSessions: ConvexSession[]
): ConvexSession[] {
  const sessions = [...convexSessions];

  // Apply name updates
  for (const update of plan.nameUpdates) {
    const session = sessions.find((s) => s.chatSessionId === update.chatSessionId);
    if (session) {
      session.name = update.newName;
    }
  }

  // Apply deletions
  for (const deletion of plan.deletions) {
    const session = sessions.find((s) => s.chatSessionId === deletion.chatSessionId);
    if (session) {
      session.deletedInOpencode = true;
    }
  }

  // Apply new sessions (simplified - in reality these would be created in Convex)
  for (const newSession of plan.newSessions) {
    sessions.push({
      chatSessionId: `new-${newSession.opencodeSessionId}` as ChatSessionId,
      opencodeSessionId: newSession.opencodeSessionId as OpencodeSessionId,
      name: newSession.title,
      deletedInOpencode: false,
    });
  }

  return sessions;
}

// ============================================================================
// Sync Executor
// ============================================================================

export interface SyncDependencies {
  fetchOpencodeSessions: () => Promise<OpencodeSession[]>;
  fetchConvexSessions: () => Promise<ConvexSession[]>;
  updateSessionName: (chatSessionId: ChatSessionId, name: string) => Promise<void>;
  markSessionDeleted: (chatSessionId: ChatSessionId) => Promise<void>;
  createSyncedSession: (opencodeSessionId: string, title?: string) => Promise<ChatSessionId>;
  recordSyncTimestamp: (timestamp: number) => Promise<void>;
}

/**
 * Execute a sync plan with real dependencies.
 * Handles errors gracefully and returns detailed results.
 */
export async function executeSync(deps: SyncDependencies): Promise<SyncResult> {
  const result: SyncResult = {
    nameUpdates: 0,
    deletions: 0,
    newSessions: 0,
    errors: [],
  };

  try {
    // Fetch current state
    const [opencodeSessions, convexSessions] = await Promise.all([
      deps.fetchOpencodeSessions(),
      deps.fetchConvexSessions(),
    ]);

    console.log(
      `📊 Sync state: ${opencodeSessions.length} OpenCode sessions, ${convexSessions.length} Convex sessions`
    );

    // Calculate what needs to be done
    const plan = calculateSyncPlan(opencodeSessions, convexSessions);

    const totalOps = plan.nameUpdates.length + plan.deletions.length + plan.newSessions.length;

    if (totalOps === 0) {
      console.log('✅ No changes detected - sync state is stable');
      return result;
    }

    console.log(
      `⚡ Executing ${totalOps} operations: ${plan.nameUpdates.length} name updates, ${plan.deletions.length} deletions, ${plan.newSessions.length} new sessions`
    );

    // Validate idempotency before executing
    if (!validateIdempotency(plan, opencodeSessions, convexSessions)) {
      console.warn('⚠️  WARNING: Sync plan is not idempotent! This should not happen.');
    }

    // Execute all operations in parallel
    const operations: Promise<void>[] = [];

    // Name updates
    for (const update of plan.nameUpdates) {
      operations.push(
        deps
          .updateSessionName(update.chatSessionId, update.newName)
          .then(() => {
            result.nameUpdates++;
            console.log(`📝 Updated: ${update.chatSessionId} → "${update.newName}"`);
          })
          .catch((error) => {
            result.errors.push({
              operation: `updateName:${update.chatSessionId}`,
              error: error instanceof Error ? error.message : String(error),
            });
          })
      );
    }

    // Deletions
    for (const deletion of plan.deletions) {
      operations.push(
        deps
          .markSessionDeleted(deletion.chatSessionId)
          .then(() => {
            result.deletions++;
            console.log(`🗑️  Marked deleted: ${deletion.chatSessionId}`);
          })
          .catch((error) => {
            result.errors.push({
              operation: `markDeleted:${deletion.chatSessionId}`,
              error: error instanceof Error ? error.message : String(error),
            });
          })
      );
    }

    // New sessions
    for (const newSession of plan.newSessions) {
      operations.push(
        deps
          .createSyncedSession(newSession.opencodeSessionId, newSession.title)
          .then((chatSessionId) => {
            result.newSessions++;
            console.log(`🆕 Created: ${chatSessionId} ← ${newSession.opencodeSessionId}`);
          })
          .catch((error) => {
            result.errors.push({
              operation: `createSession:${newSession.opencodeSessionId}`,
              error: error instanceof Error ? error.message : String(error),
            });
          })
      );
    }

    // Wait for all operations
    await Promise.allSettled(operations);

    // Record sync timestamp
    await deps.recordSyncTimestamp(Date.now());

    console.log(
      `✅ Sync complete: ${result.nameUpdates} updated, ${result.deletions} deleted, ${result.newSessions} created, ${result.errors.length} errors`
    );

    return result;
  } catch (error) {
    result.errors.push({
      operation: 'sync',
      error: error instanceof Error ? error.message : String(error),
    });
    return result;
  }
}
