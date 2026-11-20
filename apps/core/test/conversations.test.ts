import {
  ApiErrorBodySchema,
  ConversationListResponseSchema,
  ConversationSchema,
  LinkConversationResponseSchema,
  MessageListResponseSchema,
  SyncCheckpointSchema,
  SyncResultSchema,
} from '@pro-bridge/validation';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AUTH_HEADERS, createConversation, createProject, createTestApp } from './helpers.js';

let app: FastifyInstance;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  await app.close();
});

describe('conversation API', () => {
  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/conversations',
    });

    expect(response.statusCode).toBe(401);
  });

  it('links a conversation to a project and lists it', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);

    expect(conversation.projectId).toBe(project.id);

    const response = await app.inject({
      method: 'GET',
      url: `/api/conversations?projectId=${project.id}`,
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const body = ConversationListResponseSchema.parse(response.json());
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0]?.id).toBe(conversation.id);
  });

  it('is idempotent when the same provider conversation is linked again', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: AUTH_HEADERS,
      payload: {
        projectId: project.id,
        provider: conversation.provider,
        providerConversationId: conversation.providerConversationId,
        url: conversation.url,
        title: 'Updated conversation title',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = LinkConversationResponseSchema.parse(response.json());
    expect(body.created).toBe(false);
    expect(body.conversation.id).toBe(conversation.id);
    expect(body.conversation.title).toBe('Updated conversation title');
  });

  it('rejects linking a conversation to a missing project', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: AUTH_HEADERS,
      payload: {
        projectId: '00000000-0000-4000-8000-000000000000',
        provider: 'chatgpt',
        providerConversationId: 'missing-project',
        url: 'https://chatgpt.com/c/missing-project',
      },
    });

    expect(response.statusCode).toBe(404);
    const body = ApiErrorBodySchema.parse(response.json());
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('updates and deletes a conversation', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/api/conversations/${conversation.id}`,
      headers: AUTH_HEADERS,
      payload: {
        title: 'Renamed conversation',
        url: 'https://chatgpt.com/c/renamed',
      },
    });

    expect(patchResponse.statusCode).toBe(200);
    const updated = ConversationSchema.parse(patchResponse.json());
    expect(updated.title).toBe('Renamed conversation');
    expect(updated.url).toBe('https://chatgpt.com/c/renamed');

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/conversations/${conversation.id}`,
      headers: AUTH_HEADERS,
    });

    expect(deleteResponse.statusCode).toBe(204);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/conversations/${conversation.id}`,
      headers: AUTH_HEADERS,
    });

    expect(getResponse.statusCode).toBe(404);
  });

  it('unlinks conversations when their project is deleted', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);

    await app.inject({
      method: 'DELETE',
      url: `/api/projects/${project.id}`,
      headers: AUTH_HEADERS,
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/conversations/${conversation.id}`,
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const updated = ConversationSchema.parse(response.json());
    expect(updated.projectId).toBeNull();
  });

  it('syncs messages idempotently and tracks edits', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);
    const userMessage = {
      providerMessageId: 'message-1',
      role: 'user' as const,
      content: 'Hello',
      sequence: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const assistantMessage = {
      providerMessageId: 'message-2',
      role: 'assistant' as const,
      content: 'Hi there',
      sequence: 1,
    };

    const firstResponse = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversation.id}/messages`,
      headers: AUTH_HEADERS,
      payload: {
        messages: [userMessage, assistantMessage],
      },
    });

    expect(firstResponse.statusCode).toBe(200);
    const firstResult = SyncResultSchema.parse(firstResponse.json());
    expect(firstResult.receivedMessages).toBe(2);
    expect(firstResult.createdMessages).toBe(2);
    expect(firstResult.updatedMessages).toBe(0);
    expect(firstResult.messages).toHaveLength(2);
    expect(firstResult.messages[0]?.content).toBe('Hello');
    expect(firstResult.messages[0]?.editedAt).toBeNull();

    const secondResponse = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversation.id}/messages`,
      headers: AUTH_HEADERS,
      payload: {
        messages: [userMessage, assistantMessage],
      },
    });

    const secondResult = SyncResultSchema.parse(secondResponse.json());
    expect(secondResult.createdMessages).toBe(0);
    expect(secondResult.updatedMessages).toBe(0);
    expect(secondResult.messages).toHaveLength(2);

    const editedResponse = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversation.id}/messages`,
      headers: AUTH_HEADERS,
      payload: {
        messages: [{ ...userMessage, content: 'Hello, edited' }],
      },
    });

    const editedResult = SyncResultSchema.parse(editedResponse.json());
    expect(editedResult.createdMessages).toBe(0);
    expect(editedResult.updatedMessages).toBe(1);
    expect(editedResult.messages[0]?.content).toBe('Hello, edited');
    expect(editedResult.messages[0]?.editedAt).not.toBeNull();
  });

  it('returns an idle sync status before the first sync', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);

    const response = await app.inject({
      method: 'GET',
      url: `/api/conversations/${conversation.id}/sync-status`,
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const status = SyncCheckpointSchema.parse(response.json());
    expect(status).toEqual({
      conversationId: conversation.id,
      lastMessageSequence: 0,
      lastMessageId: null,
      lastSyncedAt: null,
      status: 'idle',
      lastError: null,
    });
  });

  it('returns the checkpoint after syncing messages', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);

    const syncResponse = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversation.id}/messages`,
      headers: AUTH_HEADERS,
      payload: {
        messages: [
          { providerMessageId: 'm1', role: 'user', content: 'First', sequence: 0 },
          { providerMessageId: 'm2', role: 'assistant', content: 'Second', sequence: 1 },
        ],
      },
    });

    const syncResult = SyncResultSchema.parse(syncResponse.json());

    const response = await app.inject({
      method: 'GET',
      url: `/api/conversations/${conversation.id}/sync-status`,
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const status = SyncCheckpointSchema.parse(response.json());
    expect(status.conversationId).toBe(conversation.id);
    expect(status.lastMessageSequence).toBe(1);
    expect(status.lastMessageId).toBe(syncResult.messages[1]?.id);
    expect(status.lastSyncedAt).toBe(syncResult.lastSyncedAt);
    expect(status.status).toBe('success');
    expect(status.lastError).toBeNull();
  });

  it('returns 404 for a missing conversation sync status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/conversations/00000000-0000-4000-8000-000000000000/sync-status',
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns messages after a sequence', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);

    await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversation.id}/messages`,
      headers: AUTH_HEADERS,
      payload: {
        messages: [
          { providerMessageId: 'm1', role: 'user', content: 'First', sequence: 0 },
          { providerMessageId: 'm2', role: 'assistant', content: 'Second', sequence: 1 },
        ],
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/conversations/${conversation.id}/messages?afterSequence=0&limit=10`,
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const body = MessageListResponseSchema.parse(response.json());
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]?.providerMessageId).toBe('m2');
  });

  it('rejects duplicate provider message IDs in a sync request', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);

    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversation.id}/messages`,
      headers: AUTH_HEADERS,
      payload: {
        messages: [
          { providerMessageId: 'duplicate', role: 'user', content: 'First', sequence: 0 },
          { providerMessageId: 'duplicate', role: 'assistant', content: 'Second', sequence: 1 },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = ApiErrorBodySchema.parse(response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when syncing to a missing conversation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/conversations/00000000-0000-4000-8000-000000000000/messages',
      headers: AUTH_HEADERS,
      payload: {
        messages: [{ providerMessageId: 'm1', role: 'user', content: 'Hello', sequence: 0 }],
      },
    });

    expect(response.statusCode).toBe(404);
  });
});
