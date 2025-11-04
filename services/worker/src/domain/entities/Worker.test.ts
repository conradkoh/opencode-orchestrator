import { describe, expect, it } from 'vitest';
import { Session } from './Session';
import type { WorkerEntityConfig } from './Worker';
import { Worker } from './Worker';

describe('Worker Entity', () => {
  describe('create', () => {
    it('should create a valid worker with all fields', () => {
      const config: WorkerEntityConfig = {
        id: 'worker_123',
        machineId: 'machine_456',
        directory: '/path/to/project',
      };

      const worker = Worker.create(config);

      expect(worker.id).toBe('worker_123');
      expect(worker.machineId).toBe('machine_456');
      expect(worker.directory).toBe('/path/to/project');
      expect(worker.sessions.size).toBe(0);
    });

    it('should throw error for invalid worker ID', () => {
      const config: WorkerEntityConfig = {
        id: '',
        machineId: 'machine_456',
        directory: '/path/to/project',
      };

      expect(() => Worker.create(config)).toThrow('Invalid Worker ID');
    });

    it('should throw error for invalid machine ID', () => {
      const config: WorkerEntityConfig = {
        id: 'worker_123',
        machineId: '',
        directory: '/path/to/project',
      };

      expect(() => Worker.create(config)).toThrow('Invalid Machine ID');
    });

    it('should throw error for empty directory', () => {
      const config: WorkerEntityConfig = {
        id: 'worker_123',
        machineId: 'machine_456',
        directory: '',
      };

      expect(() => Worker.create(config)).toThrow('Worker directory must be a non-empty string');
    });
  });

  describe('addSession', () => {
    it('should add a valid session', () => {
      const worker = Worker.create({
        id: 'worker_123',
        machineId: 'machine_456',
        directory: '/path/to/project',
      });

      const session = Session.create({
        id: 'session_001',
        workerId: 'worker_123',
        model: 'claude-sonnet-4-5',
      });

      worker.addSession(session);

      expect(worker.sessions.size).toBe(1);
      expect(worker.getSession('session_001' as any)).toBe(session);
    });

    it('should throw error when adding session with different worker ID', () => {
      const worker = Worker.create({
        id: 'worker_123',
        machineId: 'machine_456',
        directory: '/path/to/project',
      });

      const session = Session.create({
        id: 'session_001',
        workerId: 'worker_999', // Different worker
        model: 'claude-sonnet-4-5',
      });

      expect(() => worker.addSession(session)).toThrow(
        'Session session_001 belongs to worker worker_999, not worker_123'
      );
    });

    it('should throw error when adding duplicate session', () => {
      const worker = Worker.create({
        id: 'worker_123',
        machineId: 'machine_456',
        directory: '/path/to/project',
      });

      const session1 = Session.create({
        id: 'session_001',
        workerId: 'worker_123',
        model: 'claude-sonnet-4-5',
      });

      const session2 = Session.create({
        id: 'session_001',
        workerId: 'worker_123',
        model: 'gpt-4',
      });

      worker.addSession(session1);

      expect(() => worker.addSession(session2)).toThrow(
        'Session session_001 already exists in worker worker_123'
      );
    });

    it('should allow multiple different sessions', () => {
      const worker = Worker.create({
        id: 'worker_123',
        machineId: 'machine_456',
        directory: '/path/to/project',
      });

      const session1 = Session.create({
        id: 'session_001',
        workerId: 'worker_123',
        model: 'claude-sonnet-4-5',
      });

      const session2 = Session.create({
        id: 'session_002',
        workerId: 'worker_123',
        model: 'gpt-4',
      });

      worker.addSession(session1);
      worker.addSession(session2);

      expect(worker.sessions.size).toBe(2);
    });
  });

  describe('removeSession', () => {
    it('should remove an existing session', () => {
      const worker = Worker.create({
        id: 'worker_123',
        machineId: 'machine_456',
        directory: '/path/to/project',
      });

      const session = Session.create({
        id: 'session_001',
        workerId: 'worker_123',
        model: 'claude-sonnet-4-5',
      });

      worker.addSession(session);
      expect(worker.sessions.size).toBe(1);

      worker.removeSession('session_001' as any);
      expect(worker.sessions.size).toBe(0);
    });

    it('should be idempotent when removing non-existent session', () => {
      const worker = Worker.create({
        id: 'worker_123',
        machineId: 'machine_456',
        directory: '/path/to/project',
      });

      worker.removeSession('session_999' as any);
      expect(worker.sessions.size).toBe(0);
    });
  });

  describe('getSession', () => {
    it('should return session if it exists', () => {
      const worker = Worker.create({
        id: 'worker_123',
        machineId: 'machine_456',
        directory: '/path/to/project',
      });

      const session = Session.create({
        id: 'session_001',
        workerId: 'worker_123',
        model: 'claude-sonnet-4-5',
      });

      worker.addSession(session);

      const retrieved = worker.getSession('session_001' as any);
      expect(retrieved).toBe(session);
    });

    it('should return undefined if session does not exist', () => {
      const worker = Worker.create({
        id: 'worker_123',
        machineId: 'machine_456',
        directory: '/path/to/project',
      });

      const retrieved = worker.getSession('session_999' as any);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getSessionCount', () => {
    it('should return total count when no status filter', () => {
      const worker = Worker.create({
        id: 'worker_123',
        machineId: 'machine_456',
        directory: '/path/to/project',
      });

      worker.addSession(
        Session.create({
          id: 'session_001',
          workerId: 'worker_123',
          model: 'claude-sonnet-4-5',
          status: 'active',
        })
      );

      worker.addSession(
        Session.create({
          id: 'session_002',
          workerId: 'worker_123',
          model: 'gpt-4',
          status: 'idle',
        })
      );

      expect(worker.getSessionCount()).toBe(2);
    });

    it('should return count of active sessions', () => {
      const worker = Worker.create({
        id: 'worker_123',
        machineId: 'machine_456',
        directory: '/path/to/project',
      });

      worker.addSession(
        Session.create({
          id: 'session_001',
          workerId: 'worker_123',
          model: 'claude-sonnet-4-5',
          status: 'active',
        })
      );

      worker.addSession(
        Session.create({
          id: 'session_002',
          workerId: 'worker_123',
          model: 'gpt-4',
          status: 'active',
        })
      );

      worker.addSession(
        Session.create({
          id: 'session_003',
          workerId: 'worker_123',
          model: 'claude-opus-4',
          status: 'idle',
        })
      );

      expect(worker.getSessionCount('active')).toBe(2);
    });

    it('should return count of idle sessions', () => {
      const worker = Worker.create({
        id: 'worker_123',
        machineId: 'machine_456',
        directory: '/path/to/project',
      });

      worker.addSession(
        Session.create({
          id: 'session_001',
          workerId: 'worker_123',
          model: 'claude-sonnet-4-5',
          status: 'active',
        })
      );

      worker.addSession(
        Session.create({
          id: 'session_002',
          workerId: 'worker_123',
          model: 'gpt-4',
          status: 'idle',
        })
      );

      expect(worker.getSessionCount('idle')).toBe(1);
    });

    it('should return 0 for workers with no sessions', () => {
      const worker = Worker.create({
        id: 'worker_123',
        machineId: 'machine_456',
        directory: '/path/to/project',
      });

      expect(worker.getSessionCount()).toBe(0);
      expect(worker.getSessionCount('active')).toBe(0);
    });
  });
});
