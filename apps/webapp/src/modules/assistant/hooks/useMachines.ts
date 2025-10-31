'use client';

import { useEffect, useState } from 'react';
import type { MachinesData } from '../types';

/**
 * Flag to control whether to show empty state UI for testing.
 * Set to true to test the empty state component.
 */
const _SHOW_EMPTY_STATE = false;

/**
 * Mock hook for fetching machines for the current user.
 * TODO: Replace with actual Convex query using useSessionQuery
 *
 * @returns MachinesData containing machines array, loading state, and error
 * @example
 * ```typescript
 * const { machines, loading, error } = useMachines();
 * if (loading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 * return <MachineList machines={machines} />;
 * ```
 */
export function useMachines(): MachinesData {
  const [machines, setMachines] = useState<MachinesData['machines']>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      if (_SHOW_EMPTY_STATE) {
        setMachines([]);
      } else {
        setMachines([
          {
            machineId: 'machine_001',
            name: 'MacBook Pro',
            status: 'online',
            lastSeen: Date.now() - 5000,
            assistantCount: 2,
          },
          {
            machineId: 'machine_002',
            name: 'Desktop PC',
            status: 'offline',
            lastSeen: Date.now() - 3600000,
            assistantCount: 1,
          },
        ]);
      }
      setLoading(false);
    }, 500);
  }, []);

  return {
    machines,
    loading,
    error: null,
  };
}

/**
 * Mock hook with sample data for development.
 * Alternative hook for testing with machines present.
 * Switch to this to test with machines present.
 *
 * @returns MachinesData containing sample machines
 */
export function useMachinesWithData(): MachinesData {
  const [machines, setMachines] = useState<MachinesData['machines']>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setMachines([
        {
          machineId: 'machine_001',
          name: 'MacBook Pro',
          status: 'online',
          lastSeen: Date.now() - 5000,
          assistantCount: 2,
        },
        {
          machineId: 'machine_002',
          name: 'Desktop PC',
          status: 'offline',
          lastSeen: Date.now() - 3600000,
          assistantCount: 1,
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  return {
    machines,
    loading,
    error: null,
  };
}
