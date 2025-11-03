'use client';

import { HistoryIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { ChatSession } from '../types';
import { SessionList } from './SessionList';

/**
 * Props for SessionHistoryModal component.
 */
export interface SessionHistoryModalProps {
  /** Available sessions to display */
  sessions: ChatSession[];
  /** Callback fired when user selects a session to restore */
  onRestoreSession: (sessionId: string) => void;
  /** Whether any operation is in progress */
  isLoading?: boolean;
}

/**
 * Modal dialog for viewing and restoring past chat sessions.
 * Shows a history icon button that opens a dialog with session list.
 *
 * @example
 * ```typescript
 * <SessionHistoryModal
 *   sessions={sessions}
 *   onRestoreSession={handleRestoreSession}
 *   isLoading={isLoading}
 * />
 * ```
 */
export function SessionHistoryModal({
  sessions,
  onRestoreSession,
  isLoading,
}: SessionHistoryModalProps) {
  const [open, setOpen] = useState(false);

  const handleRestoreSession = (sessionId: string) => {
    onRestoreSession(sessionId);
    // Close modal after restoring session
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="View session history">
          <HistoryIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Session History</DialogTitle>
          <DialogDescription>Resume a previous session or start a new one</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <SessionList
            sessions={sessions}
            onRestoreSession={handleRestoreSession}
            onStartNew={() => {
              // Close dialog when starting new
              setOpen(false);
            }}
            isLoading={isLoading}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
