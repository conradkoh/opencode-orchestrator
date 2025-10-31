'use client';

import { useEffect, useState } from 'react';
import type { AssistantsData } from '../types';
import { formatAssistantDisplayName } from '../utils/assistantFormatter';

/**
 * Mock hook for fetching assistants.
 * Can optionally filter by machine ID.
 * TODO: Replace with actual Convex query using useSessionQuery
 *
 * @param machineId - Optional machine ID to filter assistants by
 * @returns AssistantsData containing assistants array, loading state, and error
 * @example
 * ```typescript
 * // Get all assistants
 * const { assistants, loading } = useAssistants();
 *
 * // Get assistants for a specific machine
 * const { assistants } = useAssistants("machine_001");
 * ```
 */
export function useAssistants(machineId?: string): AssistantsData {
  const [assistants, setAssistants] = useState<AssistantsData['assistants']>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      // Mock data
      const allAssistants = [
        {
          assistantId: 'assistant_001',
          machineId: 'machine_001',
          machineName: 'MacBook Pro',
          workingDirectory: '/Users/dev/projects/my-app',
          displayName: formatAssistantDisplayName('MacBook Pro', '/Users/dev/projects/my-app'),
          status: 'online' as const,
          activeSessionCount: 0,
          availableModels: ['claude-sonnet-4-5', 'claude-opus-4', 'gpt-4'],
        },
        {
          assistantId: 'assistant_002',
          machineId: 'machine_001',
          machineName: 'MacBook Pro',
          workingDirectory: '/Users/dev/projects/backend-api',
          displayName: formatAssistantDisplayName('MacBook Pro', '/Users/dev/projects/backend-api'),
          status: 'online' as const,
          activeSessionCount: 1,
          availableModels: ['claude-sonnet-4-5', 'claude-opus-4'],
        },
        {
          assistantId: 'assistant_003',
          machineId: 'machine_002',
          machineName: 'Desktop PC',
          workingDirectory: 'C:/Projects/opencode-orchestrator',
          displayName: formatAssistantDisplayName(
            'Desktop PC',
            'C:/Projects/opencode-orchestrator'
          ),
          status: 'offline' as const,
          activeSessionCount: 0,
          availableModels: ['claude-sonnet-4-5'],
        },
      ];

      // Filter by machineId if provided
      const filtered = machineId
        ? allAssistants.filter((a) => a.machineId === machineId)
        : allAssistants;

      setAssistants(filtered);
      setLoading(false);
    }, 300);
  }, [machineId]);

  return {
    assistants,
    loading,
    error: null,
  };
}
