'use client';

import { ServerIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@/components/ui/select';
import type { Machine } from '../types';
import { MachineActionMenu } from './MachineActionMenu';

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

  return (
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
                        selectedMachine.workerCounts.pending > 0 && <span className="mx-1">|</span>}
                      {selectedMachine.workerCounts.pending > 0 && (
                        <span className="text-orange-600 dark:text-orange-400">
                          {selectedMachine.workerCounts.pending} pending
                        </span>
                      )}
                      {(selectedMachine.workerCounts.online > 0 ||
                        selectedMachine.workerCounts.pending > 0) &&
                        selectedMachine.workerCounts.offline > 0 && <span className="mx-1">|</span>}
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
      <MachineActionMenu selectedMachine={selectedMachine || null} />
    </div>
  );
}
