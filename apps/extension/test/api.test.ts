import type { Conversation, ParsedConversation, ParsedMessage } from '@pro-bridge/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { chunkItems, ProBridgeApiError, ProBridgeClient, SYNC_BATCH_SIZE } from '../src/lib/api.js';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const CONVERSATION_ID = '22222222-2222-4222-8222-222222222222';
const TIMESTAMP = '2026-01-01T00:00:00.000Z';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: CONVERSATION_ID,
    projectId: PROJECT_ID,
    provider: 'chatgpt',
    providerConversationId: 'chatgpt-conversation-1',
    url: 'https://chatgpt.com/c/chatgpt-conversation-1',
    title: 'Conversation',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    lastSyncedAt: null,
    ...overrides,
  };
}

function parsedConversation(): ParsedConversation {
  return {
    provider: 'chatgpt',
    providerConversationId: 'chatgpt-conversation-1',
    url: 'https://chatgpt.com/c/chatgpt-conversation-1',
    title: 'Conversation',
    messages: [
      {
        providerMessageId: 'message-1',
        role: 'user',
        content: 'Hello',
        sequence: 0,
      },
    ],
  };
}

function messages(count: number): ParsedMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    providerMessageId: `message-${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${index}`,
    sequence: index,
  }));
}

function syncResult(receivedMessages: number, createdMessages: number) {
  return {
    conversationId: CONVERSATION_ID,
    receivedMessages,
    createdMessages,
    updatedMessages: 0,
    lastSyncedAt: TIMESTAMP,
    messages: [],
  };
}

function authHeader(init: RequestInit | undefined): string | null {
  return new Headers(init?.headers).get('Authorization');
}

function requestBody(init: RequestInit | undefined): unknown {
  const body = init?.body;

  if (typeof body !== 'string') {
    throw new Error('Expected a JSON string request body.');
  }

  const parsed: unknown = JSON.parse(body);
  return parsed;
}

function messageBatchSize(init: RequestInit | undefined): number {
  const body = requestBody(init);

  if (
    typeof body !== 'object' ||
    body === null ||
    !('messages' in body) ||
    !Array.isArray(body.messages)
  ) {
    throw new Error('Expected a messages array.');
  }

  return body.messages.length;
}

describe('chunkItems', () => {
  it('splits items into fixed-size batches', () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkItems([], 2)).toEqual([]);
    expect(chunkItems([1], SYNC_BATCH_SIZE)).toEqual([[1]]);
  });

  it('rejects invalid chunk sizes', () => {
    expect(() => chunkItems([1], 0)).toThrow('positive integer');
  });
});

describe('ProBridgeClient', () => {
  it('lists projects with the local bearer token', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValue(jsonResponse({ projects: [] }));
    const client = new ProBridgeClient({
      baseUrl: 'http://127.0.0.1:4317/',
      token: 'local-token',
      fetchImpl,
    });

    await expect(client.listProjects()).resolves.toEqual([]);

    const call = fetchImpl.mock.calls.at(0);
    expect(call?.[0]).toBe('http://127.0.0.1:4317/api/projects');
    expect(authHeader(call?.[1])).toBe('Bearer local-token');
  });

  it('finds a linked conversation by provider and provider ID', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          conversations: [
            conversation({ providerConversationId: 'other-conversation' }),
            conversation(),
          ],
        }),
      ),
    );
    const client = new ProBridgeClient({
      baseUrl: 'http://127.0.0.1:4317',
      token: 'local-token',
      fetchImpl,
    });

    const found = await client.findConversation('chatgpt', 'chatgpt-conversation-1');

    expect(found?.id).toBe(CONVERSATION_ID);
    await expect(client.findConversation('claude', 'missing')).resolves.toBeNull();
  });

  it('fetches the sync checkpoint for a conversation', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValue(
      jsonResponse({
        conversationId: CONVERSATION_ID,
        lastMessageSequence: 3,
        lastMessageId: 'message-id',
        lastSyncedAt: TIMESTAMP,
        status: 'success',
        lastError: null,
      }),
    );
    const client = new ProBridgeClient({
      baseUrl: 'http://127.0.0.1:4317',
      token: 'local-token',
      fetchImpl,
    });

    const checkpoint = await client.getSyncStatus(CONVERSATION_ID);

    expect(checkpoint.lastMessageSequence).toBe(3);
    expect(checkpoint.status).toBe('success');
    expect(fetchImpl.mock.calls.at(0)?.[0]).toBe(
      `http://127.0.0.1:4317/api/conversations/${CONVERSATION_ID}/sync-status`,
    );
  });

  it('requests context extraction for a conversation', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValue(
      jsonResponse({
        projectId: PROJECT_ID,
        conversationId: CONVERSATION_ID,
        requirementsCreated: 1,
        decisionsCreated: 1,
        tasksCreated: 1,
        duplicatesSkipped: 2,
        requirements: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            projectId: PROJECT_ID,
            conversationId: CONVERSATION_ID,
            sourceMessageId: null,
            kind: 'requirement',
            text: 'The API must authenticate requests.',
            status: 'proposed',
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
        ],
        decisions: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            projectId: PROJECT_ID,
            conversationId: CONVERSATION_ID,
            sourceMessageId: null,
            text: 'Use SQLite',
            rationale: 'It is local-first.',
            status: 'proposed',
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
        ],
        tasks: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            projectId: PROJECT_ID,
            conversationId: CONVERSATION_ID,
            sourceMessageId: null,
            title: 'Add a health endpoint',
            description: '',
            approvalStatus: 'proposed',
            status: 'pending',
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
            completedAt: null,
          },
        ],
      }),
    );
    const client = new ProBridgeClient({
      baseUrl: 'http://127.0.0.1:4317',
      token: 'local-token',
      fetchImpl,
    });

    const result = await client.extractContext(CONVERSATION_ID);

    expect(result.requirementsCreated).toBe(1);
    expect(result.duplicatesSkipped).toBe(2);
    expect(fetchImpl.mock.calls.at(0)?.[0]).toBe(
      `http://127.0.0.1:4317/api/conversations/${CONVERSATION_ID}/extract-context`,
    );
    expect(authHeader(fetchImpl.mock.calls.at(0)?.[1])).toBe('Bearer local-token');
  });

  it('links a parsed conversation to a project', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValue(jsonResponse({ conversation: conversation(), created: true }, 201));
    const client = new ProBridgeClient({
      baseUrl: 'http://127.0.0.1:4317',
      token: 'local-token',
      fetchImpl,
    });

    const result = await client.linkConversation(parsedConversation(), PROJECT_ID);

    expect(result.created).toBe(true);
    const call = fetchImpl.mock.calls.at(0);
    expect(call?.[0]).toBe('http://127.0.0.1:4317/api/conversations');
    expect(call?.[1]?.method).toBe('POST');
    expect(requestBody(call?.[1])).toEqual({
      projectId: PROJECT_ID,
      provider: 'chatgpt',
      providerConversationId: 'chatgpt-conversation-1',
      url: 'https://chatgpt.com/c/chatgpt-conversation-1',
      title: 'Conversation',
    });
  });

  it('syncs messages in batches and aggregates the results', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    let callCount = 0;
    fetchImpl.mockImplementation(() => {
      callCount += 1;
      const received = callCount === 3 ? 201 : SYNC_BATCH_SIZE;
      return Promise.resolve(jsonResponse(syncResult(received, received)));
    });
    const client = new ProBridgeClient({
      baseUrl: 'http://127.0.0.1:4317',
      token: 'local-token',
      fetchImpl,
    });

    const summary = await client.syncMessages(CONVERSATION_ID, messages(1201));

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(summary).toEqual({
      receivedMessages: 1201,
      createdMessages: 1201,
      updatedMessages: 0,
      lastSyncedAt: TIMESTAMP,
    });

    const batchSizes = fetchImpl.mock.calls.map((call) => messageBatchSize(call[1]));
    expect(batchSizes).toEqual([500, 500, 201]);
  });

  it('surfaces API error messages and codes', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid local token is required.',
          },
        },
        401,
      ),
    );
    const client = new ProBridgeClient({
      baseUrl: 'http://127.0.0.1:4317',
      token: 'bad-token',
      fetchImpl,
    });

    await expect(client.listProjects()).rejects.toMatchObject({
      name: 'ProBridgeApiError',
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'A valid local token is required.',
    });
  });

  it('reports when the local API is unreachable', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockRejectedValue(new TypeError('Failed to fetch'));
    const client = new ProBridgeClient({
      baseUrl: 'http://127.0.0.1:4317',
      token: 'local-token',
      fetchImpl,
    });

    const failure = client.listProjects();

    await expect(failure).rejects.toBeInstanceOf(ProBridgeApiError);
    await expect(failure).rejects.toThrow('Could not reach the local Pro_Bridge API');
  });
});
