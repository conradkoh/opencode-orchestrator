'use client';

import { ServerIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Assistant } from '../types';

/**
 * Props for AssistantSelector component.
 */
export interface AssistantSelectorProps {
  /** Array of assistants to display */
  assistants: Assistant[];
  /** Currently selected assistant ID, or null if none selected */
  selectedAssistantId: string | null;
  /** Callback fired when assistant selection changes */
  onAssistantChange: (assistantId: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

/**
 * Selector component for choosing an assistant from a list.
 * Groups assistants by machine name and displays status indicators.
 *
 * @example
 * ```typescript
 * <AssistantSelector
 *   assistants={assistants}
 *   selectedAssistantId={selectedId}
 *   onAssistantChange={setSelectedId}
 * />
 * ```
 */
export function AssistantSelector({
  assistants,
  selectedAssistantId,
  onAssistantChange,
  disabled,
}: AssistantSelectorProps) {
  // Group assistants by machine
  const assistantsByMachine = assistants.reduce(
    (acc, assistant) => {
      const machineName = assistant.machineName;
      if (!acc[machineName]) {
        acc[machineName] = [];
      }
      acc[machineName].push(assistant);
      return acc;
    },
    {} as Record<string, Assistant[]>
  );

  return (
    <Select
      value={selectedAssistantId || undefined}
      onValueChange={onAssistantChange}
      disabled={disabled || assistants.length === 0}
    >
      <SelectTrigger className="w-full">
        <div className="flex items-center gap-2">
          <ServerIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <SelectValue placeholder="Select an assistant..." />
        </div>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(assistantsByMachine).map(([machineName, machineAssistants]) => (
          <SelectGroup key={machineName}>
            <SelectLabel>{machineName}</SelectLabel>
            {machineAssistants.map((assistant) => (
              <SelectItem key={assistant.assistantId} value={assistant.assistantId}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{assistant.displayName}</span>
                  <span
                    className={`ml-auto h-2 w-2 rounded-full ${
                      assistant.status === 'online'
                        ? 'bg-green-500 dark:bg-green-400'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
