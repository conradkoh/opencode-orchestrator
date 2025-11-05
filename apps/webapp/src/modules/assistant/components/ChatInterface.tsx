'use client';

import { api } from '@workspace/backend/convex/_generated/api';
import { useSessionMutation } from 'convex-helpers/react/sessions';
import {
  AlertCircleIcon,
  FolderIcon,
  PlusIcon,
  RefreshCwIcon,
  ServerIcon,
  UserIcon,
  XIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppUrlState } from '../hooks/useAppUrlState';
import { useAssistantChat } from '../hooks/useAssistantChat';
import { useAssistantSessions } from '../hooks/useAssistantSessions';
import { useConnectWorker } from '../hooks/useConnectWorker';
import { useMachines } from '../hooks/useMachines';
import { useWorkerModels } from '../hooks/useWorkerModels';
import { useWorkers } from '../hooks/useWorkers';
import { formatPathToHome } from '../utils/pathFormatter';
import { AssistantSelector } from './AssistantSelector';
import { type ChatInputHandle, ChatInputWithModel } from './ChatInputWithModel';
import { ChatMessageList } from './ChatMessageList';
import { MachineSelector } from './MachineSelector';
import { SessionHistoryModal } from './SessionHistoryModal';
import { WorkerActionMenu } from './WorkerActionMenu';

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
    chatSessionId: urlChatSessionId,
  } = urlState;

  // Data fetching
  const { machines, loading: machinesLoading } = useMachines();
  const { workers, loading: workersLoading } = useWorkers(selectedMachineId || '');

  // Local UI state (not persisted to URL)
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [showResumeConfirmDialog, setShowResumeConfirmDialog] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<{ content: string; model: string } | null>(
    null
  );

  // Single ref for chat input - React will attach it to whichever instance is currently mounted
  const chatInputRef = useRef<ChatInputHandle>(null);

  // Track when we need to focus the input after state changes
  const [shouldFocusInput, setShouldFocusInput] = useState(false);

  const { connectWorker, connectionError, isConnecting, clearError } = useConnectWorker();

  const selectedWorker = useMemo(
    () => workers?.find((w) => w.workerId === selectedWorkerId),
    [workers, selectedWorkerId]
  );

  // Get available models from worker (fetched from opencode)
  const { models: workerModels } = useWorkerModels(selectedWorkerId);
  const availableModels = useMemo(() => workerModels?.map((m) => m.id) || [], [workerModels]);

  const { sessions, loading: sessionsLoading } = useAssistantSessions(selectedWorkerId);
  const { session, startSession, restoreSession, endSession, clearSession, messages, isLoading } =
    useAssistantChat(selectedWorkerId);

  // Get sendMessage mutation directly for auto-session creation
  const sendMessageMutation = useSessionMutation(api.chat.sendMessage);

  // Debug logging
  useEffect(() => {
    console.log('[ChatInterface] State:', {
      selectedMachineId,
      selectedWorkerId,
      urlChatSessionId,
      session,
      messagesCount: messages.length,
    });
  }, [selectedMachineId, selectedWorkerId, urlChatSessionId, session, messages.length]);

  // Request worker connection when worker is selected
  // This is a side effect (network request), not state synchronization
  // biome-ignore lint/correctness/useExhaustiveDependencies: connectWorker reference changes on every render, but we only want to trigger when workerId changes
  useEffect(() => {
    if (selectedWorkerId) {
      // Clear any previous errors when selecting a new worker
      clearError();
      // Request worker to connect and initialize opencode
      connectWorker(selectedWorkerId).then((result) => {
        if (!result.success) {
          console.warn('[ChatInterface] Worker connection failed:', result.error);
        }
      });
    }
  }, [selectedWorkerId]);

  // Clear active session when URL chatSessionId is cleared (user navigated away)
  // Skip if we're currently ending a session (to allow terminated state to be visible)
  useEffect(() => {
    if (!urlChatSessionId && session && !isEndingSession) {
      // URL session was cleared, so clear the active session in the hook
      clearSession();
    }
  }, [urlChatSessionId, session, isEndingSession, clearSession]);

  // Restore session from URL on mount or when URL session changes
  // This is a side effect (restore session), not state synchronization
  // Skip restoring if we're currently ending a session (urlChatSessionId is null but session still exists briefly)
  // NOTE: This now supports restoring inactive sessions for read-only viewing
  useEffect(() => {
    if (urlChatSessionId && selectedWorkerId && !session) {
      console.log('[ChatInterface] Restoring session from URL:', urlChatSessionId);
      restoreSession(urlChatSessionId).catch((error) => {
        console.error('[ChatInterface] Failed to restore session from URL:', error);
        // Clear invalid session from URL
        urlActions.setChatSessionId(null);
      });
    }
  }, [urlChatSessionId, selectedWorkerId, session, restoreSession, urlActions]);

  // Initialize model from session when restoring, or auto-select first model when worker is selected
  // Only runs when session/worker/models change, NOT when user changes selectedModel
  // Only initializes if no model is currently selected (preserves user selections)
  useEffect(() => {
    if (selectedWorkerId && availableModels.length > 0 && !selectedModel) {
      // If we have a session, use its model (if available in the list)
      if (session?.model && availableModels.includes(session.model)) {
        setSelectedModel(session.model);
      } else {
        // Otherwise, auto-select first model
        setSelectedModel(availableModels[0]);
      }
    }
  }, [selectedWorkerId, availableModels, session?.model, selectedModel]); // selectedModel only used in condition, not as trigger

  // Handle focus after component re-renders (session restore, session end, message send)
  useEffect(() => {
    if (shouldFocusInput) {
      // Use requestAnimationFrame to ensure the component has mounted/updated
      requestAnimationFrame(() => {
        setTimeout(() => {
          chatInputRef.current?.focus();
          setShouldFocusInput(false); // Reset flag
        }, 100);
      });
    }
  }, [shouldFocusInput]);

  /**
   * Handles machine selection change.
   * Updates URL which triggers re-render with new state.
   */
  const handleMachineChange = useCallback(
    (machineId: string) => {
      urlActions.setMachineId(machineId);
      // Reset local UI state
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
      setSelectedModel(null);
    },
    [urlActions]
  );

  /**
   * Handles sending a message to the active session.
   * Auto-creates a session if none exists.
   * Shows confirmation dialog if session is inactive.
   * Passes the currently selected model with each message.
   */
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedModel) {
        console.error('[ChatInterface] No model selected');
        return;
      }

      // If session is inactive, show confirmation dialog first
      if (session?.status === 'inactive') {
        setPendingMessage({ content, model: selectedModel });
        setShowResumeConfirmDialog(true);
        return;
      }

      try {
        let sessionIdToUse = session?.sessionId;

        // If no active session, create one first
        if (!session) {
          console.log('[ChatInterface] No active session, creating new session first');
          const newSessionId = await startSession();
          // Update URL with new session ID
          if (newSessionId) {
            urlActions.setChatSessionId(newSessionId);
            sessionIdToUse = newSessionId;
          }
        }

        // Send the message with the currently selected model
        // We use the mutation directly to avoid state timing issues
        if (sessionIdToUse) {
          await sendMessageMutation({
            chatSessionId: sessionIdToUse,
            content,
            model: selectedModel,
          });
          // Trigger focus after state updates
          setShouldFocusInput(true);
        }
      } catch (error) {
        console.error('[ChatInterface] Failed to send message:', error);
      }
    },
    [selectedModel, session, startSession, sendMessageMutation, urlActions]
  );

  /**
   * Handles restoring an existing session.
   * Focuses input after restoration.
   */
  const handleRestoreSession = useCallback(
    async (sessionId: string) => {
      console.log('[ChatInterface] Restoring session:', sessionId);
      try {
        await restoreSession(sessionId);
        // Update URL with restored session ID
        urlActions.setChatSessionId(sessionId);
        console.log('[ChatInterface] Session restored successfully');
        // Trigger focus after the component re-renders with the new session
        setShouldFocusInput(true);
      } catch (error) {
        console.error('Failed to restore session:', error);
      }
    },
    [restoreSession, urlActions]
  );

  /**
   * Handles closing the current session (navigates away without ending).
   * If session is already inactive, this clears it from view.
   */
  const handleCloseSession = useCallback(() => {
    setSelectedModel(null);
    setIsEndingSession(false); // Reset flag when closing
    // Clear session from URL (navigates away)
    urlActions.setChatSessionId(null);
    // The useEffect will clear activeSessionId when URL is cleared
  }, [urlActions]);

  /**
   * Handles starting new session flow by ending current session.
   * Focuses input after clearing session.
   */
  const handleStartNew = useCallback(async () => {
    if (!session) return;

    try {
      // End current session if it exists and isn't already inactive
      if (session.status !== 'inactive') {
        console.log('[ChatInterface] Ending current session before starting new one');
        await endSession();
      }
      // Clear the session from URL to allow starting fresh
      urlActions.setChatSessionId(null);
      setIsEndingSession(false);
      // Trigger focus after the component re-renders without a session
      setShouldFocusInput(true);
    } catch (error) {
      console.error('[ChatInterface] Failed to end session:', error);
      setIsEndingSession(false);
    }
  }, [session, endSession, urlActions]);

  /**
   * Handles confirming the resume action and sending the pending message.
   */
  const handleConfirmResume = useCallback(async () => {
    if (!pendingMessage || !session) return;

    try {
      // Send the pending message - backend will auto-resume the session
      await sendMessageMutation({
        chatSessionId: session.sessionId,
        content: pendingMessage.content,
        model: pendingMessage.model,
      });

      // Clear pending message and close dialog
      setPendingMessage(null);
      setShowResumeConfirmDialog(false);

      // Trigger focus after state updates
      setShouldFocusInput(true);
    } catch (error) {
      console.error('[ChatInterface] Failed to send message after resume:', error);
    }
  }, [pendingMessage, session, sendMessageMutation]);

  /**
   * Handles canceling the resume action.
   */
  const handleCancelResume = useCallback(() => {
    setPendingMessage(null);
    setShowResumeConfirmDialog(false);
  }, []);

  /**
   * Handles model selection change.
   * Updates local state - model will be sent with next message.
   */
  const handleModelChange = useCallback((model: string) => {
    console.log('[ChatInterface] Model changed to:', model);
    setSelectedModel(model);
  }, []);

  /**
   * Handles retrying worker connection
   */
  const handleRetryConnection = useCallback(() => {
    if (selectedWorkerId) {
      clearError();
      connectWorker(selectedWorkerId).then((result) => {
        if (!result.success) {
          console.warn('[ChatInterface] Worker connection retry failed:', result.error);
        }
      });
    }
  }, [selectedWorkerId, connectWorker, clearError]);

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
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <AssistantSelector
                      assistants={workers
                        .filter((w) => w.approvalStatus === 'approved')
                        .map((w) => ({
                          assistantId: w.workerId,
                          machineId: w.machineId,
                          machineName:
                            machines?.find((m) => m.machineId === w.machineId)?.name || '',
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
                  </div>
                  <WorkerActionMenu machineId={selectedMachineId} />
                </div>
                {selectedWorker && !session && (
                  <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          isConnecting
                            ? 'outline'
                            : selectedWorker.status === 'online'
                              ? 'default'
                              : 'secondary'
                        }
                        className="gap-1.5 px-2 py-0.5"
                      >
                        {isConnecting ? (
                          <>
                            <RefreshCwIcon className="h-3 w-3 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                selectedWorker.status === 'online'
                                  ? 'bg-green-500 dark:bg-green-400'
                                  : 'bg-gray-400 dark:bg-gray-500'
                              }`}
                            />
                            {selectedWorker.status === 'online' ? 'Online' : 'Offline'}
                          </>
                        )}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">
                        {selectedWorker.name || `Worker ${selectedWorker.workerId.slice(0, 8)}`}
                      </span>
                    </div>
                    {(selectedWorker.workingDirectory || selectedWorker.username) && (
                      <div className="space-y-1.5 pt-1 border-t border-border/50">
                        {selectedWorker.workingDirectory && (
                          <div className="flex items-start gap-2 text-xs">
                            <FolderIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            <span className="font-mono text-muted-foreground break-all leading-relaxed">
                              {formatPathToHome(
                                selectedWorker.workingDirectory,
                                selectedWorker.username
                              )}
                            </span>
                          </div>
                        )}
                        {selectedWorker.username && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <UserIcon className="h-3.5 w-3.5 shrink-0" />
                            <span>{selectedWorker.username}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-6">
                    <p className="text-sm text-muted-foreground">
                      No workers registered on this machine
                    </p>
                  </div>
                </div>
                <WorkerActionMenu machineId={selectedMachineId} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connection Error Alert */}
      {connectionError && selectedWorkerId && (
        <Alert variant="destructive" className="border-red-200 dark:border-red-800">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Worker Connection Failed</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <div className="text-sm">
              {connectionError.code === 'WORKER_OFFLINE' ? (
                <div className="space-y-2">
                  <p>
                    The selected worker is currently offline. Please ensure the worker process is
                    running on the target machine.
                  </p>
                  <div className="mt-3 p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50">
                    <p className="text-xs font-medium text-red-900 dark:text-red-200 mb-1">
                      To start the worker:
                    </p>
                    <code className="text-xs text-red-800 dark:text-red-300 block font-mono bg-red-100 dark:bg-red-900/30 p-2 rounded mt-1">
                      pnpm nx run worker:start
                    </code>
                  </div>
                </div>
              ) : (
                <p>{connectionError.message}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryConnection}
                disabled={isConnecting}
                className="gap-2"
              >
                <RefreshCwIcon className={`h-3 w-3 ${isConnecting ? 'animate-spin' : ''}`} />
                {isConnecting ? 'Retrying...' : 'Retry Connection'}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Chat Area or Session List */}
      {session ? (
        <div className="flex-1 flex flex-col min-h-0 border border-border rounded-lg bg-background">
          {/* Chat Messages */}
          <div className="flex-1 min-h-0 relative flex flex-col">
            <div className="sticky top-0 z-10 border-b border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {session.status === 'inactive' ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-500 dark:bg-gray-400" />
                      <span>Session closed</span>
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 dark:bg-green-400 animate-pulse" />
                      <span>Session active</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <SessionHistoryModal
                    sessions={sessions}
                    onRestoreSession={handleRestoreSession}
                    isLoading={sessionsLoading}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStartNew}
                    disabled={isLoading}
                    className="h-7 w-7"
                    title="New session (ends current)"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCloseSession}
                    disabled={isLoading}
                    className="h-7 w-7"
                    title="Close"
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ChatMessageList messages={messages} />
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4 pt-6">
            <ChatInputWithModel
              ref={chatInputRef}
              onSendMessage={handleSendMessage}
              selectedModel={selectedModel}
              availableModels={availableModels}
              onModelChange={handleModelChange}
              disabled={isLoading}
              placeholder="Type your message... (Shift+Enter for new line)"
              autoFocus={true}
            />
          </div>
        </div>
      ) : selectedWorkerId ? (
        <div className="flex-1 flex flex-col min-h-0 border border-border rounded-lg bg-background">
          {/* Header with History */}
          <div className="border-b border-border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {selectedWorker?.name || `Worker ${selectedWorkerId.slice(0, 8)}`}
              </div>
              <SessionHistoryModal
                sessions={sessions}
                onRestoreSession={handleRestoreSession}
                isLoading={sessionsLoading}
              />
            </div>
          </div>

          {/* Chat input - always visible */}
          <div className="flex-1 flex flex-col justify-end p-4">
            <ChatInputWithModel
              ref={chatInputRef}
              onSendMessage={handleSendMessage}
              selectedModel={selectedModel}
              availableModels={availableModels}
              onModelChange={handleModelChange}
              disabled={isLoading}
              placeholder="Type your message... (Shift+Enter for new line)"
              autoFocus={true}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center border border-border rounded-lg bg-background">
          <p className="text-sm text-muted-foreground">Select an assistant to view sessions</p>
        </div>
      )}

      {/* Resume Session Confirmation Dialog */}
      <AlertDialog open={showResumeConfirmDialog} onOpenChange={setShowResumeConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume Closed Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This session is currently closed. Sending a message will reactivate it and close any
              other active sessions for this worker. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelResume}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmResume}>Send Message</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
