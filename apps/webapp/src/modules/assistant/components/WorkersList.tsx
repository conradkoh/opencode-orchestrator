'use client';

import { ActivityIcon, CheckCircle2Icon, CircleIcon, ClockIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useRemoveWorker } from '../hooks/useRemoveWorker';
import { useWorkers } from '../hooks/useWorkers';
import type { Worker } from '../types';

/**
 * Props for WorkersList component.
 */
export interface WorkersListProps {
  /** Machine ID to show workers for */
  machineId: string;
  /** Optional callback when worker is removed */
  onWorkerRemoved?: () => void;
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
export function WorkersList({ machineId, onWorkerRemoved }: WorkersListProps) {
  const { workers, loading } = useWorkers(machineId);
  const { removeWorker, isRemoving } = useRemoveWorker();

  // Group workers by status
  const groupedWorkers = useMemo(() => {
    if (!workers) {
      return { active: [], offline: [], pending: [] };
    }

    return {
      active: workers.filter((w) => w.status === 'online' || w.status === 'ready'),
      offline: workers.filter((w) => w.status === 'offline'),
      pending: workers.filter((w) => w.status === 'pending_authorization'),
    };
  }, [workers]);

  const handleRemove = useCallback(
    async (workerId: string, workerName?: string) => {
      const confirmed = window.confirm(
        `Are you sure you want to remove ${workerName || `worker ${workerId.slice(0, 8)}...`}?\n\nThis action cannot be undone.`
      );

      if (!confirmed) return;

      try {
        await removeWorker(workerId);
        onWorkerRemoved?.();
      } catch (error) {
        console.error('Failed to remove worker:', error);
        alert('Failed to remove worker. Please try again.');
      }
    },
    [removeWorker, onWorkerRemoved]
  );

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
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No workers have been created for this machine yet.</p>
            <p className="text-sm mt-2">
              Use the action menu (⋮) next to the machine selector to add a worker.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
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
                <WorkerItem
                  key={worker.workerId}
                  worker={worker}
                  onRemove={handleRemove}
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
                <WorkerItem
                  key={worker.workerId}
                  worker={worker}
                  onRemove={handleRemove}
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
                <WorkerItem
                  key={worker.workerId}
                  worker={worker}
                  onRemove={handleRemove}
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
  );
}

/**
 * Individual worker item component.
 */
interface WorkerItemProps {
  worker: Worker;
  onRemove: (workerId: string, workerName?: string) => void;
  statusColor: 'green' | 'gray' | 'orange';
  isRemoving: boolean;
}

function WorkerItem({ worker, onRemove, statusColor, isRemoving }: WorkerItemProps) {
  const statusConfig = {
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
  };

  const config = statusConfig[statusColor];
  const StatusIcon = config.icon;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground">
            {worker.name || `Worker ${worker.workerId.slice(0, 8)}...`}
          </p>
          <Badge className={`gap-1 ${config.badge}`}>
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Worker ID: <code className="text-xs">{worker.workerId}</code>
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

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(worker.workerId, worker.name)}
        disabled={isRemoving}
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2Icon className="h-4 w-4" />
      </Button>
    </div>
  );
}
