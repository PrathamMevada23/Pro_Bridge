import type {
  ContextExtractionResult,
  Conversation,
  ConversationProvider,
  ParsedConversation,
  ParsedMessage,
  Project,
  SyncCheckpoint,
} from '@pro-bridge/shared-types';
import {
  ApiErrorBodySchema,
  ContextExtractionResultSchema,
  ConversationListResponseSchema,
  LinkConversationResponseSchema,
  ProjectListResponseSchema,
  SyncCheckpointSchema,
  SyncResultSchema,
} from '@pro-bridge/validation';

export const SYNC_BATCH_SIZE = 500;

export class ProBridgeApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ProBridgeApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ProBridgeClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface SyncSummary {
  receivedMessages: number;
  createdMessages: number;
  updatedMessages: number;
  lastSyncedAt: string;
}

export function chunkItems<T>(items: readonly T[], size = SYNC_BATCH_SIZE): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error('Chunk size must be a positive integer.');
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export class ProBridgeClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: ProBridgeClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.fetchImpl = options.fetchImpl
      ? options.fetchImpl
      : (input, init) => globalThis.fetch(input, init);
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async listProjects(): Promise<Project[]> {
    const body = ProjectListResponseSchema.parse(
      await this.request('/api/projects', { method: 'GET' }),
    );

    return body.projects;
  }

  async findConversation(
    provider: ConversationProvider,
    providerConversationId: string,
  ): Promise<Conversation | null> {
    const body = ConversationListResponseSchema.parse(
      await this.request('/api/conversations', { method: 'GET' }),
    );

    return (
      body.conversations.find(
        (conversation) =>
          conversation.provider === provider &&
          conversation.providerConversationId === providerConversationId,
      ) ?? null
    );
  }

  async getSyncStatus(conversationId: string): Promise<SyncCheckpoint> {
    return SyncCheckpointSchema.parse(
      await this.request(`/api/conversations/${conversationId}/sync-status`, {
        method: 'GET',
      }),
    );
  }

  async linkConversation(
    conversation: ParsedConversation,
    projectId: string,
  ): Promise<{ conversation: Conversation; created: boolean }> {
    const body = LinkConversationResponseSchema.parse(
      await this.request('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          provider: conversation.provider,
          providerConversationId: conversation.providerConversationId,
          url: conversation.url,
          title: conversation.title,
        }),
      }),
    );

    return body;
  }

  async extractContext(conversationId: string): Promise<ContextExtractionResult> {
    return ContextExtractionResultSchema.parse(
      await this.request(`/api/conversations/${conversationId}/extract-context`, {
        method: 'POST',
      }),
    );
  }

  async syncMessages(
    conversationId: string,
    messages: readonly ParsedMessage[],
  ): Promise<SyncSummary> {
    const chunks = chunkItems(messages);

    if (chunks.length === 0) {
      throw new Error('There are no messages to sync.');
    }

    const summary: SyncSummary = {
      receivedMessages: 0,
      createdMessages: 0,
      updatedMessages: 0,
      lastSyncedAt: '',
    };

    for (const chunk of chunks) {
      const result = SyncResultSchema.parse(
        await this.request(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            messages: chunk.map((message) => ({
              providerMessageId: message.providerMessageId,
              role: message.role,
              content: message.content,
              sequence: message.sequence,
            })),
          }),
        }),
      );

      summary.receivedMessages += result.receivedMessages;
      summary.createdMessages += result.createdMessages;
      summary.updatedMessages += result.updatedMessages;
      summary.lastSyncedAt = result.lastSyncedAt;
    }

    return summary;
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.token}`);

    if (init.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    let response: Response;

    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: init.signal ?? AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      console.error('[Pro_Bridge] API request failed:', path, error);

      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ProBridgeApiError('The Pro_Bridge API request timed out.', 0);
      }

      const detail = error instanceof Error ? ` (${error.message})` : '';
      throw new ProBridgeApiError(
        `Could not reach the local Pro_Bridge API${detail}. Is the core running?`,
        0,
      );
    }

    const text = await response.text();
    let body: unknown = null;

    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }

    if (!response.ok) {
      const errorBody = ApiErrorBodySchema.safeParse(body);
      const message = errorBody.success
        ? errorBody.data.error.message
        : `The local API returned status ${response.status}.`;
      const code = errorBody.success ? errorBody.data.error.code : undefined;

      throw new ProBridgeApiError(message, response.status, code);
    }

    return body;
  }
}
