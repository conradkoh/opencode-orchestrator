'use client';

import { useCallback, useState } from 'react';
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
import { MachineTokenDisplay } from './MachineTokenDisplay';

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
 * Shows a form to enter machine name, then displays the registration token upon success.
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
                Use this token to register your machine. Keep it secure.
              </DialogDescription>
            </DialogHeader>

            <MachineTokenDisplay token={registration.token} machineId={registration.machineId} />

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
