'use client';

import {
  BrainIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  InfoIcon,
  SparklesIcon,
  UserIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '../types';

/**
 * Props for ChatMessage component.
 */
export interface ChatMessageProps {
  /** The chat message to display */
  message: ChatMessageType;
}

/**
 * Component for displaying a single chat message.
 * Shows avatar, role label, timestamp, and message content with streaming indicator.
 *
 * @example
 * ```typescript
 * <ChatMessage message={{
 *   id: "msg_001",
 *   role: "user",
 *   content: "Hello!",
 *   timestamp: Date.now()
 * }} />
 * ```
 */
export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = useMemo(() => message.role === 'user', [message.role]);
  const isSystem = useMemo(() => message.role === 'system', [message.role]);
  const [showReasoning, setShowReasoning] = useState(false);

  /**
   * Formats the timestamp into a localized time string.
   */
  const formattedTime = useMemo(
    () =>
      new Date(message.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [message.timestamp]
  );

  /**
   * Check if message has reasoning content.
   */
  const hasReasoning = useMemo(() => {
    return message.reasoning && message.reasoning.trim().length > 0;
  }, [message.reasoning]);

  return (
    <div
      className={cn(
        'flex gap-4 p-4',
        isUser && 'bg-primary/5',
        isSystem && 'bg-muted/40',
        !isUser && !isSystem && 'bg-background'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser && 'bg-primary text-primary-foreground',
          isSystem && 'bg-muted-foreground/20 text-muted-foreground',
          !isUser && !isSystem && 'bg-accent text-accent-foreground'
        )}
      >
        {isUser ? (
          <UserIcon className="h-4 w-4" />
        ) : isSystem ? (
          <InfoIcon className="h-4 w-4" />
        ) : (
          <SparklesIcon className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {isUser ? 'You' : isSystem ? 'System' : 'Assistant'}
          </span>
          <span className="text-xs text-muted-foreground font-mono">{formattedTime}</span>
          {message.isStreaming && (
            <span className="text-xs text-muted-foreground animate-pulse flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              Typing...
            </span>
          )}
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-0">
          <p className="whitespace-pre-wrap text-foreground leading-relaxed m-0">
            {message.content}
          </p>
        </div>

        {/* Reasoning section for assistant messages */}
        {hasReasoning && !isUser && !isSystem && (
          <div className="mt-3 border-t pt-3">
            <button
              type="button"
              onClick={() => setShowReasoning(!showReasoning)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <BrainIcon className="h-4 w-4" />
              <span>Model Reasoning</span>
              {showReasoning ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              )}
            </button>

            {showReasoning && (
              <div className="mt-2 p-3 bg-muted/50 rounded-md border">
                <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed m-0">
                  {message.reasoning}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
