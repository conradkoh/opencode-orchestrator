'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ChatMessage as ChatMessageType } from '../types';
import { ChatMessage } from './ChatMessage';

/**
 * Props for ChatMessageList component.
 */
export interface ChatMessageListProps {
  /** Array of messages to display */
  messages: ChatMessageType[];
}

/**
 * Component for displaying a scrollable list of chat messages.
 * Auto-scrolls to bottom when new messages arrive.
 *
 * @example
 * ```typescript
 * <ChatMessageList messages={messages} />
 * ```
 */
export function ChatMessageList({ messages }: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  });

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center p-8">
        <div className="space-y-2 max-w-md">
          <p className="text-lg font-medium text-foreground">No messages yet</p>
          <p className="text-sm text-muted-foreground">
            Send a message below to start chatting with the assistant. Your first message will
            automatically start a new session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div ref={scrollRef} className="space-y-4 p-6">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
