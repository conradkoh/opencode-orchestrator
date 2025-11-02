'use client';

import { SendIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/**
 * Props for ChatInput component.
 */
export interface ChatInputProps {
  /** Callback fired when user submits a message */
  onSendMessage: (message: string) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether to auto-focus the input on mount */
  autoFocus?: boolean;
}

/**
 * Input component for typing and sending chat messages.
 * Supports multi-line input (Shift+Enter) and auto-resizing textarea.
 *
 * @example
 * ```typescript
 * <ChatInput
 *   onSendMessage={(msg) => sendMessage(msg)}
 *   disabled={isLoading}
 *   placeholder="Type your message..."
 * />
 * ```
 */
export function ChatInput({
  onSendMessage,
  disabled,
  placeholder = 'Type your message...',
  autoFocus = false,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Handles form submission to send the message.
   */
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!message.trim() || disabled) return;

      onSendMessage(message.trim());
      setMessage('');

      // Reset textarea height and restore focus
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        // Restore focus after submission to maintain user's typing flow
        textareaRef.current.focus();
      }
    },
    [message, disabled, onSendMessage]
  );

  /**
   * Handles keyboard input, submitting on Enter (without Shift).
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    },
    [handleSubmit]
  );

  /**
   * Handles textarea value change.
   */
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  }, []);

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  });

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <div className="flex-1 relative">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[60px] max-h-[200px] resize-none"
          rows={1}
        />
      </div>
      <Button
        type="submit"
        size="icon"
        disabled={!message.trim() || disabled}
        className="h-[60px] w-[60px] shrink-0"
      >
        <SendIcon className="h-5 w-5" />
      </Button>
    </form>
  );
}
