'use client';

import { MoreVerticalIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateWorkerDialog } from './CreateWorkerDialog';

/**
 * Props for WorkerActionMenu component.
 */
export interface WorkerActionMenuProps {
  /** Currently selected machine ID, required to create workers */
  machineId: string | null;
}

/**
 * Action menu component for worker management.
 * Provides actions for creating workers.
 *
 * @example
 * ```typescript
 * <WorkerActionMenu machineId={selectedMachineId} />
 * ```
 */
export function WorkerActionMenu({ machineId }: WorkerActionMenuProps) {
  const [showCreateWorkerDialog, setShowCreateWorkerDialog] = useState(false);

  if (!machineId) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0" title="Worker actions">
            <MoreVerticalIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Workers</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setShowCreateWorkerDialog(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Worker
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkerDialog
        machineId={machineId}
        open={showCreateWorkerDialog}
        onOpenChange={setShowCreateWorkerDialog}
      />
    </>
  );
}
