import type { SyncResult } from '@pro-bridge/shared-types';
import {
  ApiErrorBodySchema,
  ContextExtractionResultSchema,
  DecisionListResponseSchema,
  DecisionSchema,
  ProjectContextSchema,
  RequirementListResponseSchema,
  RequirementSchema,
  SyncResultSchema,
  TaskListResponseSchema,
  TaskSchema,
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

async function syncMessages(
  conversationId: string,
  messages: Array<{ providerMessageId: string; role: 'user' | 'assistant'; content: string }>,
): Promise<SyncResult> {
  const response = await app.inject({
    method: 'POST',
    url: `/api/conversations/${conversationId}/messages`,
    headers: AUTH_HEADERS,
    payload: {
      messages: messages.map((message, sequence) => ({ ...message, sequence })),
    },
  });

  expect(response.statusCode).toBe(200);
  return SyncResultSchema.parse(response.json());
}

async function extract(conversationId: string) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/conversations/${conversationId}/extract-context`,
    headers: AUTH_HEADERS,
  });

  expect(response.statusCode).toBe(200);
  return ContextExtractionResultSchema.parse(response.json());
}

describe('context extraction API', () => {
  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/conversations/00000000-0000-4000-8000-000000000000/extract-context',
    });

    expect(response.statusCode).toBe(401);
  });

  it('extracts proposed requirements, decisions and tasks', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);

    await syncMessages(conversation.id, [
      {
        providerMessageId: 'user-1',
        role: 'user',
        content: [
          'The app must run offline.',
          'We decided to use SQLite because it is local-first.',
          'Add a health endpoint.',
          'Which database should we use?',
        ].join(' '),
      },
      {
        providerMessageId: 'assistant-1',
        role: 'assistant',
        content: [
          '## Requirements',
          '- Must support multiple projects',
          '',
          '## Tasks',
          '- Add migration tests',
        ].join('\n'),
      },
    ]);

    const result = await extract(conversation.id);

    expect(result).toMatchObject({
      projectId: project.id,
      conversationId: conversation.id,
      requirementsCreated: 3,
      decisionsCreated: 1,
      tasksCreated: 2,
      duplicatesSkipped: 0,
    });
    expect(result.requirements.map((item) => [item.kind, item.text])).toEqual([
      ['constraint', 'The app must run offline.'],
      ['clarification', 'Which database should we use?'],
      ['requirement', 'Must support multiple projects'],
    ]);
    expect(result.decisions[0]).toMatchObject({
      text: 'We decided to use SQLite',
      rationale: 'it is local-first.',
      status: 'proposed',
    });
    expect(result.tasks.map((item) => item.title)).toEqual([
      'Add a health endpoint.',
      'Add migration tests',
    ]);
    expect(result.tasks.every((item) => item.approvalStatus === 'proposed')).toBe(true);
    expect(result.tasks.every((item) => item.status === 'pending')).toBe(true);
    expect(result.requirements.every((item) => item.status === 'proposed')).toBe(true);
  });

  it('is idempotent and does not recreate rejected items', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);

    await syncMessages(conversation.id, [
      {
        providerMessageId: 'user-1',
        role: 'user',
        content: 'The API must authenticate every request.',
      },
    ]);

    const first = await extract(conversation.id);
    expect(first.requirementsCreated).toBe(1);

    const requirementId = first.requirements[0]?.id;
    expect(requirementId).toBeDefined();

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/api/requirements/${requirementId}`,
      headers: AUTH_HEADERS,
      payload: { status: 'rejected' },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(RequirementSchema.parse(patchResponse.json()).status).toBe('rejected');

    const second = await extract(conversation.id);

    expect(second).toMatchObject({
      requirementsCreated: 0,
      decisionsCreated: 0,
      tasksCreated: 0,
      duplicatesSkipped: 1,
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/requirements`,
      headers: AUTH_HEADERS,
    });
    const list = RequirementListResponseSchema.parse(listResponse.json());
    expect(list.requirements).toHaveLength(1);
    expect(list.requirements[0]?.status).toBe('rejected');
  });

  it('lists and filters project context', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);

    await syncMessages(conversation.id, [
      {
        providerMessageId: 'user-1',
        role: 'user',
        content: [
          'The app must run offline.',
          'We decided to use SQLite because it is local-first.',
          'Add a health endpoint.',
        ].join(' '),
      },
    ]);

    await extract(conversation.id);

    const contextResponse = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/context`,
      headers: AUTH_HEADERS,
    });
    expect(contextResponse.statusCode).toBe(200);
    const context = ProjectContextSchema.parse(contextResponse.json());
    expect(context.requirements).toHaveLength(1);
    expect(context.decisions).toHaveLength(1);
    expect(context.tasks).toHaveLength(1);

    const filteredResponse = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/requirements?kind=constraint&status=proposed`,
      headers: AUTH_HEADERS,
    });
    expect(filteredResponse.statusCode).toBe(200);
    const filtered = RequirementListResponseSchema.parse(filteredResponse.json());
    expect(filtered.requirements).toHaveLength(1);
    expect(filtered.requirements[0]?.kind).toBe('constraint');

    const emptyResponse = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/requirements?kind=requirement`,
      headers: AUTH_HEADERS,
    });
    expect(RequirementListResponseSchema.parse(emptyResponse.json()).requirements).toEqual([]);
  });

  it('updates requirement, decision and task statuses', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);

    await syncMessages(conversation.id, [
      {
        providerMessageId: 'user-1',
        role: 'user',
        content: [
          'The app must run offline.',
          'We decided to use SQLite because it is local-first.',
          'Add a health endpoint.',
        ].join(' '),
      },
    ]);

    const result = await extract(conversation.id);
    const requirementId = result.requirements[0]?.id;
    const decisionId = result.decisions[0]?.id;
    const taskId = result.tasks[0]?.id;

    const requirementResponse = await app.inject({
      method: 'PATCH',
      url: `/api/requirements/${requirementId}`,
      headers: AUTH_HEADERS,
      payload: { status: 'confirmed' },
    });
    expect(RequirementSchema.parse(requirementResponse.json()).status).toBe('confirmed');

    const decisionResponse = await app.inject({
      method: 'PATCH',
      url: `/api/decisions/${decisionId}`,
      headers: AUTH_HEADERS,
      payload: { status: 'confirmed' },
    });
    expect(DecisionSchema.parse(decisionResponse.json()).status).toBe('confirmed');

    const taskResponse = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${taskId}`,
      headers: AUTH_HEADERS,
      payload: { approvalStatus: 'confirmed', status: 'in_progress' },
    });
    const inProgress = TaskSchema.parse(taskResponse.json());
    expect(inProgress.approvalStatus).toBe('confirmed');
    expect(inProgress.status).toBe('in_progress');
    expect(inProgress.completedAt).toBeNull();

    const completedResponse = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${taskId}`,
      headers: AUTH_HEADERS,
      payload: { status: 'completed' },
    });
    const completed = TaskSchema.parse(completedResponse.json());
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).not.toBeNull();

    const reopenedResponse = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${taskId}`,
      headers: AUTH_HEADERS,
      payload: { status: 'pending' },
    });
    const reopened = TaskSchema.parse(reopenedResponse.json());
    expect(reopened.status).toBe('pending');
    expect(reopened.completedAt).toBeNull();

    const decisionsResponse = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/decisions?status=confirmed`,
      headers: AUTH_HEADERS,
    });
    expect(DecisionListResponseSchema.parse(decisionsResponse.json()).decisions).toHaveLength(1);

    const tasksResponse = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/tasks?approvalStatus=confirmed`,
      headers: AUTH_HEADERS,
    });
    expect(TaskListResponseSchema.parse(tasksResponse.json()).tasks).toHaveLength(1);
  });

  it('rejects extraction for an unlinked conversation', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);

    const unlinkResponse = await app.inject({
      method: 'PATCH',
      url: `/api/conversations/${conversation.id}`,
      headers: AUTH_HEADERS,
      payload: { projectId: null },
    });
    expect(unlinkResponse.statusCode).toBe(200);

    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversation.id}/extract-context`,
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(400);
    const body = ApiErrorBodySchema.parse(response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for missing conversations, projects and context items', async () => {
    const missingConversation = await app.inject({
      method: 'POST',
      url: '/api/conversations/00000000-0000-4000-8000-000000000000/extract-context',
      headers: AUTH_HEADERS,
    });
    expect(missingConversation.statusCode).toBe(404);

    const missingProject = await app.inject({
      method: 'GET',
      url: '/api/projects/00000000-0000-4000-8000-000000000000/context',
      headers: AUTH_HEADERS,
    });
    expect(missingProject.statusCode).toBe(404);

    const missingRequirement = await app.inject({
      method: 'PATCH',
      url: '/api/requirements/00000000-0000-4000-8000-000000000000',
      headers: AUTH_HEADERS,
      payload: { status: 'confirmed' },
    });
    expect(missingRequirement.statusCode).toBe(404);

    const missingDecision = await app.inject({
      method: 'PATCH',
      url: '/api/decisions/00000000-0000-4000-8000-000000000000',
      headers: AUTH_HEADERS,
      payload: { status: 'confirmed' },
    });
    expect(missingDecision.statusCode).toBe(404);

    const missingTask = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/00000000-0000-4000-8000-000000000000',
      headers: AUTH_HEADERS,
      payload: { status: 'completed' },
    });
    expect(missingTask.statusCode).toBe(404);
  });

  it('rejects an empty task update', async () => {
    const project = await createProject(app);
    const conversation = await createConversation(app, project.id);

    await syncMessages(conversation.id, [
      {
        providerMessageId: 'user-1',
        role: 'user',
        content: 'Add a health endpoint.',
      },
    ]);

    const result = await extract(conversation.id);
    const taskId = result.tasks[0]?.id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${taskId}`,
      headers: AUTH_HEADERS,
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });
});
