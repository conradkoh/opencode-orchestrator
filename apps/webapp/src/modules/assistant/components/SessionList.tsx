'use client';

import { ClockIcon, PlayIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { ChatSession } from '../types';

/**
 * Props for SessionList component.
 */
export interface SessionListProps {
  /** Array of chat sessions to display */
  sessions: ChatSession[];
  /** Callback fired when user clicks to restore a session */
  onRestoreSession: (sessionId: string) => void;
  /** Callback fired when user clicks to start a new session */
  onStartNew: () => void;
  /** Whether any operation is in progress */
  isLoading?: boolean;
}

/**
 * Formats a timestamp into a human-readable "time ago" string.
 */
function _formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format session title as "Session DDMMYYYY_HHMMSS" (fallback for sessions without names)
 */
function _formatSessionTitle(timestamp: number): string {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `Session ${day}${month}${year}_${hours}${minutes}${seconds}`;
}

/**
 * Get session display name - uses session.name if available, otherwise falls back to timestamp
 */
function _getSessionDisplayName(session: ChatSession): string {
  return session.name || _formatSessionTitle(session.createdAt);
}

/**
 * Component for displaying a list of chat sessions for an assistant.
 * Shows active sessions separately from inactive sessions, with ability to restore or start new.
 *
 * @example
 * ```typescript
 * <SessionList
 *   sessions={sessions}
 *   onRestoreSession={(id) => restoreSession(id)}
 *   onStartNew={() => setShowNewSession(true)}
 * />
 * ```
 */
export function SessionList({
  sessions,
  onRestoreSession,
  onStartNew,
  isLoading,
}: SessionListProps) {
  /**
   * Handles session item click to restore a session.
   * Allows viewing inactive sessions in read-only mode.
   */
  const handleSessionClick = useCallback(
    (sessionId: string) => {
      // Allow viewing all sessions (inactive sessions are shown in read-only mode)
      onRestoreSession(sessionId);
    },
    [onRestoreSession]
  );

  // Separate sessions by status
  const { activeSessions, inactiveSessions } = useMemo(() => {
    const active = sessions.filter((s) => s.status === 'active');
    const inactive = sessions.filter((s) => s.status === 'inactive');
    return { activeSessions: active, inactiveSessions: inactive };
  }, [sessions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Sessions</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onStartNew}
          disabled={isLoading}
          className="h-8 text-xs"
        >
          <PlayIcon className="mr-1.5 h-3.5 w-3.5" />
          New Session
        </Button>
      </div>

      {activeSessions.length === 0 && inactiveSessions.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No previous sessions</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeSessions.length > 0 &&
            activeSessions.map((session) => (
              <button
                key={session.sessionId}
                type="button"
                onClick={() => handleSessionClick(session.sessionId)}
                disabled={isLoading}
                className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {_getSessionDisplayName(session)}
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 dark:bg-green-400 flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ClockIcon className="h-3 w-3" />
                      {_formatTimeAgo(session.createdAt)}
                    </div>
                  </div>
                </div>
              </button>
            ))}

          {inactiveSessions.length > 0 && (
            <>
              {activeSessions.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">Closed</p>
                </div>
              )}
              {inactiveSessions.map((session) => (
                <button
                  key={session.sessionId}
                  type="button"
                  onClick={() => handleSessionClick(session.sessionId)}
                  disabled={isLoading}
                  title="View session history (read-only)"
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors opacity-75 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground truncate">
                          {_getSessionDisplayName(session)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ClockIcon className="h-3 w-3" />
                        {_formatTimeAgo(session.createdAt)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
