'use client';

import { FolderIcon, PlusIcon, ServerIcon, StopCircleIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppUrlState } from '../hooks/useAppUrlState';
import { useAssistantChat } from '../hooks/useAssistantChat';
import { useAssistantSessions } from '../hooks/useAssistantSessions';
import { useConnectWorker } from '../hooks/useConnectWorker';
import { useMachines } from '../hooks/useMachines';
import { useWorkerModels } from '../hooks/useWorkerModels';
import { useWorkers } from '../hooks/useWorkers';
import { AssistantSelector } from './AssistantSelector';
import { ChatInput } from './ChatInput';
import { ChatMessageList } from './ChatMessageList';
import { CreateWorkerDialog } from './CreateWorkerDialog';
import { MachineSelector } from './MachineSelector';
import { ModelSelector } from './ModelSelector';
import { SessionList } from './SessionList';

/**
 * Main chat interface component for orchestrating assistants.
 * Handles assistant selection, session management, and chat messaging.
 *
 * Uses URL query parameters to persist selection state:
 * - ?machineId=xxx - Selected machine
 * - ?workerId=xxx - Selected worker
 * - ?sessionId=xxx - Active session
 *
 * @example
 * ```typescript
 * <ChatInterface />
 * ```
 */
export function ChatInterface() {
  // URL state management (single source of truth)
  const { state: urlState, actions: urlActions } = useAppUrlState();
  const {
    machineId: selectedMachineId,
    workerId: selectedWorkerId,
    sessionId: urlSessionId,
  } = urlState;

  // Data fetching
  const { machines, loading: machinesLoading } = useMachines();
  const { workers, loading: workersLoading } = useWorkers(selectedMachineId || '');

  // Local UI state (not persisted to URL)
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [showCreateWorkerDialog, setShowCreateWorkerDialog] = useState(false);

  const { connectWorker } = useConnectWorker();

  const selectedWorker = useMemo(
    () => workers?.find((w) => w.workerId === selectedWorkerId),
    [workers, selectedWorkerId]
  );

  // Get available models from worker (fetched from opencode)
  const { models: workerModels } = useWorkerModels(selectedWorkerId);
  const availableModels = useMemo(() => workerModels?.map((m) => m.id) || [], [workerModels]);

  const { sessions, loading: sessionsLoading } = useAssistantSessions(selectedWorkerId);
  const { session, startSession, restoreSession, endSession, messages, sendMessage, isLoading } =
    useAssistantChat(selectedWorkerId);

  // Debug logging
  useEffect(() => {
    console.log('[ChatInterface] State:', {
      selectedMachineId,
      selectedWorkerId,
      urlSessionId,
      session,
      messagesCount: messages.length,
      showNewSession,
    });
  }, [selectedMachineId, selectedWorkerId, urlSessionId, session, messages.length, showNewSession]);

  // Request worker connection when worker is selected
  // This is a side effect (network request), not state synchronization
  useEffect(() => {
    if (selectedWorkerId) {
      // Request worker to connect and initialize opencode
      connectWorker(selectedWorkerId).catch((error) => {
        console.error('[ChatInterface] Failed to connect worker:', error);
      });
    }
  }, [selectedWorkerId, connectWorker]);

  // Restore session from URL on mount or when URL session changes
  // This is a side effect (restore session), not state synchronization
  useEffect(() => {
    if (urlSessionId && selectedWorkerId && !session) {
      console.log('[ChatInterface] Restoring session from URL:', urlSessionId);
      restoreSession(urlSessionId).catch((error) => {
        console.error('[ChatInterface] Failed to restore session from URL:', error);
        // Clear invalid session from URL
        urlActions.setSessionId(null);
      });
    }
  }, [urlSessionId, selectedWorkerId, session, restoreSession, urlActions]);

  // Auto-select first model when starting new session
  useEffect(() => {
    if (showNewSession && availableModels.length > 0 && !selectedModel) {
      setSelectedModel(availableModels[0]);
    }
  }, [showNewSession, availableModels, selectedModel]);

  /**
   * Handles machine selection change.
   * Updates URL which triggers re-render with new state.
   */
  const handleMachineChange = useCallback(
    (machineId: string) => {
      urlActions.setMachineId(machineId);
      // Reset local UI state
      setShowNewSession(false);
      setSelectedModel(null);
    },
    [urlActions]
  );

  /**
   * Handles worker selection change.
   * Updates URL which triggers re-render with new state.
   */
  const handleWorkerChange = useCallback(
    (workerId: string) => {
      urlActions.setWorkerId(workerId);
      // Reset local UI state
      setShowNewSession(false);
      setSelectedModel(null);
    },
    [urlActions]
  );

  /**
   * Handles starting a new chat session with the selected model.
   */
  const handleStartSession = useCallback(async () => {
    if (!selectedModel) return;
    try {
      const newSessionId = await startSession(selectedModel);
      setShowNewSession(false);
      // Update URL with new session ID
      if (newSessionId) {
        urlActions.setSessionId(newSessionId);
      }
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  }, [selectedModel, startSession, urlActions]);

  /**
   * Handles restoring an existing session.
   */
  const handleRestoreSession = useCallback(
    async (sessionId: string) => {
      console.log('[ChatInterface] Restoring session:', sessionId);
      try {
        await restoreSession(sessionId);
        setShowNewSession(false);
        // Update URL with restored session ID
        urlActions.setSessionId(sessionId);
        console.log('[ChatInterface] Session restored successfully');
      } catch (error) {
        console.error('Failed to restore session:', error);
      }
    },
    [restoreSession, urlActions]
  );

  /**
   * Handles ending the current session.
   */
  const handleEndSession = useCallback(async () => {
    try {
      await endSession();
      setSelectedModel(null);
      setShowNewSession(false);
      // Clear session from URL
      urlActions.setSessionId(null);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, [endSession, urlActions]);

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
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-6">
                <p className="text-sm text-muted-foreground">
                  No workers registered on this machine
                </p>
                <Button
                  onClick={() => setShowCreateWorkerDialog(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <PlusIcon className="h-4 w-4" />
                  Create Your First Worker
                </Button>
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
              autoFocus={true}
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

      {/* Create Worker Dialog */}
      {selectedMachineId && (
        <CreateWorkerDialog
          machineId={selectedMachineId}
          open={showCreateWorkerDialog}
          onOpenChange={setShowCreateWorkerDialog}
        />
      )}
    </div>
  );
}
