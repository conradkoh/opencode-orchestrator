'use client';

import { SendIcon } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ModelSelector } from './ModelSelector';

/**
 * Imperative handle for controlling the input component from parent.
 */
export interface ChatInputHandle {
  /** Focuses the textarea input */
  focus: () => void;
}

/**
 * Props for ChatInputWithModel component.
 */
export interface ChatInputWithModelProps {
  /** Callback fired when user submits a message */
  onSendMessage: (message: string) => void;
  /** Currently selected model */
  selectedModel: string | null;
  /** Available models to choose from */
  availableModels: string[];
  /** Callback fired when model selection changes */
  onModelChange: (model: string) => void;
  /** Whether there's an active session (disables model selector) */
  hasActiveSession: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether to auto-focus the input on mount */
  autoFocus?: boolean;
}

/**
 * Combined input component with chat textarea, model selector, and send button.
 * Displays in a bordered container similar to modern chat interfaces.
 * Auto-creates session when sending first message.
 *
 * Exposes a `focus()` method via ref for programmatic focus control.
 *
 * @example
 * ```typescript
 * const inputRef = useRef<ChatInputHandle>(null);
 *
 * <ChatInputWithModel
 *   ref={inputRef}
 *   onSendMessage={(msg) => handleSendMessage(msg)}
 *   selectedModel="claude-sonnet-4"
 *   availableModels={models}
 *   onModelChange={setModel}
 *   hasActiveSession={!!session}
 *   disabled={isLoading}
 * />
 *
 * // Later, programmatically focus:
 * inputRef.current?.focus();
 * ```
 */
export const ChatInputWithModel = forwardRef<ChatInputHandle, ChatInputWithModelProps>(
  function ChatInputWithModel(
    {
      onSendMessage,
      selectedModel,
      availableModels,
      onModelChange,
      hasActiveSession,
      disabled,
      placeholder = 'Type your message...',
      autoFocus = false,
    },
    ref
  ) {
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    /**
     * Expose focus method to parent via ref.
     * This is the proper React pattern for imperative actions.
     */
    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          if (textareaRef.current && !disabled) {
            textareaRef.current.focus();
          }
        },
      }),
      [disabled]
    );

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
          // Restore focus immediately after submission to maintain user's typing flow
          // Use setTimeout to ensure state updates have completed
          setTimeout(() => {
            textareaRef.current?.focus();
          }, 0);
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
      if (autoFocus && textareaRef.current && !disabled) {
        // Delay slightly to ensure component is fully mounted
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 100);
      }
    }, [autoFocus, disabled]);

    // Auto-resize textarea based on content
    useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });

    return (
      <div className="border border-border rounded-lg bg-background p-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Text Input Area */}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="min-h-[80px] max-h-[200px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
              rows={1}
            />
          </div>

          {/* Model Selector and Send Button Row */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ModelSelector
                models={availableModels}
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                disabled={disabled}
              />
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={!message.trim() || disabled || !selectedModel}
              className="h-9 w-9 shrink-0"
              title="Send message"
            >
              <SendIcon className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    );
  }
);
