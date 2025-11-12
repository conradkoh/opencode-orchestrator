'use client';

import {
  ActivityIcon,
  CheckCircle2Icon,
  CircleIcon,
  ClockIcon,
  FolderIcon,
  Trash2Icon,
  UserIcon,
} from 'lucide-react';
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
import { useRemoveWorker } from '../hooks/useRemoveWorker';
import { useWorkers } from '../hooks/useWorkers';
import type { Worker } from '../types';
import { formatPathToHome } from '../utils/pathFormatter';

/**
 * Props for WorkersList component.
 */
export interface WorkersListProps {
  /** Machine ID to show workers for */
  machineId: string;
  /** Optional callback when worker is removed */
  onWorkerRemoved?: () => void;
  /** Optional callback when add worker button is clicked */
  onAddWorkerClick?: () => void;
}

/**
 * Internal state for tracking which worker is pending removal.
 */
interface _WorkerToRemove {
  /** Worker ID to remove */
  id: string;
  /** Optional worker name for display in confirmation dialog */
  name?: string;
}

/**
 * Internal grouping of workers by status.
 */
interface _GroupedWorkers {
  /** Workers that are active and online */
  active: Worker[];
  /** Workers that are approved but offline */
  offline: Worker[];
  /** Workers pending approval */
  pending: Worker[];
}

/**
 * Internal configuration for worker status display.
 */
interface _StatusConfig {
  /** CSS classes for the badge */
  badge: string;
  /** CSS classes for the status dot */
  dot: string;
  /** Display label for the status */
  label: string;
  /** Icon component to display */
  icon: typeof ActivityIcon | typeof CheckCircle2Icon | typeof CircleIcon | typeof ClockIcon;
}

/**
 * Props for the internal WorkerItem component.
 */
interface _WorkerItemProps {
  /** Worker data to display */
  worker: Worker;
  /** Callback fired when remove button is clicked */
  onRemove: (workerId: string, workerName?: string) => void;
  /** Color scheme for the status indicator */
  statusColor: 'green' | 'gray' | 'orange';
  /** Whether a remove operation is in progress */
  isRemoving: boolean;
}

/**
 * Component that displays all workers for a machine, grouped by status.
 * Shows active, offline, and pending workers in separate sections.
 *
 * @example
 * ```typescript
 * <WorkersList machineId="machine_abc123" />
 * ```
 */
export function WorkersList({ machineId, onWorkerRemoved, onAddWorkerClick }: WorkersListProps) {
  const { workers, loading } = useWorkers(machineId);
  const { removeWorker, isRemoving } = useRemoveWorker();
  const [workerToRemove, setWorkerToRemove] = useState<_WorkerToRemove | null>(null);

  // Group workers by status
  const groupedWorkers = useMemo<_GroupedWorkers>(() => {
    if (!workers) {
      return { active: [], offline: [], pending: [] };
    }

    return {
      active: workers.filter((w) => w.approvalStatus === 'approved' && w.status === 'online'),
      offline: workers.filter((w) => w.approvalStatus === 'approved' && w.status === 'offline'),
      pending: workers.filter((w) => w.approvalStatus === 'pending'),
    };
  }, [workers]);

  /**
   * Handles the remove button click.
   * @param workerId - ID of the worker to remove
   * @param workerName - Optional name of the worker for display
   */
  const handleRemoveClick = useCallback((workerId: string, workerName?: string) => {
    setWorkerToRemove({ id: workerId, name: workerName });
  }, []);

  /**
   * Handles confirming the worker removal.
   */
  const handleRemoveConfirm = useCallback(async () => {
    if (!workerToRemove) return;

    try {
      await removeWorker(workerToRemove.id);
      setWorkerToRemove(null);
      onWorkerRemoved?.();
    } catch (error) {
      console.error('Failed to remove worker:', error);
      // Error is handled by the useRemoveWorker hook
    }
  }, [workerToRemove, removeWorker, onWorkerRemoved]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workers</CardTitle>
          <CardDescription>Loading workers...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const totalWorkers = workers?.length || 0;

  if (totalWorkers === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workers</CardTitle>
          <CardDescription>No workers registered yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 py-6">
            {/* Icon */}
            <div className="rounded-full bg-muted p-3">
              <ActivityIcon className="h-6 w-6 text-muted-foreground" />
            </div>

            {/* Message and Action */}
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                Add a worker to start executing tasks on this machine
              </p>
            </div>

            {/* Button */}
            <Button variant="outline" size="sm" className="shrink-0" onClick={onAddWorkerClick}>
              Add Worker
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Workers</CardTitle>
          <CardDescription>
            {totalWorkers} {totalWorkers === 1 ? 'worker' : 'workers'} registered
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Active Workers */}
          {groupedWorkers.active.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ActivityIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                <h3 className="font-medium text-foreground">
                  Active Workers ({groupedWorkers.active.length})
                </h3>
              </div>
              <div className="space-y-2">
                {groupedWorkers.active.map((worker) => (
                  <_WorkerItem
                    key={worker.workerId}
                    worker={worker}
                    onRemove={handleRemoveClick}
                    statusColor="green"
                    isRemoving={isRemoving}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Separator between sections */}
          {groupedWorkers.active.length > 0 && groupedWorkers.offline.length > 0 && <Separator />}

          {/* Offline Workers */}
          {groupedWorkers.offline.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CircleIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                <h3 className="font-medium text-foreground">
                  Offline Workers ({groupedWorkers.offline.length})
                </h3>
              </div>
              <div className="space-y-2">
                {groupedWorkers.offline.map((worker) => (
                  <_WorkerItem
                    key={worker.workerId}
                    worker={worker}
                    onRemove={handleRemoveClick}
                    statusColor="gray"
                    isRemoving={isRemoving}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Separator between sections */}
          {(groupedWorkers.active.length > 0 || groupedWorkers.offline.length > 0) &&
            groupedWorkers.pending.length > 0 && <Separator />}

          {/* Pending Workers */}
          {groupedWorkers.pending.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <h3 className="font-medium text-foreground">
                  Pending Authorization ({groupedWorkers.pending.length})
                </h3>
              </div>
              <div className="space-y-2">
                {groupedWorkers.pending.map((worker) => (
                  <_WorkerItem
                    key={worker.workerId}
                    worker={worker}
                    onRemove={handleRemoveClick}
                    statusColor="orange"
                    isRemoving={isRemoving}
                  />
                ))}
              </div>
              <div className="text-sm text-muted-foreground">
                💡 Pending workers need to be approved before they can start. Scroll up to approve
                them.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!workerToRemove}
        onOpenChange={(open) => !open && setWorkerToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Worker</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              {workerToRemove?.name || `worker ${workerToRemove?.id.slice(0, 8)}...`}? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? 'Removing...' : 'Remove Worker'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Individual worker item component.
 * Displays worker information including name, status, directory, and controls.
 */
function _WorkerItem({ worker, onRemove, statusColor, isRemoving }: _WorkerItemProps) {
  const statusConfig: Record<'green' | 'gray' | 'orange', _StatusConfig> = useMemo(
    () => ({
      green: {
        badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
        dot: 'bg-green-500 dark:bg-green-400',
        label: worker.status === 'online' ? 'Online' : 'Ready',
        icon: worker.status === 'online' ? ActivityIcon : CheckCircle2Icon,
      },
      gray: {
        badge: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
        dot: 'bg-gray-400 dark:bg-gray-500',
        label: 'Offline',
        icon: CircleIcon,
      },
      orange: {
        badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
        dot: 'bg-orange-500 dark:bg-orange-400',
        label: 'Pending',
        icon: ClockIcon,
      },
    }),
    [worker.status]
  );

  const config = statusConfig[statusColor];
  const StatusIcon = config.icon;

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3.5">
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-foreground text-sm">
            {worker.name || `Worker ${worker.workerId.slice(0, 8)}...`}
          </p>
          <Badge className={`gap-1 ${config.badge} shrink-0`}>
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
        {(worker.workingDirectory || worker.username) && (
          <div className="space-y-1.5 pt-1">
            {worker.workingDirectory && (
              <div className="flex items-start gap-2 text-xs">
                <FolderIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="font-mono text-muted-foreground break-all leading-relaxed">
                  {formatPathToHome(worker.workingDirectory, worker.username)}
                </span>
              </div>
            )}
            {worker.username && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserIcon className="h-3.5 w-3.5 shrink-0" />
                <span>{worker.username}</span>
              </div>
            )}
          </div>
        )}
        <div className="space-y-1 pt-1 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Worker ID: <code className="text-xs font-mono">{worker.workerId}</code>
          </p>
          {worker.lastHeartbeat && (
            <p className="text-xs text-muted-foreground">
              Last seen: {new Date(worker.lastHeartbeat).toLocaleString()}
            </p>
          )}
          {worker.approvedAt && (
            <p className="text-xs text-muted-foreground">
              Approved: {new Date(worker.approvedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(worker.workerId, worker.name)}
        disabled={isRemoving}
        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
        title="Remove worker"
      >
        <Trash2Icon className="h-4 w-4" />
      </Button>
    </div>
  );
}
