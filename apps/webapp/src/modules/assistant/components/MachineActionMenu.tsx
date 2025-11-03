'use client';

import { MoreVerticalIcon, PlusIcon, SettingsIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteMachine } from '../hooks/useDeleteMachine';
import type { Machine } from '../types';
import { CreateMachineDialog } from './CreateMachineDialog';

/**
 * Props for MachineActionMenu component.
 */
export interface MachineActionMenuProps {
  /** Currently selected machine, or null if none selected */
  selectedMachine: Machine | null;
}

/**
 * Action menu component for machine management.
 * Provides actions for creating machines, accessing settings, and deleting machines.
 *
 * @example
 * ```typescript
 * <MachineActionMenu selectedMachine={selectedMachine} />
 * ```
 */
export function MachineActionMenu({ selectedMachine }: MachineActionMenuProps) {
  const router = useRouter();
  const [showCreateMachineDialog, setShowCreateMachineDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const { deleteMachine, isDeleting } = useDeleteMachine();

  /**
   * Opens the delete confirmation dialog.
   */
  const handleDeleteClick = useCallback(() => {
    if (!selectedMachine) return;
    setShowDeleteConfirmDialog(true);
  }, [selectedMachine]);

  /**
   * Handles machine deletion after confirmation.
   */
  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedMachine) return;

    try {
      await deleteMachine(selectedMachine.machineId);
      setShowDeleteConfirmDialog(false);
      router.push('/app');
    } catch (error) {
      console.error('Failed to delete machine:', error);
      // Error is handled by the useDeleteMachine hook
    }
  }, [selectedMachine, deleteMachine, router]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0" title="Machine actions">
            <MoreVerticalIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Machines</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setShowCreateMachineDialog(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Machine
          </DropdownMenuItem>
          {selectedMachine && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>This Machine</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/app/machine/${selectedMachine.machineId}/settings`}>
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2Icon className="h-4 w-4 mr-2" />
                Delete Machine
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateMachineDialog
        open={showCreateMachineDialog}
        onOpenChange={setShowCreateMachineDialog}
      />

      {selectedMachine && (
        <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Machine</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{selectedMachine.name}"? This will remove the
                machine and all its workers. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Delete Machine'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
