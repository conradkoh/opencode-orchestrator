'use client';

import { ServerIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Props for MachineEmptyState component.
 */
export interface MachineEmptyStateProps {
  /** Callback fired when user clicks to create a machine */
  onCreateMachine: () => void;
}

/**
 * Empty state component displayed when no machines are registered.
 * Provides an explanation of what machines are and a button to create the first one.
 *
 * @example
 * ```typescript
 * <MachineEmptyState onCreateMachine={() => setShowDialog(true)} />
 * ```
 */
export function MachineEmptyState({ onCreateMachine }: MachineEmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-6 p-12 text-center">
          <div className="rounded-full bg-muted p-6">
            <ServerIcon className="h-12 w-12 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">No machines yet</h2>
            <p className="text-muted-foreground">
              Create your first machine to start orchestrating assistants and running tasks.
            </p>
          </div>

          <Button onClick={onCreateMachine} size="lg" className="w-full">
            Add Your First Machine
          </Button>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium">What's a machine?</p>
            <p>
              A machine is a computer where you install the assistant runtime. Once registered, you
              can create assistants in different project directories and interact with them through
              this chat interface.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
