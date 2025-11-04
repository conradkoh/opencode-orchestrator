import type { ChatSessionId, OpencodeSessionId } from '@workspace/backend/convex/types/sessionIds';
import { describe, expect, it } from 'vitest';
import {
  type ConvexSession,
  calculateSyncPlan,
  type OpencodeSession,
  validateIdempotency,
} from './OpencodeConvexSync';

describe('OpencodeConvexSync', () => {
  describe('calculateSyncPlan', () => {
    it('should return empty plan when states are in sync', () => {
      const opencode: OpencodeSession[] = [
        { id: 'oc-1', title: 'Session 1' },
        { id: 'oc-2', title: 'Session 2' },
      ];

      const convex: ConvexSession[] = [
        {
          chatSessionId: 'chat-1' as ChatSessionId,
          opencodeSessionId: 'oc-1' as OpencodeSessionId,
          name: 'Session 1',
        },
        {
          chatSessionId: 'chat-2' as ChatSessionId,
          opencodeSessionId: 'oc-2' as OpencodeSessionId,
          name: 'Session 2',
        },
      ];

      const plan = calculateSyncPlan(opencode, convex);

      expect(plan.nameUpdates).toHaveLength(0);
      expect(plan.deletions).toHaveLength(0);
      expect(plan.newSessions).toHaveLength(0);
    });

    it('should detect name updates when titles differ', () => {
      const opencode: OpencodeSession[] = [{ id: 'oc-1', title: 'Updated Session 1' }];

      const convex: ConvexSession[] = [
        {
          chatSessionId: 'chat-1' as ChatSessionId,
          opencodeSessionId: 'oc-1' as OpencodeSessionId,
          name: 'Old Session 1',
        },
      ];

      const plan = calculateSyncPlan(opencode, convex);

      expect(plan.nameUpdates).toHaveLength(1);
      expect(plan.nameUpdates[0]).toEqual({
        chatSessionId: 'chat-1',
        newName: 'Updated Session 1',
      });
      expect(plan.deletions).toHaveLength(0);
      expect(plan.newSessions).toHaveLength(0);
    });

    it('should detect deletions when session missing from OpenCode', () => {
      const opencode: OpencodeSession[] = [];

      const convex: ConvexSession[] = [
        {
          chatSessionId: 'chat-1' as ChatSessionId,
          opencodeSessionId: 'oc-1' as OpencodeSessionId,
          name: 'Session 1',
        },
      ];

      const plan = calculateSyncPlan(opencode, convex);

      expect(plan.nameUpdates).toHaveLength(0);
      expect(plan.deletions).toHaveLength(1);
      expect(plan.deletions[0]).toEqual({
        chatSessionId: 'chat-1',
      });
      expect(plan.newSessions).toHaveLength(0);
    });

    it('should NOT mark already deleted sessions for deletion again', () => {
      const opencode: OpencodeSession[] = [];

      const convex: ConvexSession[] = [
        {
          chatSessionId: 'chat-1' as ChatSessionId,
          opencodeSessionId: 'oc-1' as OpencodeSessionId,
          name: 'Session 1',
          deletedInOpencode: true, // Already marked as deleted
        },
      ];

      const plan = calculateSyncPlan(opencode, convex);

      expect(plan.deletions).toHaveLength(0); // Should not re-delete
    });

    it('should detect new sessions in OpenCode', () => {
      const opencode: OpencodeSession[] = [{ id: 'oc-new', title: 'New Session' }];

      const convex: ConvexSession[] = [];

      const plan = calculateSyncPlan(opencode, convex);

      expect(plan.nameUpdates).toHaveLength(0);
      expect(plan.deletions).toHaveLength(0);
      expect(plan.newSessions).toHaveLength(1);
      expect(plan.newSessions[0]).toEqual({
        opencodeSessionId: 'oc-new',
        title: 'New Session',
      });
    });

    it('should handle complex scenario with all operation types', () => {
      const opencode: OpencodeSession[] = [
        { id: 'oc-1', title: 'Updated Session 1' }, // Name changed
        { id: 'oc-2', title: 'Session 2' }, // No change
        { id: 'oc-new', title: 'New Session' }, // New
        // oc-3 is missing (should be marked deleted)
      ];

      const convex: ConvexSession[] = [
        {
          chatSessionId: 'chat-1' as ChatSessionId,
          opencodeSessionId: 'oc-1' as OpencodeSessionId,
          name: 'Old Session 1',
        },
        {
          chatSessionId: 'chat-2' as ChatSessionId,
          opencodeSessionId: 'oc-2' as OpencodeSessionId,
          name: 'Session 2',
        },
        {
          chatSessionId: 'chat-3' as ChatSessionId,
          opencodeSessionId: 'oc-3' as OpencodeSessionId,
          name: 'Session 3',
        },
      ];

      const plan = calculateSyncPlan(opencode, convex);

      expect(plan.nameUpdates).toHaveLength(1);
      expect(plan.nameUpdates[0].chatSessionId).toBe('chat-1');

      expect(plan.deletions).toHaveLength(1);
      expect(plan.deletions[0].chatSessionId).toBe('chat-3');

      expect(plan.newSessions).toHaveLength(1);
      expect(plan.newSessions[0].opencodeSessionId).toBe('oc-new');
    });
  });

  describe('validateIdempotency', () => {
    it('should validate that applying plan makes it idempotent', () => {
      const opencode: OpencodeSession[] = [{ id: 'oc-1', title: 'Updated Session 1' }];

      const convex: ConvexSession[] = [
        {
          chatSessionId: 'chat-1' as ChatSessionId,
          opencodeSessionId: 'oc-1' as OpencodeSessionId,
          name: 'Old Session 1',
        },
      ];

      const plan = calculateSyncPlan(opencode, convex);

      // Should be idempotent
      const isIdempotent = validateIdempotency(plan, opencode, convex);
      expect(isIdempotent).toBe(true);
    });

    it('should validate idempotency for multiple operations', () => {
      const opencode: OpencodeSession[] = [
        { id: 'oc-1', title: 'Updated' },
        { id: 'oc-new', title: 'New' },
      ];

      const convex: ConvexSession[] = [
        {
          chatSessionId: 'chat-1' as ChatSessionId,
          opencodeSessionId: 'oc-1' as OpencodeSessionId,
          name: 'Old',
        },
        {
          chatSessionId: 'chat-deleted' as ChatSessionId,
          opencodeSessionId: 'oc-deleted' as OpencodeSessionId,
          name: 'To Delete',
        },
      ];

      const plan = calculateSyncPlan(opencode, convex);

      // After applying the plan, recalculating should produce empty plan
      const isIdempotent = validateIdempotency(plan, opencode, convex);
      expect(isIdempotent).toBe(true);
    });
  });

  describe('Idempotency edge cases', () => {
    it('should be idempotent when run multiple times with same state', () => {
      const opencode: OpencodeSession[] = [{ id: 'oc-1', title: 'Session 1' }];

      const convex: ConvexSession[] = [
        {
          chatSessionId: 'chat-1' as ChatSessionId,
          opencodeSessionId: 'oc-1' as OpencodeSessionId,
          name: 'Old Name',
        },
      ];

      // First sync
      const plan1 = calculateSyncPlan(opencode, convex);
      expect(plan1.nameUpdates).toHaveLength(1);

      // Simulate applying the plan
      convex[0].name = 'Session 1';

      // Second sync should be empty
      const plan2 = calculateSyncPlan(opencode, convex);
      expect(plan2.nameUpdates).toHaveLength(0);
      expect(plan2.deletions).toHaveLength(0);
      expect(plan2.newSessions).toHaveLength(0);

      // Third sync should also be empty
      const plan3 = calculateSyncPlan(opencode, convex);
      expect(plan3.nameUpdates).toHaveLength(0);
    });
  });
});
