'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { ChatInterface } from '@/modules/assistant/components/ChatInterface';
import { CreateMachineDialog } from '@/modules/assistant/components/CreateMachineDialog';
import { MachineEmptyState } from '@/modules/assistant/components/MachineEmptyState';
import { useMachines } from '@/modules/assistant/hooks/useMachines';

/**
 * Inner component that uses hooks and renders the main content.
 */
function AppPageContent() {
  const { machines, loading } = useMachines();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  /**
   * Handles opening the create machine dialog.
   */
  const handleCreateMachine = useCallback(() => {
    setShowCreateDialog(true);
  }, []);

  /**
   * Handles closing the create machine dialog.
   */
  const handleDialogChange = useCallback((open: boolean) => {
    setShowCreateDialog(open);
  }, []);

  const hasMachines = useMemo(() => machines && machines.length > 0, [machines]);

  if (loading) {
    return (
      <div className="container mx-auto h-full p-4">
        <div className="flex h-full flex-col gap-4">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="flex-1" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto h-full p-4">
        {!hasMachines ? (
          <MachineEmptyState onCreateMachine={handleCreateMachine} />
        ) : (
          <ChatInterface />
        )}
      </div>

      <CreateMachineDialog open={showCreateDialog} onOpenChange={handleDialogChange} />
    </>
  );
}

/**
 * Main application page for assistant orchestration.
 * Displays empty state if no machines exist, otherwise shows the chat interface.
 *
 * Uses URL query parameters to persist selection state:
 * - ?machineId=xxx - Selected machine
 * - ?workerId=xxx - Selected worker
 * - ?sessionId=xxx - Active session
 *
 * @example
 * This page is automatically rendered at the `/app` route.
 */
export default function AppPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto h-full p-4">
          <div className="flex h-full flex-col gap-4">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="flex-1" />
          </div>
        </div>
      }
    >
      <AppPageContent />
    </Suspense>
  );
}
