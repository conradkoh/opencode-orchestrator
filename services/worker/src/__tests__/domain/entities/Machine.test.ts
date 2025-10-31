import { describe, expect, it } from 'vitest';
import type { MachineConfig } from '../../../domain/entities/Machine';
import { Machine } from '../../../domain/entities/Machine';
import { Session } from '../../../domain/entities/Session';
import { Worker } from '../../../domain/entities/Worker';

describe('Machine Entity', () => {
  describe('create', () => {
    it('should create a valid machine with all fields', () => {
      const config: MachineConfig = {
        id: 'machine_123',
        secret: 'secret_456',
        rootDirectory: '/path/to/root',
        status: 'online',
      };

      const machine = Machine.create(config);

      expect(machine.id).toBe('machine_123');
      expect(machine.secret).toBe('secret_456');
      expect(machine.rootDirectory).toBe('/path/to/root');
      expect(machine.status).toBe('online');
      expect(machine.workers.size).toBe(0);
    });

    it('should default status to offline if not provided', () => {
      const config: MachineConfig = {
        id: 'machine_123',
        secret: 'secret_456',
        rootDirectory: '/path/to/root',
      };

      const machine = Machine.create(config);

      expect(machine.status).toBe('offline');
    });

    it('should throw error for invalid machine ID', () => {
      const config: MachineConfig = {
        id: '',
        secret: 'secret_456',
        rootDirectory: '/path/to/root',
      };

      expect(() => Machine.create(config)).toThrow('Invalid Machine ID');
    });

    it('should throw error for invalid machine secret', () => {
      const config: MachineConfig = {
        id: 'machine_123',
        secret: '',
        rootDirectory: '/path/to/root',
      };

      expect(() => Machine.create(config)).toThrow('Invalid Machine Secret');
    });

    it('should throw error for empty root directory', () => {
      const config: MachineConfig = {
        id: 'machine_123',
        secret: 'secret_456',
        rootDirectory: '',
      };

      expect(() => Machine.create(config)).toThrow(
        'Machine root directory must be a non-empty string'
      );
    });
  });

  describe('getToken', () => {
    it('should return machine token', () => {
      const machine = Machine.create({
        id: 'machine_123',
        secret: 'secret_456',
        rootDirectory: '/path/to/root',
      });

      const token = machine.getToken();

      expect(token.toString()).toBe('machine_123:secret_456');
      expect(token.getMachineId()).toBe('machine_123');
      expect(token.getSecret()).toBe('secret_456');
    });
  });

  describe('isOnline', () => {
    it('should return true when status is online', () => {
      const machine = Machine.create({
        id: 'machine_123',
        secret: 'secret_456',
        rootDirectory: '/path/to/root',
        status: 'online',
      });

      expect(machine.isOnline()).toBe(true);
    });

    it('should return false when status is offline', () => {
      const machine = Machine.create({
        id: 'machine_123',
        secret: 'secret_456',
        rootDirectory: '/path/to/root',
        status: 'offline',
      });

      expect(machine.isOnline()).toBe(false);
    });
  });

  describe('setOnline and setOffline', () => {
    it('should set status to online', () => {
      const machine = Machine.create({
        id: 'machine_123',
        secret: 'secret_456',
        rootDirectory: '/path/to/root',
        status: 'offline',
      });

      machine.setOnline();

      expect(machine.status).toBe('online');
      expect(machine.isOnline()).toBe(true);
    });

    it('should set status to offline', () => {
      const machine = Machine.create({
        id: 'machine_123',
        secret: 'secret_456',
        rootDirectory: '/path/to/root',
        status: 'online',
      });

      machine.setOffline();

      expect(machine.status).toBe('offline');
      expect(machine.isOnline()).toBe(false);
    });
  });

  describe('addWorker', () => {
    it('should add a valid worker', () => {
      const machine = Machine.create({
        id: 'machine_123',
        secret: 'secret_456',
        rootDirectory: '/path/to/root',
      });

      const worker = Worker.create({
        id: 'worker_001',
        machineId: 'machine_123',
        directory: '/path/to/project',
      });

      machine.addWorker(worker);

      expect(machine.workers.size).toBe(1);
      expect(machine.getWorker('worker_001' as any)).toBe(worker);
    });

    it('should throw error when adding worker with different machine ID', () => {
      const machine = Machine.create({
        id: 'machine_123',
        secret: 'secret_456',
        rootDirectory: '/path/to/root',
      });

      const worker = Worker.create({
        id: 'worker_001',
        machineId: 'machine_999', // Different machine
        directory: '/path/to/project',
      });

      expect(() => machine.addWorker(worker)).toThrow(
        'Worker worker_001 belongs to machine machine_999, not machine_123'
      );
    });

    it('should throw error when adding duplicate worker', () => {
      const machine = Machine.create({
        id: 'machine_123',
        secret: 'secret_456',
        rootDirectory: '/path/to/root',
      });

      const worker1 = Worker.create({
        id: 'worker_001',
        machineId: 'machine_123',
        directory: '/path/to/project1',
      });

      const worker2 = Worker.create({
        id: 'worker_001',
        machineId: 'machine_123',
        directory: '/path/to/project2',
      });

      machine.addWorker(worker1);

      expect(() => machine.addWorker(worker2)).toThrow(
        'Worker worker_001 already exists in machine machine_123'
      );
    });
  });

  describe('getActiveSessionCount', () => {
    it('should return total active sessions across all workers', () => {
      const machine = Machine.create({
        id: 'machine_123',
        secret: 'secret_456',
        rootDirectory: '/path/to/root',
      });

      const worker1 = Worker.create({
        id: 'worker_001',
        machineId: 'machine_123',
        directory: '/path/to/project1',
      });

      const worker2 = Worker.create({
        id: 'worker_002',
        machineId: 'machine_123',
        directory: '/path/to/project2',
      });

      worker1.addSession(
        Session.create({
          id: 'session_001',
          workerId: 'worker_001',
          model: 'claude-sonnet-4-5',
          status: 'active',
        })
      );

      worker1.addSession(
        Session.create({
          id: 'session_002',
          workerId: 'worker_001',
          model: 'gpt-4',
          status: 'idle',
        })
      );

      worker2.addSession(
        Session.create({
          id: 'session_003',
          workerId: 'worker_002',
          model: 'claude-opus-4',
          status: 'active',
        })
      );

      machine.addWorker(worker1);
      machine.addWorker(worker2);

      expect(machine.getActiveSessionCount()).toBe(2);
    });

    it('should return 0 for machine with no workers', () => {
      const machine = Machine.create({
        id: 'machine_123',
        secret: 'secret_456',
        rootDirectory: '/path/to/root',
      });

      expect(machine.getActiveSessionCount()).toBe(0);
    });
  });
});
