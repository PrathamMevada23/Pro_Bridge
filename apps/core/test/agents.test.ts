import type { AgentSession, Task } from '@pro-bridge/shared-types';
import {
  AgentReportListResponseSchema,
  AgentReportSchema,
  AgentSessionListResponseSchema,
  AgentSessionSchema,
  ApiErrorBodySchema,
  ContextExtractionResultSchema,
  SyncResultSchema,
  TaskListResponseSchema,
} from '@pro-bridge/validation';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AUTH_HEADERS, createConversation, createProject, createTestApp } from './helpers.js';

let app: FastifyInstance;
let conversationCounter = 0;

beforeEach(async () => {
  app = await createTestApp();
  conversationCounter = 0;
});

afterEach(async () => {
  await app.close();
});

async function syncMessages(
  conversationId: string,
  messages: Array<{ providerMessageId: string; role: 'user' | 'assistant'; content: string }>,
): Promise<void> {
  const response = await app.inject({
    method: 'POST',
    url: `/api/conversations/${conversationId}/messages`,
    headers: AUTH_HEADERS,
    payload: {
      messages: messages.map((message, sequence) => ({ ...message, sequence })),
    },
  });

  expect(response.statusCode).toBe(200);
  SyncResultSchema.parse(response.json());
}

async function createTask(projectId: string, text: string): Promise<Task> {
  conversationCounter += 1;
  const suffix = conversationCounter;
  const conversation = await createConversation(app, projectId, {
    providerConversationId: `agent-feedback-conversation-${suffix}`,
    url: `https://chatgpt.com/c/agent-feedback-conversation-${suffix}`,
  });

  await syncMessages(conversation.id, [
    {
      providerMessageId: `agent-feedback-user-${suffix}`,
      role: 'user',
      content: text,
    },
  ]);

  const response = await app.inject({
    method: 'POST',
    url: `/api/conversations/${conversation.id}/extract-context`,
    headers: AUTH_HEADERS,
  });

  expect(response.statusCode).toBe(200);
  const result = ContextExtractionResultSchema.parse(response.json());
  const task = result.tasks[0];

  if (!task) {
    throw new Error('Expected context extraction to create a task.');
  }

  return task;
}

async function startSession(
  projectId: string,
  overrides: Record<string, unknown> = {},
): Promise<AgentSession> {
  const response = await app.inject({
    method: 'POST',
    url: `/api/projects/${projectId}/agent-sessions`,
    headers: AUTH_HEADERS,
    payload: {
      agentName: 'Antigravity',
      ...overrides,
    },
  });

  expect(response.statusCode).toBe(201);
  return AgentSessionSchema.parse(response.json());
}

describe('agent session API', () => {
  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/projects/00000000-0000-4000-8000-000000000000/agent-sessions',
      payload: { agentName: 'Antigravity' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('starts, reads, lists and ends an agent session', async () => {
    const project = await createProject(app);
    const startedAt = '2026-01-01T10:00:00.000Z';

    const session = await startSession(project.id, {
      agentName: 'Codex',
      externalSessionId: 'external-123',
      startedAt,
    });

    expect(session).toMatchObject({
      projectId: project.id,
      agentName: 'Codex',
      externalSessionId: 'external-123',
      startedAt,
      endedAt: null,
    });

    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/agent-sessions/${session.id}`,
      headers: AUTH_HEADERS,
    });
    expect(getResponse.statusCode).toBe(200);
    expect(AgentSessionSchema.parse(getResponse.json())).toEqual(session);

    const listResponse = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/agent-sessions`,
      headers: AUTH_HEADERS,
    });
    expect(listResponse.statusCode).toBe(200);
    const list = AgentSessionListResponseSchema.parse(listResponse.json());
    expect(list.sessions).toEqual([session]);

    const endedAt = '2026-01-01T10:30:00.000Z';
    const endResponse = await app.inject({
      method: 'POST',
      url: `/api/agent-sessions/${session.id}/end`,
      headers: AUTH_HEADERS,
      payload: { endedAt },
    });
    expect(endResponse.statusCode).toBe(200);
    const ended = AgentSessionSchema.parse(endResponse.json());
    expect(ended.endedAt).toBe(endedAt);
    expect(ended.updatedAt).toBe(endedAt);

    const secondEndResponse = await app.inject({
      method: 'POST',
      url: `/api/agent-sessions/${session.id}/end`,
      headers: AUTH_HEADERS,
      payload: { endedAt: '2026-01-01T11:00:00.000Z' },
    });
    expect(secondEndResponse.statusCode).toBe(200);
    expect(AgentSessionSchema.parse(secondEndResponse.json())).toEqual(ended);
  });

  it('rejects an end time before the session start', async () => {
    const project = await createProject(app);
    const session = await startSession(project.id, {
      startedAt: '2026-01-01T10:00:00.000Z',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/agent-sessions/${session.id}/end`,
      headers: AUTH_HEADERS,
      payload: { endedAt: '2026-01-01T09:59:59.000Z' },
    });

    expect(response.statusCode).toBe(400);
    expect(ApiErrorBodySchema.parse(response.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns not found for unknown projects and sessions', async () => {
    const unknownId = '99999999-9999-4999-8999-999999999999';

    const startResponse = await app.inject({
      method: 'POST',
      url: `/api/projects/${unknownId}/agent-sessions`,
      headers: AUTH_HEADERS,
      payload: { agentName: 'Antigravity' },
    });
    expect(startResponse.statusCode).toBe(404);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/agent-sessions/${unknownId}`,
      headers: AUTH_HEADERS,
    });
    expect(getResponse.statusCode).toBe(404);

    const endResponse = await app.inject({
      method: 'POST',
      url: `/api/agent-sessions/${unknownId}/end`,
      headers: AUTH_HEADERS,
      payload: {},
    });
    expect(endResponse.statusCode).toBe(404);
  });
});

describe('agent report API', () => {
  it('appends reports and never changes task approval or status', async () => {
    const project = await createProject(app);
    const task = await createTask(project.id, 'Add a health endpoint.');
    const session = await startSession(project.id);

    const progressResponse = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/agent-reports`,
      headers: AUTH_HEADERS,
      payload: {
        agentSessionId: session.id,
        taskId: task.id,
        type: 'progress',
        summary: 'Implemented the endpoint.',
        details: 'Ran the core test suite.',
        modifiedFiles: ['apps/core/src/routes/health.ts'],
      },
    });
    expect(progressResponse.statusCode).toBe(201);
    const progress = AgentReportSchema.parse(progressResponse.json());
    expect(progress).toMatchObject({
      projectId: project.id,
      agentSessionId: session.id,
      taskId: task.id,
      type: 'progress',
      summary: 'Implemented the endpoint.',
      details: 'Ran the core test suite.',
      modifiedFiles: ['apps/core/src/routes/health.ts'],
    });

    const completionResponse = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/agent-reports`,
      headers: AUTH_HEADERS,
      payload: {
        agentSessionId: session.id,
        taskId: task.id,
        type: 'completion',
        summary: 'Health endpoint is ready for review.',
      },
    });
    expect(completionResponse.statusCode).toBe(201);
    AgentReportSchema.parse(completionResponse.json());

    const blockerResponse = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/agent-reports`,
      headers: AUTH_HEADERS,
      payload: {
        agentSessionId: session.id,
        type: 'blocker',
        summary: 'Waiting for a decision on the response shape.',
      },
    });
    expect(blockerResponse.statusCode).toBe(201);
    AgentReportSchema.parse(blockerResponse.json());

    const listResponse = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/agent-reports`,
      headers: AUTH_HEADERS,
    });
    expect(listResponse.statusCode).toBe(200);
    const list = AgentReportListResponseSchema.parse(listResponse.json());
    expect(list.reports.map((report) => report.type).sort()).toEqual([
      'blocker',
      'completion',
      'progress',
    ]);

    const filteredResponse = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/agent-reports?type=progress&taskId=${task.id}`,
      headers: AUTH_HEADERS,
    });
    const filtered = AgentReportListResponseSchema.parse(filteredResponse.json());
    expect(filtered.reports).toEqual([progress]);

    const sessionReportsResponse = await app.inject({
      method: 'GET',
      url: `/api/agent-sessions/${session.id}/reports`,
      headers: AUTH_HEADERS,
    });
    expect(sessionReportsResponse.statusCode).toBe(200);
    const sessionReports = AgentReportListResponseSchema.parse(sessionReportsResponse.json());
    expect(sessionReports.reports).toHaveLength(3);

    const tasksResponse = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/tasks`,
      headers: AUTH_HEADERS,
    });
    const tasks = TaskListResponseSchema.parse(tasksResponse.json()).tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: task.id,
      approvalStatus: 'proposed',
      status: 'pending',
      completedAt: null,
    });
  });

  it('rejects reports for a session or task from another project', async () => {
    const project = await createProject(app, { name: 'Project A' });
    const otherProject = await createProject(app, { name: 'Project B' });
    const otherSession = await startSession(otherProject.id);
    const otherTask = await createTask(otherProject.id, 'Add a metrics endpoint.');

    const sessionResponse = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/agent-reports`,
      headers: AUTH_HEADERS,
      payload: {
        agentSessionId: otherSession.id,
        type: 'progress',
        summary: 'Cross-project session.',
      },
    });
    expect(sessionResponse.statusCode).toBe(400);
    expect(ApiErrorBodySchema.parse(sessionResponse.json()).error.code).toBe('VALIDATION_ERROR');

    const taskResponse = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/agent-reports`,
      headers: AUTH_HEADERS,
      payload: {
        taskId: otherTask.id,
        type: 'progress',
        summary: 'Cross-project task.',
      },
    });
    expect(taskResponse.statusCode).toBe(400);
    expect(ApiErrorBodySchema.parse(taskResponse.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns not found for unknown projects, sessions and tasks', async () => {
    const project = await createProject(app);
    const unknownId = '99999999-9999-4999-8999-999999999999';

    const unknownProjectResponse = await app.inject({
      method: 'GET',
      url: `/api/projects/${unknownId}/agent-reports`,
      headers: AUTH_HEADERS,
    });
    expect(unknownProjectResponse.statusCode).toBe(404);

    const unknownSessionResponse = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/agent-reports`,
      headers: AUTH_HEADERS,
      payload: {
        agentSessionId: unknownId,
        type: 'progress',
        summary: 'Unknown session.',
      },
    });
    expect(unknownSessionResponse.statusCode).toBe(404);

    const unknownTaskResponse = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/agent-reports`,
      headers: AUTH_HEADERS,
      payload: {
        taskId: unknownId,
        type: 'progress',
        summary: 'Unknown task.',
      },
    });
    expect(unknownTaskResponse.statusCode).toBe(404);

    const unknownSessionReportsResponse = await app.inject({
      method: 'GET',
      url: `/api/agent-sessions/${unknownId}/reports`,
      headers: AUTH_HEADERS,
    });
    expect(unknownSessionReportsResponse.statusCode).toBe(404);
  });
});
