import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  IOpencodeClient,
  IOpencodeInstance,
  OpencodeSessionInfo,
} from '@domain/interfaces/IOpencodeClient';
import type { SessionId } from '@domain/valueObjects/Ids';
import type { OpencodeClient } from '@opencode-ai/sdk';
import { createOpencode } from '@opencode-ai/sdk';

const execAsync = promisify(exec);

/**
 * Internal wrapper for OpenCode SDK client and server.
 */
interface OpencodeInstanceInternal {
  readonly __brand: 'OpencodeClient';
  readonly _internal: {
    client: OpencodeClient;
    server: {
      url: string;
      close(): void;
    };
    directory: string;
  };
}

/**
 * Infrastructure adapter for OpenCode SDK.
 * Implements the IOpencodeClient port interface using @opencode-ai/sdk.
 *
 * This adapter:
 * - Wraps OpenCode SDK to maintain clean architecture boundaries
 * - Handles SDK-specific error handling and type conversions
 * - Manages OpenCode server lifecycle
 *
 * @see https://opencode.ai/docs/sdk/
 */
export class OpencodeClientAdapter implements IOpencodeClient {
  /**
   * Creates a new OpenCode client instance for a specific directory.
   * This starts an OpenCode server and client.
   *
   * @param directory - Absolute path to working directory
   * @returns OpenCode client instance
   * @throws Error if OpenCode fails to start or directory is invalid
   */
  /**
   * Check if a port is available.
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require('node:net');
      const server = net.createServer();

      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port);
    });
  }

  /**
   * Find an available port in the given range.
   */
  private async findAvailablePort(minPort: number, maxPort: number): Promise<number> {
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
      if (await this.isPortAvailable(port)) {
        return port;
      }
      console.log(`⚠️  Port ${port} is in use, trying another...`);
    }
    throw new Error(`Could not find available port after ${maxAttempts} attempts`);
  }

  async createClient(directory: string): Promise<IOpencodeInstance> {
    try {
      // Find an available port between 3000-9999
      const port = await this.findAvailablePort(3000, 9999);

      console.log(`🔌 Starting opencode server on port ${port}`);

      // Create OpenCode server and client
      const { client, server } = await createOpencode({
        port,
        config: {
          // OpenCode will use the directory parameter in API calls
        },
      });

      console.log(`✅ Opencode server started at ${server.url}`);

      const instance: OpencodeInstanceInternal = {
        __brand: 'OpencodeClient',
        _internal: {
          client,
          server,
          directory,
        },
      };

      return instance as IOpencodeInstance;
    } catch (error) {
      throw new Error(
        `Failed to create OpenCode client for directory ${directory}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Lists all available AI models using the opencode CLI.
   * Uses `opencode models` command to get the complete list of available models.
   *
   * @param _client - OpenCode client instance (unused, but kept for interface compatibility)
   * @returns Array of available models with their metadata
   * @throws Error if listing fails
   */
  async listModels(
    _client: IOpencodeInstance
  ): Promise<Array<{ id: string; name: string; provider: string }>> {
    try {
      console.log('[OpencodeClientAdapter] Fetching models using CLI: opencode models');

      // Run the opencode models CLI command
      const { stdout } = await execAsync('opencode models');

      // Parse the output - each line is a model in format "provider/model-id"
      const lines = stdout.split('\n').filter((line) => line.trim());
      const models: Array<{ id: string; name: string; provider: string }> = [];

      for (const line of lines) {
        const trimmed = line.trim();
        // Each model should be in format "provider/model-id"
        if (trimmed.includes('/')) {
          const [provider, ...modelParts] = trimmed.split('/');
          const modelId = modelParts.join('/');
          if (provider && modelId) {
            models.push({
              id: trimmed,
              name: modelId, // Use model ID as display name
              provider: provider.trim(),
            });
          }
        }
      }

      console.log(`[OpencodeClientAdapter] Found ${models.length} models from CLI`);

      if (models.length === 0) {
        console.warn('[OpencodeClientAdapter] No models found from opencode CLI');
      }

      return models;
    } catch (error) {
      throw new Error(
        `Failed to list models: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Creates a new chat session with specified model.
   *
   * @param client - OpenCode client instance
   * @param _model - Model identifier (not used in session creation, applied on first prompt)
   * @returns Session information including ID
   * @throws Error if session creation fails
   */
  async createSession(client: IOpencodeInstance, _model: string): Promise<OpencodeSessionInfo> {
    try {
      const instance = client as OpencodeInstanceInternal;
      const sdkClient = instance._internal.client;
      const directory = instance._internal.directory;

      // SDK: client.session.create({ body?: { parentID?, title? }, query?: { directory? } })
      const result = await sdkClient.session.create({
        body: {
          title: `Session ${Date.now()}`,
        },
        query: {
          directory,
        },
      });

      if (!result.data) {
        throw new Error('Session creation returned no data');
      }

      return {
        id: result.data.id,
        projectID: result.data.projectID,
        directory: result.data.directory,
        parentID: result.data.parentID,
      };
    } catch (error) {
      throw new Error(
        `Failed to create OpenCode session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Lists all sessions for a client.
   *
   * @param client - OpenCode client instance
   * @returns Array of session information
   * @throws Error if listing fails
   */
  async listSessions(client: IOpencodeInstance): Promise<OpencodeSessionInfo[]> {
    try {
      const instance = client as OpencodeInstanceInternal;
      const sdkClient = instance._internal.client;
      const directory = instance._internal.directory;

      // SDK: client.session.list({ query?: { directory? } })
      const result = await sdkClient.session.list({
        query: {
          directory,
        },
      });

      if (!result.data) {
        return [];
      }

      return result.data.map((session) => ({
        id: session.id,
        projectID: session.projectID,
        directory: session.directory,
        parentID: session.parentID,
      }));
    } catch (error) {
      throw new Error(
        `Failed to list OpenCode sessions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets a specific session by ID.
   *
   * @param client - OpenCode client instance
   * @param sessionId - Session identifier
   * @returns Session information
   * @throws Error if session not found
   */
  async getSession(client: IOpencodeInstance, sessionId: SessionId): Promise<OpencodeSessionInfo> {
    try {
      const instance = client as OpencodeInstanceInternal;
      const sdkClient = instance._internal.client;
      const directory = instance._internal.directory;

      // SDK: client.session.get({ path: { id }, query?: { directory? } })
      const result = await sdkClient.session.get({
        path: { id: sessionId },
        query: {
          directory,
        },
      });

      if (!result.data) {
        throw new Error(`Session ${sessionId} not found`);
      }

      return {
        id: result.data.id,
        projectID: result.data.projectID,
        directory: result.data.directory,
        parentID: result.data.parentID,
      };
    } catch (error) {
      throw new Error(
        `Failed to get OpenCode session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Sends a prompt to a session and streams the response.
   * Returns an async iterable iterator that yields response chunks.
   *
   * NOTE: The current SDK implementation returns complete messages, not true streaming.
   * For real-time streaming, we would need to use the Events API (event.subscribe).
   * This implementation yields the complete response as a single chunk.
   *
   * TODO: Implement true streaming via Events API when needed for real-time UX.
   *
   * @param client - OpenCode client instance
   * @param sessionId - Session identifier
   * @param content - Message content to send
   * @param model - Optional model override for this message
   * @returns Async iterable iterator yielding response chunks
   * @throws Error if prompt fails
   */
  async *sendPrompt(
    client: IOpencodeInstance,
    sessionId: SessionId,
    content: string,
    model?: string
  ): AsyncIterableIterator<string> {
    try {
      const instance = client as OpencodeInstanceInternal;
      const sdkClient = instance._internal.client;
      const directory = instance._internal.directory;

      // Parse model if provided
      let modelConfig: { providerID: string; modelID: string } | undefined;
      if (model) {
        const [providerID, modelID] = this._parseModelString(model);
        modelConfig = { providerID, modelID };
      }

      // SDK: client.session.prompt({
      //   path: { id },
      //   body?: { model?, parts, noReply? },
      //   query?: { directory? }
      // })
      const result = await sdkClient.session.prompt({
        path: { id: sessionId },
        body: {
          ...(modelConfig && { model: modelConfig }),
          parts: [{ type: 'text', text: content }],
          noReply: false,
        },
        query: {
          directory,
        },
      });

      // The SDK returns a complete message with parts
      // We yield each part's text content
      if (result.data && 'parts' in result.data) {
        const parts = result.data.parts;
        for (const part of parts) {
          if ('text' in part && part.text) {
            yield part.text;
          }
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to send prompt to session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Closes a session and cleans up resources.
   *
   * @param client - OpenCode client instance
   * @param sessionId - Session identifier
   * @throws Error if deletion fails
   */
  async deleteSession(client: IOpencodeInstance, sessionId: SessionId): Promise<void> {
    try {
      const instance = client as OpencodeInstanceInternal;
      const sdkClient = instance._internal.client;
      const directory = instance._internal.directory;

      // SDK: client.session.delete({ path: { id }, query?: { directory? } })
      await sdkClient.session.delete({
        path: { id: sessionId },
        query: {
          directory,
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to delete OpenCode session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Closes the OpenCode client and server.
   * Terminates all sessions associated with this client.
   *
   * @param client - OpenCode client instance
   * @throws Error if shutdown fails
   */
  async closeClient(client: IOpencodeInstance): Promise<void> {
    try {
      const instance = client as OpencodeInstanceInternal;
      const server = instance._internal.server;

      // Close the OpenCode server
      // SDK: server.close()
      if (server && typeof server.close === 'function') {
        server.close();
      }
    } catch (error) {
      throw new Error(
        `Failed to close OpenCode client: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parses a model string into provider and model ID.
   * Format: "provider/model" (e.g., "anthropic/claude-3-5-sonnet-20241022")
   *
   * @param model - Model string to parse
   * @returns Tuple of [providerID, modelID]
   * @throws Error if format is invalid
   */
  private _parseModelString(model: string): [string, string] {
    const parts = model.split('/');
    if (parts.length !== 2) {
      throw new Error(`Invalid model format: ${model}. Expected format: provider/model`);
    }
    return [parts[0], parts[1]];
  }
}
