import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionConfig } from '../../../domain/entities/Session';
import { Session } from '../../../domain/entities/Session';

describe('Session Entity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create', () => {
    it('should create a valid session with all fields', () => {
      const config: SessionConfig = {
        id: 'session_123',
        workerId: 'worker_456',
        model: 'claude-sonnet-4-5',
        status: 'active',
        createdAt: 1000,
        lastActivity: 2000,
      };

      const session = Session.create(config);

      expect(session.id).toBe('session_123');
      expect(session.workerId).toBe('worker_456');
      expect(session.model).toBe('claude-sonnet-4-5');
      expect(session.status).toBe('active');
      expect(session.createdAt).toBe(1000);
      expect(session.lastActivity).toBe(2000);
    });

    it('should default status to active if not provided', () => {
      const config: SessionConfig = {
        id: 'session_123',
        workerId: 'worker_456',
        model: 'claude-sonnet-4-5',
      };

      const session = Session.create(config);

      expect(session.status).toBe('active');
    });

    it('should default timestamps to current time if not provided', () => {
      const now = 12345000;
      vi.setSystemTime(now);

      const config: SessionConfig = {
        id: 'session_123',
        workerId: 'worker_456',
        model: 'claude-sonnet-4-5',
      };

      const session = Session.create(config);

      expect(session.createdAt).toBe(now);
      expect(session.lastActivity).toBe(now);
    });

    it('should throw error for invalid session ID', () => {
      const config: SessionConfig = {
        id: '',
        workerId: 'worker_456',
        model: 'claude-sonnet-4-5',
      };

      expect(() => Session.create(config)).toThrow('Invalid Session ID');
    });

    it('should throw error for invalid worker ID', () => {
      const config: SessionConfig = {
        id: 'session_123',
        workerId: '',
        model: 'claude-sonnet-4-5',
      };

      expect(() => Session.create(config)).toThrow('Invalid Worker ID');
    });

    it('should throw error for empty model', () => {
      const config: SessionConfig = {
        id: 'session_123',
        workerId: 'worker_456',
        model: '',
      };

      expect(() => Session.create(config)).toThrow('Session model must be a non-empty string');
    });
  });

  describe('isIdle', () => {
    it('should return false when session is within timeout', () => {
      const now = 10000;
      vi.setSystemTime(now);

      const session = Session.create({
        id: 'session_123',
        workerId: 'worker_456',
        model: 'claude-sonnet-4-5',
        lastActivity: now - 1000, // 1 second ago
      });

      const isIdle = session.isIdle(5000); // 5 second timeout

      expect(isIdle).toBe(false);
    });

    it('should return true when session exceeds timeout', () => {
      const now = 10000;
      vi.setSystemTime(now);

      const session = Session.create({
        id: 'session_123',
        workerId: 'worker_456',
        model: 'claude-sonnet-4-5',
        lastActivity: now - 6000, // 6 seconds ago
      });

      const isIdle = session.isIdle(5000); // 5 second timeout

      expect(isIdle).toBe(true);
    });

    it('should return false for terminated sessions', () => {
      const now = 10000;
      vi.setSystemTime(now);

      const session = Session.create({
        id: 'session_123',
        workerId: 'worker_456',
        model: 'claude-sonnet-4-5',
        status: 'terminated',
        lastActivity: now - 10000, // 10 seconds ago
      });

      const isIdle = session.isIdle(5000); // 5 second timeout

      expect(isIdle).toBe(false);
    });

    it('should handle exact timeout boundary', () => {
      const now = 10000;
      vi.setSystemTime(now);

      const session = Session.create({
        id: 'session_123',
        workerId: 'worker_456',
        model: 'claude-sonnet-4-5',
        lastActivity: now - 5000, // exactly 5 seconds ago
      });

      const isIdle = session.isIdle(5000); // 5 second timeout

      expect(isIdle).toBe(false);
    });
  });

  describe('updateActivity', () => {
    it('should update lastActivity to current time', () => {
      const initialTime = 10000;
      vi.setSystemTime(initialTime);

      const session = Session.create({
        id: 'session_123',
        workerId: 'worker_456',
        model: 'claude-sonnet-4-5',
      });

      expect(session.lastActivity).toBe(initialTime);

      const newTime = 20000;
      vi.setSystemTime(newTime);

      session.updateActivity();

      expect(session.lastActivity).toBe(newTime);
    });

    it('should change status from idle to active when activity is updated', () => {
      const session = Session.create({
        id: 'session_123',
        workerId: 'worker_456',
        model: 'claude-sonnet-4-5',
        status: 'idle',
      });

      expect(session.status).toBe('idle');

      session.updateActivity();

      expect(session.status).toBe('active');
    });

    it('should keep status as active if already active', () => {
      const session = Session.create({
        id: 'session_123',
        workerId: 'worker_456',
        model: 'claude-sonnet-4-5',
        status: 'active',
      });

      session.updateActivity();

      expect(session.status).toBe('active');
    });

    it('should keep status as terminated if terminated', () => {
      const session = Session.create({
        id: 'session_123',
        workerId: 'worker_456',
        model: 'claude-sonnet-4-5',
        status: 'terminated',
      });

      session.updateActivity();

      expect(session.status).toBe('terminated');
    });
  });

  describe('terminate', () => {
    it('should set status to terminated', () => {
      const session = Session.create({
        id: 'session_123',
        workerId: 'worker_456',
        model: 'claude-sonnet-4-5',
        status: 'active',
      });

      session.terminate();

      expect(session.status).toBe('terminated');
    });

    it('should work when called multiple times', () => {
      const session = Session.create({
        id: 'session_123',
        workerId: 'worker_456',
        model: 'claude-sonnet-4-5',
      });

      session.terminate();
      session.terminate();

      expect(session.status).toBe('terminated');
    });
  });
});
