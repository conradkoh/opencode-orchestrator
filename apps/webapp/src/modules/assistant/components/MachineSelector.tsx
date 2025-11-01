'use client';

import { ServerIcon, SettingsIcon } from 'lucide-react';
import Link from 'next/link';
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
                      {machine.assistantCount} {machine.assistantCount === 1 ? 'worker' : 'workers'}
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
        <Button variant="ghost" size="icon" asChild className="shrink-0" title="Machine settings">
          <Link href={`/app/machine/${selectedMachine.machineId}/settings`}>
            <SettingsIcon className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}
