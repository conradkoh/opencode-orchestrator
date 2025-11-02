'use client';

import { FolderIcon, ServerIcon, StopCircleIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAssistantChat } from '../hooks/useAssistantChat';
import { useAssistantSessions } from '../hooks/useAssistantSessions';
import { useMachines } from '../hooks/useMachines';
import { useWorkers } from '../hooks/useWorkers';
import { AssistantSelector } from './AssistantSelector';
import { ChatInput } from './ChatInput';
import { ChatMessageList } from './ChatMessageList';
import { MachineSelector } from './MachineSelector';
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
  const { machines, loading: machinesLoading } = useMachines();
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);

  const { workers, loading: workersLoading } = useWorkers(selectedMachineId || '');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);

  const selectedWorker = useMemo(
    () => workers?.find((w) => w.workerId === selectedWorkerId),
    [workers, selectedWorkerId]
  );

  // TODO: Get available models from worker when backend implements it
  const availableModels = useMemo(() => ['claude-sonnet-4-5', 'claude-opus-4', 'gpt-4'], []);

  const { sessions, loading: sessionsLoading } = useAssistantSessions(selectedWorkerId);
  const { session, startSession, restoreSession, endSession, messages, sendMessage, isLoading } =
    useAssistantChat(selectedWorkerId);

  // Debug logging
  useEffect(() => {
    console.log('[ChatInterface] State:', {
      selectedMachineId,
      selectedWorkerId,
      session,
      messagesCount: messages.length,
      showNewSession,
    });
  }, [selectedMachineId, selectedWorkerId, session, messages.length, showNewSession]);

  // Reset worker selection when machine changes
  useEffect(() => {
    if (selectedMachineId !== null) {
      setSelectedWorkerId(null);
      setShowNewSession(false);
      setSelectedModel(null);
    }
  }, [selectedMachineId]);

  // Reset state when worker changes
  useEffect(() => {
    if (selectedWorkerId) {
      setShowNewSession(false);
      setSelectedModel(null);
    }
  }, [selectedWorkerId]);

  // Auto-select first model when starting new session
  useEffect(() => {
    if (showNewSession && availableModels.length > 0 && !selectedModel) {
      setSelectedModel(availableModels[0]);
    }
  }, [showNewSession, availableModels, selectedModel]);

  /**
   * Handles machine selection change.
   */
  const handleMachineChange = useCallback((machineId: string) => {
    setSelectedMachineId(machineId);
  }, []);

  /**
   * Handles worker selection change.
   */
  const handleWorkerChange = useCallback((workerId: string) => {
    setSelectedWorkerId(workerId);
  }, []);

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

  const canSendMessage = useMemo(() => !!session && !isLoading, [session, isLoading]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Machine and Assistant Selection */}
      <div className="space-y-3">
        {/* Machine Selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ServerIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Machine</span>
          </div>
          <MachineSelector
            machines={machines || []}
            selectedMachineId={selectedMachineId}
            onMachineChange={handleMachineChange}
            disabled={machinesLoading || !!session}
          />
        </div>

        {/* Worker Selector - Only show if machine is selected */}
        {selectedMachineId && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Worker</span>
            </div>
            {workers && workers.length > 0 ? (
              <>
                <AssistantSelector
                  assistants={workers
                    .filter((w) => w.approvalStatus === 'approved')
                    .map((w) => ({
                      assistantId: w.workerId,
                      machineId: w.machineId,
                      machineName: machines?.find((m) => m.machineId === w.machineId)?.name || '',
                      workingDirectory: w.name || w.workerId,
                      displayName: w.name || `Worker ${w.workerId.slice(0, 8)}`,
                      status: w.status === 'online' ? 'online' : 'offline',
                      activeSessionCount: 0,
                      availableModels: [],
                    }))}
                  selectedAssistantId={selectedWorkerId}
                  onAssistantChange={handleWorkerChange}
                  disabled={workersLoading || !!session}
                />
                {selectedWorker && !session && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge
                      variant={selectedWorker.status === 'online' ? 'default' : 'secondary'}
                      className="gap-1.5"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          selectedWorker.status === 'online'
                            ? 'bg-green-500 dark:bg-green-400'
                            : 'bg-gray-400 dark:bg-gray-500'
                        }`}
                      />
                      {selectedWorker.status === 'online' ? 'Online' : 'Offline'}
                    </Badge>
                    <span className="text-muted-foreground font-mono">
                      {selectedWorker.name || `Worker ${selectedWorker.workerId.slice(0, 8)}`}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                No workers registered on this machine
              </div>
            )}
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
      ) : selectedWorkerId ? (
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
