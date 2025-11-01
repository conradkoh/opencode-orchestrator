'use client';

import { ServerIcon, Trash2Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  /** Callback fired when delete button is clicked */
  onDeleteMachine: (machineId: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

/**
 * Selector component for choosing a machine from a list.
 * Displays machines with worker count and status indicators.
 *
 * @example
 * ```typescript
 * <MachineSelector
 *   machines={machines}
 *   selectedMachineId={selectedId}
 *   onMachineChange={setSelectedId}
 *   onDeleteMachine={handleDelete}
 * />
 * ```
 */
export function MachineSelector({
  machines,
  selectedMachineId,
  onMachineChange,
  onDeleteMachine,
  disabled,
}: MachineSelectorProps) {
  const selectedMachine = machines.find((m) => m.machineId === selectedMachineId);

  return (
    <div className="space-y-3">
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
                <SelectValue placeholder="Select a machine..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Machines</SelectLabel>
                {machines.map((machine) => (
                  <SelectItem key={machine.machineId} value={machine.machineId}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{machine.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {machine.assistantCount}{' '}
                        {machine.assistantCount === 1 ? 'worker' : 'workers'}
                      </Badge>
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
        {selectedMachine && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDeleteMachine(selectedMachine.machineId)}
            className="shrink-0"
            title="Delete machine"
          >
            <Trash2Icon className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      {selectedMachine && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge
            variant={selectedMachine.status === 'online' ? 'default' : 'secondary'}
            className="gap-1.5"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                selectedMachine.status === 'online'
                  ? 'bg-green-500 dark:bg-green-400'
                  : 'bg-gray-400 dark:bg-gray-500'
              }`}
            />
            {selectedMachine.status === 'online' ? 'Online' : 'Offline'}
          </Badge>
          <span className="text-muted-foreground">
            {selectedMachine.assistantCount}{' '}
            {selectedMachine.assistantCount === 1 ? 'worker' : 'workers'} available
          </span>
        </div>
      )}
    </div>
  );
}
