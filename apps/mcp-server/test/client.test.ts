import type { AgentReport, AgentSession, Project } from '@pro-bridge/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { CoreApiClient, CoreApiError } from '../src/client.js';

const TOKEN = 't'.repeat(64);
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const CONVERSATION_ID = '22222222-2222-4222-8222-222222222222';
const AGENT_SESSION_ID = '77777777-7777-4777-8777-777777777777';
const AGENT_REPORT_ID = '88888888-8888-4888-8888-888888888888';
const TIMESTAMP = '2026-01-01T00:00:00.000Z';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function project(): Project {
  return {
    id: PROJECT_ID,
    name: 'Test Project',
    description: 'A project used by tests.',
    repositoryPath: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function agentSession(): AgentSession {
  return {
    id: AGENT_SESSION_ID,
    projectId: PROJECT_ID,
    agentName: 'Antigravity',
    externalSessionId: 'external-session-1',
    startedAt: TIMESTAMP,
    endedAt: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function agentReport(): AgentReport {
  return {
    id: AGENT_REPORT_ID,
    projectId: PROJECT_ID,
    agentSessionId: AGENT_SESSION_ID,
    taskId: null,
    type: 'progress',
    summary: 'Implemented the health endpoint.',
    details: null,
    modifiedFiles: ['apps/core/src/routes/health.ts'],
    createdAt: TIMESTAMP,
  };
}

function client(fetchImpl: typeof fetch, timeoutMs?: number): CoreApiClient {
  return new CoreApiClient({
    baseUrl: 'http://127.0.0.1:4317/',
    token: TOKEN,
    fetchImpl,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
}

function authHeader(init: RequestInit | undefined): string | null {
  return new Headers(init?.headers).get('Authorization');
}

describe('CoreApiClient', () => {
  it('lists projects with bearer authentication', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ projects: [project()] }));

    const projects = await client(fetchImpl).listProjects();

    expect(projects).toEqual([project()]);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://127.0.0.1:4317/api/projects');
    expect(authHeader(fetchImpl.mock.calls[0]?.[1])).toBe(`Bearer ${TOKEN}`);
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('GET');
  });

  it('adds query parameters for conversations, messages and filters', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      if (url.includes('/messages')) {
        return Promise.resolve(jsonResponse({ messages: [] }));
      }

      if (url.includes('/requirements')) {
        return Promise.resolve(jsonResponse({ requirements: [] }));
      }

      if (url.includes('/tasks')) {
        return Promise.resolve(jsonResponse({ tasks: [] }));
      }

      return Promise.resolve(jsonResponse({ conversations: [] }));
    });

    const api = client(fetchImpl);

    await api.listConversations(PROJECT_ID);
    await api.listMessages(CONVERSATION_ID, { afterSequence: 4, limit: 25 });
    await api.listRequirements(PROJECT_ID, { kind: 'constraint', status: 'proposed' });
    await api.listTasks(PROJECT_ID, { status: 'pending', approvalStatus: 'confirmed' });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      `http://127.0.0.1:4317/api/conversations?projectId=${PROJECT_ID}`,
    );
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      `http://127.0.0.1:4317/api/conversations/${CONVERSATION_ID}/messages?afterSequence=4&limit=25`,
    );
    expect(fetchImpl.mock.calls[2]?.[0]).toBe(
      `http://127.0.0.1:4317/api/projects/${PROJECT_ID}/requirements?kind=constraint&status=proposed`,
    );
    expect(fetchImpl.mock.calls[3]?.[0]).toBe(
      `http://127.0.0.1:4317/api/projects/${PROJECT_ID}/tasks?status=pending&approvalStatus=confirmed`,
    );
  });

  it('starts, ends, reads and reports agent feedback', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/agent-sessions') && method === 'POST') {
        return Promise.resolve(jsonResponse(agentSession(), 201));
      }

      if (url.endsWith('/end') && method === 'POST') {
        return Promise.resolve(
          jsonResponse({ ...agentSession(), endedAt: TIMESTAMP, updatedAt: TIMESTAMP }),
        );
      }

      if (url.endsWith('/agent-sessions')) {
        return Promise.resolve(jsonResponse({ sessions: [agentSession()] }));
      }

      if (url.includes('/agent-sessions/') && url.includes('/reports')) {
        return Promise.resolve(jsonResponse({ reports: [agentReport()] }));
      }

      if (url.match(/\/agent-sessions\/[^/]+$/)) {
        return Promise.resolve(jsonResponse(agentSession()));
      }

      if (url.endsWith('/agent-reports') && method === 'POST') {
        return Promise.resolve(jsonResponse(agentReport(), 201));
      }

      if (url.includes('/agent-reports')) {
        return Promise.resolve(jsonResponse({ reports: [agentReport()] }));
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const api = client(fetchImpl);

    await expect(
      api.startAgentSession(PROJECT_ID, {
        agentName: 'Antigravity',
        externalSessionId: 'external-session-1',
      }),
    ).resolves.toEqual(agentSession());
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      `http://127.0.0.1:4317/api/projects/${PROJECT_ID}/agent-sessions`,
    );
    const startBody = fetchImpl.mock.calls[0]?.[1]?.body;

    if (typeof startBody !== 'string') {
      throw new Error('Expected a JSON request body.');
    }

    expect(JSON.parse(startBody)).toEqual({
      agentName: 'Antigravity',
      externalSessionId: 'external-session-1',
    });

    await expect(api.listAgentSessions(PROJECT_ID)).resolves.toEqual([agentSession()]);
    await expect(api.getAgentSession(AGENT_SESSION_ID)).resolves.toEqual(agentSession());
    await expect(
      api.endAgentSession(AGENT_SESSION_ID, { endedAt: TIMESTAMP }),
    ).resolves.toMatchObject({ endedAt: TIMESTAMP });

    await expect(
      api.createAgentReport(PROJECT_ID, {
        agentSessionId: AGENT_SESSION_ID,
        type: 'progress',
        summary: 'Implemented the health endpoint.',
        modifiedFiles: ['apps/core/src/routes/health.ts'],
      }),
    ).resolves.toEqual(agentReport());

    await expect(
      api.listAgentReports(PROJECT_ID, {
        agentSessionId: AGENT_SESSION_ID,
        type: 'progress',
        limit: 10,
      }),
    ).resolves.toEqual([agentReport()]);
    expect(fetchImpl.mock.calls.at(-1)?.[0]).toBe(
      `http://127.0.0.1:4317/api/projects/${PROJECT_ID}/agent-reports?agentSessionId=${AGENT_SESSION_ID}&type=progress&limit=10`,
    );

    await expect(api.listAgentSessionReports(AGENT_SESSION_ID)).resolves.toEqual([agentReport()]);
    expect(fetchImpl.mock.calls.at(-1)?.[0]).toBe(
      `http://127.0.0.1:4317/api/agent-sessions/${AGENT_SESSION_ID}/reports`,
    );
  });

  it('maps API errors to CoreApiError', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found.',
          },
        },
        404,
      ),
    );

    const error = await client(fetchImpl)
      .getProject(PROJECT_ID)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CoreApiError);
    expect(error).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Project not found.',
    });
  });

  it('reports connection and timeout failures without leaking details', async () => {
    const connectionFailure = vi.fn<typeof fetch>().mockRejectedValue(new Error('ECONNREFUSED'));
    const connectionError = await client(connectionFailure)
      .listProjects()
      .catch((caught: unknown) => caught);

    expect(connectionError).toBeInstanceOf(CoreApiError);
    expect(connectionError).toMatchObject({ status: 0 });
    expect((connectionError as Error).message).toMatch(/Could not reach/);

    const timeoutFailure = vi
      .fn<typeof fetch>()
      .mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));
    const timeoutError = await client(timeoutFailure, 10)
      .listProjects()
      .catch((caught: unknown) => caught);

    expect(timeoutError).toBeInstanceOf(CoreApiError);
    expect((timeoutError as Error).message).toMatch(/timed out/);
  });
});
