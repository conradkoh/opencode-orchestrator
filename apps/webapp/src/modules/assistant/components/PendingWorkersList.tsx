'use client';

import { CheckIcon, ClockIcon, XIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApproveWorker } from '../hooks/useApproveWorker';
import { usePendingWorkers } from '../hooks/usePendingWorkers';
import { useRejectWorker } from '../hooks/useRejectWorker';

/**
 * Props for PendingWorkersList component.
 */
export interface PendingWorkersListProps {
  /** Machine ID to show pending workers for */
  machineId: string;
}

/**
 * Component that displays pending worker authorization requests.
 * Shows a list of workers waiting for approval with approve/reject actions.
 *
 * @example
 * ```typescript
 * <PendingWorkersList machineId="machine_abc123" />
 * ```
 */
export function PendingWorkersList({ machineId }: PendingWorkersListProps) {
  const { workers, loading } = usePendingWorkers(machineId);
  const { approveWorker, isApproving } = useApproveWorker();
  const { rejectWorker, isRejecting } = useRejectWorker();
  const [workerToReject, setWorkerToReject] = useState<string | null>(null);

  const handleApprove = useCallback(
    async (workerId: string) => {
      try {
        await approveWorker(workerId);
      } catch (error) {
        console.error('Failed to approve worker:', error);
        // Error is handled by the useApproveWorker hook
      }
    },
    [approveWorker]
  );

  const handleRejectClick = useCallback((workerId: string) => {
    setWorkerToReject(workerId);
  }, []);

  const handleRejectConfirm = useCallback(async () => {
    if (!workerToReject) return;

    try {
      await rejectWorker(workerToReject);
      setWorkerToReject(null);
    } catch (error) {
      console.error('Failed to reject worker:', error);
      // Error is handled by the useRejectWorker hook
    }
  }, [workerToReject, rejectWorker]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Authorizations</CardTitle>
          <CardDescription>Workers waiting for approval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!workers || workers.length === 0) {
    return null; // Don't show the card if there are no pending workers
  }

  return (
    <>
      <Card className="border-orange-200 dark:border-orange-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            Pending Authorizations
          </CardTitle>
          <CardDescription>
            {workers.length} {workers.length === 1 ? 'worker' : 'workers'} waiting for approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
            <AlertDescription className="text-orange-800 dark:text-orange-200 text-sm">
              These workers are waiting for your approval before they can start. Approve them to
              allow them to connect and process tasks.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            {workers.map((worker) => (
              <div
                key={worker.workerId}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">
                      {worker.name || `Worker ${worker.workerId.slice(0, 8)}...`}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-300">
                      <ClockIcon className="h-3 w-3" />
                      Pending
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Worker ID: <code className="text-xs">{worker.workerId}</code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested: {new Date(worker.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleApprove(worker.workerId)}
                    disabled={isApproving || isRejecting}
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                  >
                    <CheckIcon className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRejectClick(worker.workerId)}
                    disabled={isApproving || isRejecting}
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  >
                    <XIcon className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!workerToReject}
        onOpenChange={(open) => !open && setWorkerToReject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Worker</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this worker? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRejecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              disabled={isRejecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRejecting ? 'Rejecting...' : 'Reject Worker'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
