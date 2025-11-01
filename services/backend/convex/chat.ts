import { v } from 'convex/values';
import { SessionIdArg } from 'convex-helpers/server/sessions';
import { nanoid } from 'nanoid';
import { getAuthUserOptional } from '../modules/auth/getAuthUser';
import { mutation, query } from './_generated/server';

/**
 * Start a new chat session with a worker.
 * Creates a session record and notifies the worker to initialize.
 *
 * @param workerId - Worker to handle this session
 * @param model - AI model to use (e.g., "claude-sonnet-4-5")
 * @returns sessionId for the new session
 */
export const startSession = mutation({
  args: {
    ...SessionIdArg,
    workerId: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('[startSession] Called with:', { workerId: args.workerId, model: args.model });

    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      throw new Error('Unauthorized: Must be logged in to start a session');
    }
    console.log('[startSession] User authenticated:', user._id);

    // Verify worker exists and is online
    const worker = await ctx.db
      .query('workers')
      .withIndex('by_worker_id', (q) => q.eq('workerId', args.workerId))
      .first();

    if (!worker) {
      throw new Error('Worker not found');
    }
    console.log('[startSession] Worker found:', worker.workerId, 'status:', worker.status);

    if (worker.status !== 'online' && worker.status !== 'ready') {
      throw new Error('Worker is not online');
    }

    // Verify user owns the machine that owns the worker
    const machine = await ctx.db
      .query('machines')
      .withIndex('by_machine_id', (q) => q.eq('machineId', worker.machineId))
      .first();

    if (!machine || machine.userId !== user._id) {
      throw new Error('Unauthorized: You do not own this worker');
    }
    console.log('[startSession] Machine ownership verified');

    // Generate session ID
    const sessionId = nanoid();
    console.log('[startSession] Generated sessionId:', sessionId);

    // Create session record
    await ctx.db.insert('chatSessions', {
      sessionId,
      workerId: args.workerId,
      userId: user._id,
      model: args.model,
      status: 'active',
      createdAt: Date.now(),
      lastActivity: Date.now(),
    });
    console.log('[startSession] Session created successfully');

    return sessionId;
  },
});

/**
 * End a chat session.
 * Marks the session as terminated and notifies the worker.
 *
 * @param sessionId - Session to end
 */
export const endSession = mutation({
  args: {
    ...SessionIdArg,
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      throw new Error('Unauthorized: Must be logged in to end a session');
    }

    // Find session
    const session = await ctx.db
      .query('chatSessions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .first();

    if (!session) {
      throw new Error('Session not found');
    }

    // Verify user owns the session
    if (session.userId !== user._id) {
      throw new Error('Unauthorized: You do not own this session');
    }

    // Update session status
    await ctx.db.patch(session._id, {
      status: 'terminated',
      lastActivity: Date.now(),
    });
  },
});

/**
 * Send a message in a chat session.
 * Creates user message and placeholder assistant message for streaming.
 *
 * @param sessionId - Session to send message in
 * @param content - Message content
 * @returns messageId for the assistant response
 */
export const sendMessage = mutation({
  args: {
    ...SessionIdArg,
    sessionId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      throw new Error('Unauthorized: Must be logged in to send a message');
    }

    // Find session
    const session = await ctx.db
      .query('chatSessions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .first();

    if (!session) {
      throw new Error('Session not found');
    }

    // Verify user owns the session
    if (session.userId !== user._id) {
      throw new Error('Unauthorized: You do not own this session');
    }

    // Verify session is active
    if (session.status !== 'active') {
      throw new Error('Session is not active');
    }

    const timestamp = Date.now();

    // Create user message
    const userMessageId = nanoid();
    await ctx.db.insert('chatMessages', {
      messageId: userMessageId,
      sessionId: args.sessionId,
      role: 'user',
      content: args.content,
      timestamp,
      completed: true,
    });

    // Create placeholder assistant message for streaming
    const assistantMessageId = nanoid();
    await ctx.db.insert('chatMessages', {
      messageId: assistantMessageId,
      sessionId: args.sessionId,
      role: 'assistant',
      content: '', // Will be filled as chunks arrive
      timestamp: timestamp + 1, // Slightly after user message
      completed: false,
    });

    // Update session activity
    await ctx.db.patch(session._id, {
      lastActivity: timestamp,
    });

    return assistantMessageId;
  },
});

/**
 * Write a chunk of streaming response.
 * Called by worker service as it receives chunks from opencode.
 *
 * @param sessionId - Session this chunk belongs to
 * @param messageId - Message this chunk belongs to
 * @param chunk - Text chunk
 * @param sequence - Order of this chunk
 */
export const writeChunk = mutation({
  args: {
    sessionId: v.string(),
    messageId: v.string(),
    chunk: v.string(),
    sequence: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify session exists
    const session = await ctx.db
      .query('chatSessions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .first();

    if (!session) {
      throw new Error('Session not found');
    }

    // Verify message exists
    const message = await ctx.db
      .query('chatMessages')
      .withIndex('by_message_id', (q) => q.eq('messageId', args.messageId))
      .first();

    if (!message) {
      throw new Error('Message not found');
    }

    // Store chunk
    const chunkId = nanoid();
    await ctx.db.insert('chatChunks', {
      chunkId,
      messageId: args.messageId,
      sessionId: args.sessionId,
      chunk: args.chunk,
      sequence: args.sequence,
      timestamp: Date.now(),
    });

    // Update session activity
    await ctx.db.patch(session._id, {
      lastActivity: Date.now(),
    });
  },
});

/**
 * Complete a message with full content.
 * Called by worker service when streaming is done.
 *
 * @param sessionId - Session this message belongs to
 * @param messageId - Message to complete
 * @param content - Full message content
 */
export const completeMessage = mutation({
  args: {
    sessionId: v.string(),
    messageId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify session exists
    const session = await ctx.db
      .query('chatSessions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .first();

    if (!session) {
      throw new Error('Session not found');
    }

    // Find message
    const message = await ctx.db
      .query('chatMessages')
      .withIndex('by_message_id', (q) => q.eq('messageId', args.messageId))
      .first();

    if (!message) {
      throw new Error('Message not found');
    }

    // Update message with full content
    await ctx.db.patch(message._id, {
      content: args.content,
      completed: true,
    });

    // Update session activity
    await ctx.db.patch(session._id, {
      lastActivity: Date.now(),
    });
  },
});

/**
 * Mark a session as ready after worker initialization.
 * Called by worker service when opencode process is ready.
 *
 * @param sessionId - Session that is ready
 */
export const sessionReady = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find session
    const session = await ctx.db
      .query('chatSessions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .first();

    if (!session) {
      throw new Error('Session not found');
    }

    // Update session activity (session is already active from creation)
    await ctx.db.patch(session._id, {
      lastActivity: Date.now(),
    });
  },
});

/**
 * Get a specific session.
 *
 * @param sessionId - Session to retrieve
 * @returns Session data or null
 */
export const getSession = query({
  args: {
    ...SessionIdArg,
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log('[getSession] Called with sessionId:', args.sessionId);

    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      console.log('[getSession] No user found');
      return null;
    }
    console.log('[getSession] User found:', user._id);

    // Find session
    const session = await ctx.db
      .query('chatSessions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .first();

    console.log('[getSession] Session found:', session ? 'yes' : 'no');
    if (!session) {
      return null;
    }

    // Verify user owns the session
    if (session.userId !== user._id) {
      console.log('[getSession] User does not own session');
      return null;
    }

    console.log('[getSession] Returning session:', session.sessionId);
    return {
      sessionId: session.sessionId,
      workerId: session.workerId,
      model: session.model,
      status: session.status,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    };
  },
});

/**
 * List all sessions for a worker.
 *
 * @param workerId - Worker to list sessions for
 * @returns Array of sessions
 */
export const listSessions = query({
  args: {
    ...SessionIdArg,
    workerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      return [];
    }

    // Verify user owns the worker
    const worker = await ctx.db
      .query('workers')
      .withIndex('by_worker_id', (q) => q.eq('workerId', args.workerId))
      .first();

    if (!worker) {
      return [];
    }

    const machine = await ctx.db
      .query('machines')
      .withIndex('by_machine_id', (q) => q.eq('machineId', worker.machineId))
      .first();

    if (!machine || machine.userId !== user._id) {
      return [];
    }

    // Get all sessions for this worker and user
    const sessions = await ctx.db
      .query('chatSessions')
      .withIndex('by_worker_id', (q) => q.eq('workerId', args.workerId))
      .filter((q) => q.eq(q.field('userId'), user._id))
      .collect();

    // Sort by last activity (most recent first)
    sessions.sort((a, b) => b.lastActivity - a.lastActivity);

    return sessions.map((session) => ({
      sessionId: session.sessionId,
      workerId: session.workerId,
      model: session.model,
      status: session.status,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    }));
  },
});

/**
 * Get all messages for a session.
 *
 * @param sessionId - Session to get messages for
 * @returns Array of messages ordered by timestamp
 */
export const getMessages = query({
  args: {
    ...SessionIdArg,
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      return [];
    }

    // Verify session exists and user owns it
    const session = await ctx.db
      .query('chatSessions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .first();

    if (!session || session.userId !== user._id) {
      return [];
    }

    // Get all messages for this session
    const messages = await ctx.db
      .query('chatMessages')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .collect();

    // Sort by timestamp
    messages.sort((a, b) => a.timestamp - b.timestamp);

    return messages.map((message) => ({
      id: message.messageId,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      completed: message.completed,
    }));
  },
});

/**
 * Subscribe to messages in a session (real-time).
 * Used for live updates when new messages arrive.
 *
 * @param sessionId - Session to subscribe to
 * @returns Array of messages (updates in real-time)
 */
export const subscribeToMessages = query({
  args: {
    ...SessionIdArg,
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      return [];
    }

    // Verify session exists and user owns it
    const session = await ctx.db
      .query('chatSessions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .first();

    if (!session || session.userId !== user._id) {
      return [];
    }

    // Get all messages for this session
    const messages = await ctx.db
      .query('chatMessages')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .collect();

    // Sort by timestamp
    messages.sort((a, b) => a.timestamp - b.timestamp);

    return messages.map((message) => ({
      id: message.messageId,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      completed: message.completed,
    }));
  },
});

/**
 * Subscribe to chunks for a message (real-time).
 * Used for streaming display of assistant responses.
 *
 * @param sessionId - Session containing the message
 * @param messageId - Message to get chunks for
 * @returns Array of chunks ordered by sequence
 */
export const subscribeToChunks = query({
  args: {
    ...SessionIdArg,
    sessionId: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const user = await getAuthUserOptional(ctx, args);
    if (!user) {
      return [];
    }

    // Verify session exists and user owns it
    const session = await ctx.db
      .query('chatSessions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .first();

    if (!session || session.userId !== user._id) {
      return [];
    }

    // Get all chunks for this message
    const chunks = await ctx.db
      .query('chatChunks')
      .withIndex('by_message_id', (q) => q.eq('messageId', args.messageId))
      .collect();

    // Sort by sequence
    chunks.sort((a, b) => a.sequence - b.sequence);

    return chunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      messageId: chunk.messageId,
      sessionId: chunk.sessionId,
      chunk: chunk.chunk,
      sequence: chunk.sequence,
      timestamp: chunk.timestamp,
    }));
  },
});
