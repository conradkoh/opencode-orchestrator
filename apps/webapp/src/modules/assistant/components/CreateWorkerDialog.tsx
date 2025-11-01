'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateWorker } from '../hooks/useCreateWorker';
import type { WorkerRegistration } from '../types';

/**
 * Props for CreateWorkerDialog component.
 */
export interface CreateWorkerDialogProps {
  /** ID of the machine to create worker for */
  machineId: string;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback fired when dialog open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog component for creating a new worker.
 * Shows a form to enter optional worker name, then displays the worker token upon success.
 *
 * @example
 * ```typescript
 * const [open, setOpen] = useState(false);
 * <CreateWorkerDialog machineId="machine_abc123" open={open} onOpenChange={setOpen} />
 * ```
 */
export function CreateWorkerDialog({ machineId, open, onOpenChange }: CreateWorkerDialogProps) {
  const [workerName, setWorkerName] = useState('');
  const [registration, setRegistration] = useState<WorkerRegistration | null>(null);
  const [copied, setCopied] = useState(false);
  const { createWorker, isCreating } = useCreateWorker();

  /**
   * Handles form submission to create a new worker.
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      try {
        const result = await createWorker(machineId, workerName.trim() || undefined);
        setRegistration(result);
      } catch (error) {
        console.error('Failed to create worker:', error);
      }
    },
    [machineId, workerName, createWorker]
  );

  /**
   * Handles dialog close and resets form state.
   */
  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset state after animation completes
    setTimeout(() => {
      setWorkerName('');
      setRegistration(null);
      setCopied(false);
    }, 300);
  }, [onOpenChange]);

  /**
   * Handles input change for worker name.
   */
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setWorkerName(e.target.value);
  }, []);

  /**
   * Copies the worker token to clipboard.
   */
  const handleCopy = useCallback(async () => {
    if (!registration) return;
    await navigator.clipboard.writeText(registration.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [registration]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        {!registration ? (
          <>
            <DialogHeader>
              <DialogTitle>Add New Worker</DialogTitle>
              <DialogDescription>
                Create a worker token for this machine. You can optionally give it a name to help
                identify it later.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="worker-name">Worker Name (Optional)</Label>
                  <Input
                    id="worker-name"
                    placeholder="e.g., Main Worker, Test Worker"
                    value={workerName}
                    onChange={handleNameChange}
                    disabled={isCreating}
                    autoFocus
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose} disabled={isCreating}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create Worker'}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Worker Token Created!</DialogTitle>
              <DialogDescription>
                Copy this token and use it to start your worker. The worker will need approval
                before it can start.
              </DialogDescription>
            </DialogHeader>

            <Alert>
              <AlertDescription className="space-y-4">
                <div>
                  <p className="mb-2 font-medium text-foreground">Worker Token:</p>
                  <div className="flex gap-2">
                    <code className="block flex-1 rounded bg-muted p-3 text-sm font-mono break-all text-foreground">
                      {registration.token}
                    </code>
                    <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                      {copied ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        <CopyIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Next Steps:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Copy the worker token above</li>
                <li>On your machine, create a `.env` file with: `WORKER_TOKEN={'<token>'}`</li>
                <li>Start the worker process: `pnpm start`</li>
                <li>Return here to approve the worker authorization request</li>
              </ol>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
