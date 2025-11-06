'use client';

import { FolderIcon, ServerIcon, UserIcon } from 'lucide-react';
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
import { formatPathToHome } from '../utils/pathFormatter';

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
  /** Map of assistant IDs to their working directories (optional) */
  workingDirectories?: Record<string, string>;
  /** Map of assistant IDs to their usernames (optional) */
  usernames?: Record<string, string>;
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
  workingDirectories = {},
  usernames = {},
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

  // Find the selected assistant
  const selectedAssistant = assistants.find((a) => a.assistantId === selectedAssistantId);
  const selectedWorkingDir = selectedAssistant
    ? workingDirectories[selectedAssistant.assistantId]
    : undefined;
  const selectedUsername = selectedAssistant ? usernames[selectedAssistant.assistantId] : undefined;

  return (
    <Select
      value={selectedAssistantId || undefined}
      onValueChange={onAssistantChange}
      disabled={disabled || assistants.length === 0}
    >
      <SelectTrigger className="w-full !h-auto py-2.5 items-start">
        <div className="flex flex-col items-start w-full min-w-0 flex-1 gap-1">
          <div className="flex items-center gap-2 w-full min-w-0">
            <ServerIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            {selectedAssistant ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-mono text-sm">{selectedAssistant.displayName}</span>
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    selectedAssistant.status === 'online'
                      ? 'bg-green-500 dark:bg-green-400'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              </div>
            ) : (
              <SelectValue placeholder="Select an assistant..." className="flex-1 min-w-0" />
            )}
          </div>
          {(selectedWorkingDir || selectedUsername) && (
            <div className="flex items-center gap-3 ml-6 text-xs text-muted-foreground w-full min-w-0">
              {selectedWorkingDir && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <FolderIcon className="h-3 w-3 shrink-0" />
                  <span className="font-mono truncate">
                    {formatPathToHome(selectedWorkingDir, selectedUsername)}
                  </span>
                </div>
              )}
              {selectedUsername && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <UserIcon className="h-3 w-3 shrink-0" />
                  <span>{selectedUsername}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(assistantsByMachine).map(([machineName, machineAssistants]) => (
          <SelectGroup key={machineName}>
            <SelectLabel>{machineName}</SelectLabel>
            {machineAssistants.map((assistant) => {
              const workerDir = workingDirectories[assistant.assistantId];
              const workerUsername = usernames[assistant.assistantId];
              return (
                <SelectItem
                  key={assistant.assistantId}
                  value={assistant.assistantId}
                  textValue={assistant.displayName}
                >
                  <div className="flex flex-col items-start gap-1 w-full min-w-0">
                    <div className="flex items-center gap-2 w-full min-w-0">
                      <span className="font-mono text-sm">{assistant.displayName}</span>
                      <span
                        className={`ml-auto h-2 w-2 rounded-full shrink-0 ${
                          assistant.status === 'online'
                            ? 'bg-green-500 dark:bg-green-400'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      />
                    </div>
                    {(workerDir || workerUsername) && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground w-full min-w-0">
                        {workerDir && (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <FolderIcon className="h-3 w-3 shrink-0" />
                            <span className="font-mono truncate">
                              {formatPathToHome(workerDir, workerUsername)}
                            </span>
                          </div>
                        )}
                        {workerUsername && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <UserIcon className="h-3 w-3 shrink-0" />
                            <span>{workerUsername}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
