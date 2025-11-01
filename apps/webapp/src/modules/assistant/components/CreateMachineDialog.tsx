'use client';

import { CheckCircle2Icon } from 'lucide-react';
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
import { useCreateMachine } from '../hooks/useCreateMachine';
import type { MachineRegistration } from '../types';

/**
 * Props for CreateMachineDialog component.
 */
export interface CreateMachineDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback fired when dialog open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog component for creating a new machine.
 * Shows a form to enter machine name, then displays success message.
 * Note: Machines no longer have tokens - workers authenticate individually.
 *
 * @example
 * ```typescript
 * const [open, setOpen] = useState(false);
 * <CreateMachineDialog open={open} onOpenChange={setOpen} />
 * ```
 */
export function CreateMachineDialog({ open, onOpenChange }: CreateMachineDialogProps) {
  const [machineName, setMachineName] = useState('');
  const [registration, setRegistration] = useState<MachineRegistration | null>(null);
  const { createMachine, isCreating } = useCreateMachine();

  /**
   * Handles form submission to create a new machine.
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!machineName.trim()) return;

      try {
        const result = await createMachine(machineName.trim());
        setRegistration(result);
      } catch (error) {
        console.error('Failed to create machine:', error);
      }
    },
    [machineName, createMachine]
  );

  /**
   * Handles dialog close and resets form state.
   */
  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset state after animation completes
    setTimeout(() => {
      setMachineName('');
      setRegistration(null);
    }, 300);
  }, [onOpenChange]);

  /**
   * Handles input change for machine name.
   */
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMachineName(e.target.value);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        {!registration ? (
          <>
            <DialogHeader>
              <DialogTitle>Add New Machine</DialogTitle>
              <DialogDescription>
                Give your machine a memorable name. You'll use this to identify which machine you're
                working with.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="machine-name">Machine Name</Label>
                  <Input
                    id="machine-name"
                    placeholder="e.g., MacBook Pro, Home Server, Office Desktop"
                    value={machineName}
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
                <Button type="submit" disabled={!machineName.trim() || isCreating}>
                  {isCreating ? 'Creating...' : 'Create Machine'}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Machine Created Successfully!</DialogTitle>
              <DialogDescription>
                Your machine "{registration.name}" has been created. You can now add workers to it.
              </DialogDescription>
            </DialogHeader>

            <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <CheckCircle2Icon className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <p className="font-medium mb-2">Next Steps:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Navigate to the machine settings</li>
                  <li>Click "Add new worker" to create a worker token</li>
                  <li>Use the worker token to start your worker process</li>
                  <li>Approve the worker when it requests authorization</li>
                </ol>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
