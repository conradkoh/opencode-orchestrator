'use client';

import { ServerIcon, StopCircleIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAssistantChat } from '../hooks/useAssistantChat';
import { useAssistantSessions } from '../hooks/useAssistantSessions';
import { useAssistants } from '../hooks/useAssistants';
import { AssistantSelector } from './AssistantSelector';
import { ChatInput } from './ChatInput';
import { ChatMessageList } from './ChatMessageList';
import { ModelSelector } from './ModelSelector';
import { SessionList } from './SessionList';

/**
 * Main chat interface component for orchestrating assistants.
 * Handles assistant selection, session management, and chat messaging.
 *
 * @example
 * ```typescript
 * <ChatInterface />
 * ```
 */
export function ChatInterface() {
  const { assistants, loading: assistantsLoading } = useAssistants();
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);

  const selectedAssistant = useMemo(
    () => assistants?.find((a) => a.assistantId === selectedAssistantId),
    [assistants, selectedAssistantId]
  );

  const availableModels = useMemo(
    () => selectedAssistant?.availableModels || [],
    [selectedAssistant]
  );

  const { sessions, loading: sessionsLoading } = useAssistantSessions(selectedAssistantId);
  const { session, startSession, restoreSession, endSession, messages, sendMessage, isLoading } =
    useAssistantChat(selectedAssistantId);

  // Reset state when assistant changes
  useEffect(() => {
    if (selectedAssistantId) {
      setShowNewSession(false);
      setSelectedModel(null);
    }
  }, [selectedAssistantId]);

  // Auto-select first model when starting new session
  useEffect(() => {
    if (showNewSession && availableModels.length > 0 && !selectedModel) {
      setSelectedModel(availableModels[0]);
    }
  }, [showNewSession, availableModels, selectedModel]);

  /**
   * Handles starting a new chat session with the selected model.
   */
  const handleStartSession = useCallback(async () => {
    if (!selectedModel) return;
    try {
      await startSession(selectedModel);
      setShowNewSession(false);
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  }, [selectedModel, startSession]);

  /**
   * Handles restoring an existing session.
   */
  const handleRestoreSession = useCallback(
    async (sessionId: string) => {
      try {
        await restoreSession(sessionId);
        setShowNewSession(false);
      } catch (error) {
        console.error('Failed to restore session:', error);
      }
    },
    [restoreSession]
  );

  /**
   * Handles ending the current session.
   */
  const handleEndSession = useCallback(async () => {
    try {
      await endSession();
      setSelectedModel(null);
      setShowNewSession(false);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, [endSession]);

  /**
   * Handles sending a message to the active session.
   */
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!session) return;
      try {
        await sendMessage(content);
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    },
    [session, sendMessage]
  );

  /**
   * Handles canceling new session creation.
   */
  const handleCancelNewSession = useCallback(() => {
    setShowNewSession(false);
    setSelectedModel(null);
  }, []);

  /**
   * Handles starting new session flow.
   */
  const handleStartNew = useCallback(() => {
    setShowNewSession(true);
  }, []);

  /**
   * Handles model selection change.
   */
  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
  }, []);

  /**
   * Handles assistant selection change.
   */
  const handleAssistantChange = useCallback((assistantId: string) => {
    setSelectedAssistantId(assistantId);
  }, []);

  const canSendMessage = useMemo(() => !!session && !isLoading, [session, isLoading]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Top Header - Assistant Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ServerIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Select Assistant</span>
        </div>
        <AssistantSelector
          assistants={assistants || []}
          selectedAssistantId={selectedAssistantId}
          onAssistantChange={handleAssistantChange}
          disabled={assistantsLoading || !!session}
        />

        {selectedAssistant && !session && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={selectedAssistant.status === 'online' ? 'default' : 'secondary'}
              className="gap-1.5"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  selectedAssistant.status === 'online'
                    ? 'bg-green-500 dark:bg-green-400'
                    : 'bg-gray-400 dark:bg-gray-500'
                }`}
              />
              {selectedAssistant.status === 'online' ? 'Online' : 'Offline'}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              {selectedAssistant.displayName}
            </span>
          </div>
        )}
      </div>

      {/* Chat Area or Session List */}
      {session ? (
        <div className="flex-1 flex flex-col min-h-0 border border-border rounded-lg bg-background">
          {/* Chat Messages */}
          <div className="flex-1 min-h-0 relative flex flex-col">
            <div className="sticky top-0 z-10 border-b border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 dark:bg-green-400 animate-pulse" />
                  <span>
                    Session active • Model:{' '}
                    <span className="font-medium text-foreground">{session.model}</span>
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEndSession}
                  disabled={isLoading}
                  className="h-7 text-xs"
                >
                  <StopCircleIcon className="mr-1.5 h-3.5 w-3.5" />
                  End Session
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ChatMessageList messages={messages} />
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-border p-4">
            <ChatInput
              onSendMessage={handleSendMessage}
              disabled={!canSendMessage}
              placeholder="Type your message... (Shift+Enter for new line)"
            />
          </div>
        </div>
      ) : selectedAssistantId ? (
        <div className="flex-1 flex flex-col min-h-0 border border-border rounded-lg bg-background p-4">
          {showNewSession ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">Start New Session</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelNewSession}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Model</span>
                  <ModelSelector
                    models={availableModels}
                    selectedModel={selectedModel}
                    onModelChange={handleModelChange}
                    disabled={false}
                  />
                </div>
                <Button
                  onClick={handleStartSession}
                  disabled={!selectedModel || isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Starting...' : 'Start Session'}
                </Button>
              </div>
            </div>
          ) : (
            <SessionList
              sessions={sessions}
              onRestoreSession={handleRestoreSession}
              onStartNew={handleStartNew}
              isLoading={sessionsLoading || isLoading}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center border border-border rounded-lg bg-background">
          <p className="text-sm text-muted-foreground">Select an assistant to view sessions</p>
        </div>
      )}
    </div>
  );
}
