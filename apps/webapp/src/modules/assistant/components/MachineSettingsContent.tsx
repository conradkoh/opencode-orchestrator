'use client';

import { Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useDeleteMachine } from '../hooks/useDeleteMachine';
import { useMachines } from '../hooks/useMachines';
import { PendingWorkersList } from './PendingWorkersList';
import { WorkersList } from './WorkersList';

/**
 * Props for MachineSettingsContent component.
 */
export interface MachineSettingsContentProps {
  /** Machine ID to display settings for */
  machineId: string;
}

/**
 * Client component for machine settings page content.
 * Displays machine details and deletion controls.
 *
 * @example
 * ```typescript
 * <MachineSettingsContent machineId="abc123" />
 * ```
 */
export function MachineSettingsContent({ machineId }: MachineSettingsContentProps) {
  const router = useRouter();
  const { machines, loading } = useMachines();
  const { deleteMachine, isDeleting } = useDeleteMachine();
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);

  const machine = useMemo(
    () => machines?.find((m) => m.machineId === machineId),
    [machines, machineId]
  );

  /**
   * Opens the delete confirmation dialog.
   */
  const handleDeleteClick = useCallback(() => {
    if (!machine) return;
    setShowDeleteConfirmDialog(true);
  }, [machine]);

  /**
   * Handles machine deletion after confirmation.
   */
  const handleDeleteConfirm = useCallback(async () => {
    if (!machine) return;

    try {
      await deleteMachine(machineId);
      setShowDeleteConfirmDialog(false);
      router.push('/app');
    } catch (error) {
      console.error('Failed to delete machine:', error);
      // Error is handled by the useDeleteMachine hook
    }
  }, [machine, machineId, deleteMachine, router]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-muted-foreground">Loading machine details...</div>
        </CardContent>
      </Card>
    );
  }

  if (!machine) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center space-y-2">
            <p className="font-medium">Machine not found</p>
            <p className="text-sm text-muted-foreground">
              The machine you're looking for doesn't exist or has been deleted.
            </p>
            <Button variant="outline" asChild className="mt-4">
              <a href="/app">Back to Chat</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Pending Workers */}
        <PendingWorkersList machineId={machineId} />

        {/* All Workers */}
        <WorkersList machineId={machineId} />

        {/* Machine Details */}
        <Card>
          <CardHeader>
            <CardTitle>Machine Details</CardTitle>
            <CardDescription>Information about this machine</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Name</p>
                  <p className="text-sm text-muted-foreground">{machine.name}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Status</p>
                  <Badge
                    variant={machine.status === 'online' ? 'default' : 'secondary'}
                    className="gap-1.5"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        machine.status === 'online'
                          ? 'bg-green-500 dark:bg-green-400'
                          : 'bg-gray-400 dark:bg-gray-500'
                      }`}
                    />
                    {machine.status === 'online' ? 'Online' : 'Offline'}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Workers</p>
                  <p className="text-sm text-muted-foreground">
                    {machine.assistantCount} {machine.assistantCount === 1 ? 'worker' : 'workers'}{' '}
                    registered
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Machine ID</p>
                  <p className="text-xs text-muted-foreground font-mono">{machine.machineId}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Last Seen</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(machine.lastSeen).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50 dark:border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Irreversible actions for this machine</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Delete Machine</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this machine and all its workers. This action cannot be undone.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="shrink-0"
              >
                <Trash2Icon className="h-4 w-4 mr-2" />
                Delete Machine
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {machine && (
        <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Machine</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{machine.name}"? This will remove the machine and
                all its workers. This action cannot be undone.
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
