'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * URL state for the app page.
 * Represents the current selection state in query parameters.
 */
export interface AppUrlState {
  /** Selected machine ID */
  machineId: string | null;
  /** Selected worker ID */
  workerId: string | null;
  /** Active session ID */
  sessionId: string | null;
}

/**
 * Actions for updating URL state.
 * All actions follow unidirectional dataflow - they update the URL,
 * which triggers a re-render with new state.
 */
export interface AppUrlStateActions {
  /** Set the selected machine ID and clear worker/session */
  setMachineId: (machineId: string | null) => void;
  /** Set the selected worker ID and clear session */
  setWorkerId: (workerId: string | null) => void;
  /** Set the active session ID */
  setSessionId: (sessionId: string | null) => void;
  /** Clear all selections */
  clearAll: () => void;
}

/**
 * Hook for managing app URL state in a unidirectional way.
 *
 * This hook follows best practices:
 * 1. URL is the single source of truth
 * 2. No useEffect for syncing state (avoids render loops)
 * 3. State is derived directly from URL params
 * 4. Actions update URL, which triggers re-render naturally
 *
 * @returns Current URL state and actions to update it
 *
 * @example
 * ```typescript
 * const { state, actions } = useAppUrlState();
 *
 * // Read state
 * console.log(state.machineId);
 *
 * // Update state (updates URL, triggers re-render)
 * actions.setMachineId('machine-123');
 * ```
 */
export function useAppUrlState(): {
  state: AppUrlState;
  actions: AppUrlStateActions;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive state directly from URL params (single source of truth)
  const state: AppUrlState = useMemo(
    () => ({
      machineId: searchParams.get('machineId'),
      workerId: searchParams.get('workerId'),
      sessionId: searchParams.get('sessionId'),
    }),
    [searchParams]
  );

  /**
   * Helper to update URL params without causing navigation
   */
  const updateParams = useCallback(
    (updates: Partial<Record<string, string | null>>) => {
      const params = new URLSearchParams(searchParams.toString());

      // Apply updates
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      // Update URL without page reload
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(newUrl, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Actions that update URL state
  const actions: AppUrlStateActions = useMemo(
    () => ({
      setMachineId: (machineId: string | null) => {
        // When machine changes, clear worker and session
        updateParams({
          machineId,
          workerId: null,
          sessionId: null,
        });
      },

      setWorkerId: (workerId: string | null) => {
        // When worker changes, clear session
        updateParams({
          workerId,
          sessionId: null,
        });
      },

      setSessionId: (sessionId: string | null) => {
        updateParams({
          sessionId,
        });
      },

      clearAll: () => {
        updateParams({
          machineId: null,
          workerId: null,
          sessionId: null,
        });
      },
    }),
    [updateParams]
  );

  return { state, actions };
}
