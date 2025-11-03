'use client';

import { MoreVerticalIcon, PlusIcon, ServerIcon, SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Machine } from '../types';
import { CreateMachineDialog } from './CreateMachineDialog';
import { CreateWorkerDialog } from './CreateWorkerDialog';

/**
 * Props for MachineSelector component.
 */
export interface MachineSelectorProps {
  /** Array of machines to display */
  machines: Machine[];
  /** Currently selected machine ID, or null if none selected */
  selectedMachineId: string | null;
  /** Callback fired when machine selection changes */
  onMachineChange: (machineId: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

/**
 * Selector component for choosing a machine from a list.
 * Displays machines with worker count and status indicators.
 * Includes action menu for adding workers and accessing settings.
 *
 * @example
 * ```typescript
 * <MachineSelector
 *   machines={machines}
 *   selectedMachineId={selectedId}
 *   onMachineChange={setSelectedId}
 * />
 * ```
 */
export function MachineSelector({
  machines,
  selectedMachineId,
  onMachineChange,
  disabled,
}: MachineSelectorProps) {
  const selectedMachine = machines.find((m) => m.machineId === selectedMachineId);
  const [showCreateMachineDialog, setShowCreateMachineDialog] = useState(false);
  const [showCreateWorkerDialog, setShowCreateWorkerDialog] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select
            value={selectedMachineId || undefined}
            onValueChange={onMachineChange}
            disabled={disabled || machines.length === 0}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <ServerIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                {selectedMachine ? (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedMachine.name}</span>
                    {selectedMachine.assistantCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedMachine.workerCounts.online > 0 && (
                          <span className="text-green-600 dark:text-green-400">
                            {selectedMachine.workerCounts.online} online
                          </span>
                        )}
                        {selectedMachine.workerCounts.online > 0 &&
                          selectedMachine.workerCounts.pending > 0 && (
                            <span className="mx-1">|</span>
                          )}
                        {selectedMachine.workerCounts.pending > 0 && (
                          <span className="text-orange-600 dark:text-orange-400">
                            {selectedMachine.workerCounts.pending} pending
                          </span>
                        )}
                        {(selectedMachine.workerCounts.online > 0 ||
                          selectedMachine.workerCounts.pending > 0) &&
                          selectedMachine.workerCounts.offline > 0 && (
                            <span className="mx-1">|</span>
                          )}
                        {selectedMachine.workerCounts.offline > 0 && (
                          <span className="text-gray-600 dark:text-gray-400">
                            {selectedMachine.workerCounts.offline} offline
                          </span>
                        )}
                      </Badge>
                    )}
                    <span
                      className={`h-2 w-2 rounded-full ${
                        selectedMachine.status === 'online'
                          ? 'bg-green-500 dark:bg-green-400'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  </div>
                ) : (
                  <span className="text-muted-foreground">Select a machine...</span>
                )}
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Machines</SelectLabel>
                {machines.map((machine) => (
                  <SelectItem key={machine.machineId} value={machine.machineId}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{machine.name}</span>
                      {machine.assistantCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {machine.workerCounts.online > 0 && (
                            <span className="text-green-600 dark:text-green-400">
                              {machine.workerCounts.online} online
                            </span>
                          )}
                          {machine.workerCounts.online > 0 && machine.workerCounts.pending > 0 && (
                            <span className="mx-1">|</span>
                          )}
                          {machine.workerCounts.pending > 0 && (
                            <span className="text-orange-600 dark:text-orange-400">
                              {machine.workerCounts.pending} pending
                            </span>
                          )}
                          {(machine.workerCounts.online > 0 || machine.workerCounts.pending > 0) &&
                            machine.workerCounts.offline > 0 && <span className="mx-1">|</span>}
                          {machine.workerCounts.offline > 0 && (
                            <span className="text-gray-600 dark:text-gray-400">
                              {machine.workerCounts.offline} offline
                            </span>
                          )}
                        </Badge>
                      )}
                      <span
                        className={`h-2 w-2 rounded-full ${
                          machine.status === 'online'
                            ? 'bg-green-500 dark:bg-green-400'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      />
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
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
                <DropdownMenuItem onClick={() => setShowCreateWorkerDialog(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Worker
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/app/machine/${selectedMachine.machineId}/settings`}>
                    <SettingsIcon className="h-4 w-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CreateMachineDialog
        open={showCreateMachineDialog}
        onOpenChange={setShowCreateMachineDialog}
      />

      {selectedMachine && (
        <CreateWorkerDialog
          machineId={selectedMachine.machineId}
          open={showCreateWorkerDialog}
          onOpenChange={setShowCreateWorkerDialog}
        />
      )}
    </>
  );
}
