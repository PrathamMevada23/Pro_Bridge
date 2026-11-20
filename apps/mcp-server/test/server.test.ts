import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type {
  AgentReport,
  AgentSession,
  Conversation,
  Decision,
  Message,
  Project,
  ProjectContext,
  Requirement,
  Task,
} from '@pro-bridge/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreApiError, type CoreApi } from '../src/client.js';
import { createMcpServer } from '../src/server.js';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const CONVERSATION_ID = '22222222-2222-4222-8222-222222222222';
const MESSAGE_ID = '33333333-3333-4333-8333-333333333333';
const REQUIREMENT_ID = '44444444-4444-4444-8444-444444444444';
const DECISION_ID = '55555555-5555-4555-8555-555555555555';
const TASK_ID = '66666666-6666-4666-8666-666666666666';
const AGENT_SESSION_ID = '77777777-7777-4777-8777-777777777777';
const AGENT_REPORT_ID = '88888888-8888-4888-8888-888888888888';
const TIMESTAMP = '2026-01-01T00:00:00.000Z';

function project(): Project {
  return {
    id: PROJECT_ID,
    name: 'Test Project',
    description: 'A project used by the MCP test suite.',
    repositoryPath: '/tmp/test-project',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function conversation(): Conversation {
  return {
    id: CONVERSATION_ID,
    projectId: PROJECT_ID,
    provider: 'chatgpt',
    providerConversationId: 'chatgpt-conversation-1',
    url: 'https://chatgpt.com/c/chatgpt-conversation-1',
    title: 'Conversation',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    lastSyncedAt: TIMESTAMP,
  };
}

function message(): Message {
  return {
    id: MESSAGE_ID,
    conversationId: CONVERSATION_ID,
    providerMessageId: 'provider-message-1',
    role: 'user',
    content: 'The app must run offline.',
    contentHash: 'a'.repeat(64),
    sequence: 0,
    createdAt: TIMESTAMP,
    capturedAt: TIMESTAMP,
    editedAt: null,
  };
}

function requirement(): Requirement {
  return {
    id: REQUIREMENT_ID,
    projectId: PROJECT_ID,
    conversationId: CONVERSATION_ID,
    sourceMessageId: MESSAGE_ID,
    kind: 'constraint',
    text: 'The app must run offline.',
    status: 'proposed',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function decision(): Decision {
  return {
    id: DECISION_ID,
    projectId: PROJECT_ID,
    conversationId: CONVERSATION_ID,
    sourceMessageId: MESSAGE_ID,
    text: 'Use SQLite',
    rationale: 'It is local-first.',
    status: 'proposed',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function task(): Task {
  return {
    id: TASK_ID,
    projectId: PROJECT_ID,
    conversationId: CONVERSATION_ID,
    sourceMessageId: MESSAGE_ID,
    title: 'Add a health endpoint',
    description: '',
    approvalStatus: 'proposed',
    status: 'pending',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    completedAt: null,
  };
}

function context(): ProjectContext {
  return {
    projectId: PROJECT_ID,
    requirements: [requirement()],
    decisions: [decision()],
    tasks: [task()],
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
    taskId: TASK_ID,
    type: 'progress',
    summary: 'Implemented the health endpoint.',
    details: 'Ran the core test suite.',
    modifiedFiles: ['apps/core/src/routes/health.ts'],
    createdAt: TIMESTAMP,
  };
}

function createFakeApi() {
  return {
    listProjects: vi.fn(() => Promise.resolve([project()])),
    getProject: vi.fn((projectId: string) =>
      projectId === PROJECT_ID
        ? Promise.resolve(project())
        : Promise.reject(new CoreApiError('Project not found.', 404, 'NOT_FOUND')),
    ),
    listConversations: vi.fn(() => Promise.resolve([conversation()])),
    getConversation: vi.fn(() => Promise.resolve(conversation())),
    listMessages: vi.fn(() => Promise.resolve([message()])),
    getProjectContext: vi.fn(() => Promise.resolve(context())),
    listRequirements: vi.fn(() => Promise.resolve([requirement()])),
    listDecisions: vi.fn(() => Promise.resolve([decision()])),
    listTasks: vi.fn(() => Promise.resolve([task()])),
    listAgentSessions: vi.fn(() => Promise.resolve([agentSession()])),
    getAgentSession: vi.fn((agentSessionId: string) =>
      agentSessionId === AGENT_SESSION_ID
        ? Promise.resolve(agentSession())
        : Promise.reject(new CoreApiError('Agent session not found.', 404, 'NOT_FOUND')),
    ),
    startAgentSession: vi.fn(() => Promise.resolve(agentSession())),
    endAgentSession: vi.fn(() =>
      Promise.resolve({ ...agentSession(), endedAt: TIMESTAMP, updatedAt: TIMESTAMP }),
    ),
    listAgentReports: vi.fn(() => Promise.resolve([agentReport()])),
    listAgentSessionReports: vi.fn(() => Promise.resolve([agentReport()])),
    createAgentReport: vi.fn(() => Promise.resolve(agentReport())),
  } satisfies CoreApi;
}

function toolText(result: unknown): string {
  const content = (result as { content?: unknown }).content;

  if (!Array.isArray(content)) {
    throw new Error('Expected a tool result with content.');
  }

  const [block] = content as Array<{ type?: string; text?: string }>;

  if (!block || block.type !== 'text' || typeof block.text !== 'string') {
    throw new Error('Expected a text tool result.');
  }

  return block.text;
}

function parseToolText(result: unknown): unknown {
  return JSON.parse(toolText(result));
}

function parseResourceText(result: ReadResourceResult): unknown {
  const [block] = result.contents;

  if (!block || !('text' in block)) {
    throw new Error('Expected a text resource result.');
  }

  return JSON.parse(block.text);
}

let api: ReturnType<typeof createFakeApi>;
let server: McpServer;
let client: Client;

beforeEach(async () => {
  api = createFakeApi();
  server = createMcpServer(api, { version: 'test' });
  client = new Client({ name: 'pro-bridge-test-client', version: '1.0.0' });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
  await server.close();
});

describe('MCP tools', () => {
  it('exposes read tools and explicit agent feedback write tools', async () => {
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'end_agent_session',
      'get_agent_session',
      'get_conversation',
      'get_project',
      'get_project_context',
      'list_agent_reports',
      'list_agent_sessions',
      'list_conversations',
      'list_decisions',
      'list_messages',
      'list_projects',
      'list_requirements',
      'list_tasks',
      'report_blocker',
      'report_completion',
      'report_progress',
      'start_agent_session',
    ]);

    for (const tool of tools) {
      if (tool.name.startsWith('list_') || tool.name.startsWith('get_')) {
        expect(tool.annotations?.readOnlyHint).toBe(true);
      }
    }

    for (const name of [
      'start_agent_session',
      'end_agent_session',
      'report_progress',
      'report_completion',
      'report_blocker',
    ]) {
      const tool = tools.find((candidate) => candidate.name === name);
      expect(tool?.annotations?.readOnlyHint).toBe(false);
      expect(tool?.annotations?.destructiveHint).toBe(false);
    }
  });

  it('lists projects and returns project context as suggestions', async () => {
    const projectsResult = await client.callTool({ name: 'list_projects', arguments: {} });
    expect(parseToolText(projectsResult)).toEqual([project()]);

    const contextResult = await client.callTool({
      name: 'get_project_context',
      arguments: { projectId: PROJECT_ID },
    });
    expect(parseToolText(contextResult)).toEqual(context());
    expect(api.getProjectContext).toHaveBeenCalledWith(PROJECT_ID);
  });

  it('passes pagination and filter arguments to the core API', async () => {
    await client.callTool({
      name: 'list_messages',
      arguments: { conversationId: CONVERSATION_ID, afterSequence: 4, limit: 25 },
    });
    expect(api.listMessages).toHaveBeenCalledWith(CONVERSATION_ID, {
      afterSequence: 4,
      limit: 25,
    });

    await client.callTool({
      name: 'list_requirements',
      arguments: { projectId: PROJECT_ID, kind: 'constraint' },
    });
    expect(api.listRequirements).toHaveBeenCalledWith(PROJECT_ID, { kind: 'constraint' });

    await client.callTool({
      name: 'list_tasks',
      arguments: { projectId: PROJECT_ID, approvalStatus: 'proposed' },
    });
    expect(api.listTasks).toHaveBeenCalledWith(PROJECT_ID, { approvalStatus: 'proposed' });
  });

  it('reads agent sessions and reports', async () => {
    const sessionsResult = await client.callTool({
      name: 'list_agent_sessions',
      arguments: { projectId: PROJECT_ID },
    });
    expect(parseToolText(sessionsResult)).toEqual([agentSession()]);
    expect(api.listAgentSessions).toHaveBeenCalledWith(PROJECT_ID);

    const sessionResult = await client.callTool({
      name: 'get_agent_session',
      arguments: { agentSessionId: AGENT_SESSION_ID },
    });
    expect(parseToolText(sessionResult)).toEqual(agentSession());
    expect(api.getAgentSession).toHaveBeenCalledWith(AGENT_SESSION_ID);

    const reportsResult = await client.callTool({
      name: 'list_agent_reports',
      arguments: {
        projectId: PROJECT_ID,
        agentSessionId: AGENT_SESSION_ID,
        taskId: TASK_ID,
        type: 'progress',
        limit: 10,
      },
    });
    expect(parseToolText(reportsResult)).toEqual([agentReport()]);
    expect(api.listAgentReports).toHaveBeenCalledWith(PROJECT_ID, {
      agentSessionId: AGENT_SESSION_ID,
      taskId: TASK_ID,
      type: 'progress',
      limit: 10,
    });
  });

  it('forwards agent session and report write arguments', async () => {
    await client.callTool({
      name: 'start_agent_session',
      arguments: {
        projectId: PROJECT_ID,
        agentName: 'Antigravity',
        externalSessionId: 'external-session-1',
        startedAt: TIMESTAMP,
      },
    });
    expect(api.startAgentSession).toHaveBeenCalledWith(PROJECT_ID, {
      agentName: 'Antigravity',
      externalSessionId: 'external-session-1',
      startedAt: TIMESTAMP,
    });

    await client.callTool({
      name: 'end_agent_session',
      arguments: { agentSessionId: AGENT_SESSION_ID },
    });
    expect(api.endAgentSession).toHaveBeenCalledWith(AGENT_SESSION_ID, {});

    await client.callTool({
      name: 'report_progress',
      arguments: {
        projectId: PROJECT_ID,
        agentSessionId: AGENT_SESSION_ID,
        taskId: TASK_ID,
        summary: 'Implemented the health endpoint.',
        details: 'Ran the core test suite.',
        modifiedFiles: ['apps/core/src/routes/health.ts'],
      },
    });
    expect(api.createAgentReport).toHaveBeenCalledWith(PROJECT_ID, {
      type: 'progress',
      summary: 'Implemented the health endpoint.',
      agentSessionId: AGENT_SESSION_ID,
      taskId: TASK_ID,
      details: 'Ran the core test suite.',
      modifiedFiles: ['apps/core/src/routes/health.ts'],
    });

    await client.callTool({
      name: 'report_completion',
      arguments: { projectId: PROJECT_ID, summary: 'Ready for review.' },
    });
    expect(api.createAgentReport).toHaveBeenLastCalledWith(PROJECT_ID, {
      type: 'completion',
      summary: 'Ready for review.',
    });

    await client.callTool({
      name: 'report_blocker',
      arguments: { projectId: PROJECT_ID, summary: 'Waiting on a decision.' },
    });
    expect(api.createAgentReport).toHaveBeenLastCalledWith(PROJECT_ID, {
      type: 'blocker',
      summary: 'Waiting on a decision.',
    });
  });

  it('returns tool errors instead of throwing', async () => {
    api.getProject.mockRejectedValueOnce(new CoreApiError('Project not found.', 404, 'NOT_FOUND'));

    const result = await client.callTool({
      name: 'get_project',
      arguments: { projectId: '99999999-9999-4999-8999-999999999999' },
    });

    expect(result.isError).toBe(true);
    expect(toolText(result)).toBe('Not found: Project not found.');
  });

  it('validates required tool arguments', async () => {
    const result = await client.callTool({ name: 'get_project', arguments: {} });

    expect(result.isError).toBe(true);
    expect(toolText(result)).toMatch(/Input validation error/);
  });
});

describe('MCP resources', () => {
  it('lists fixed resources and dynamic resource instances', async () => {
    const { resources } = await client.listResources();
    const uris = resources.map((resource) => resource.uri);

    expect(uris).toContain('probridge://projects');
    expect(uris).toContain(`probridge://projects/${PROJECT_ID}/context`);
    expect(uris).toContain(`probridge://projects/${PROJECT_ID}/conversations`);
    expect(uris).toContain(`probridge://conversations/${CONVERSATION_ID}/messages`);
    expect(uris).toContain(`probridge://projects/${PROJECT_ID}/agent-sessions`);
    expect(uris).toContain(`probridge://projects/${PROJECT_ID}/agent-reports`);
    expect(uris).toContain(`probridge://agent-sessions/${AGENT_SESSION_ID}/reports`);
  });

  it('lists resource templates', async () => {
    const { resourceTemplates } = await client.listResourceTemplates();

    expect(resourceTemplates.map((template) => template.uriTemplate)).toEqual([
      'probridge://projects/{projectId}/context',
      'probridge://projects/{projectId}/conversations',
      'probridge://conversations/{conversationId}/messages',
      'probridge://projects/{projectId}/agent-sessions',
      'probridge://projects/{projectId}/agent-reports',
      'probridge://agent-sessions/{agentSessionId}/reports',
    ]);
  });

  it('reads projects, context, conversations, messages and agent feedback', async () => {
    const projects = await client.readResource({ uri: 'probridge://projects' });
    expect(parseResourceText(projects)).toEqual([project()]);

    const contextResult = await client.readResource({
      uri: `probridge://projects/${PROJECT_ID}/context`,
    });
    expect(parseResourceText(contextResult)).toEqual(context());

    const conversations = await client.readResource({
      uri: `probridge://projects/${PROJECT_ID}/conversations`,
    });
    expect(parseResourceText(conversations)).toEqual([conversation()]);
    expect(api.listConversations).toHaveBeenCalledWith(PROJECT_ID);

    const messages = await client.readResource({
      uri: `probridge://conversations/${CONVERSATION_ID}/messages`,
    });
    expect(parseResourceText(messages)).toEqual([message()]);
    expect(api.listMessages).toHaveBeenCalledWith(CONVERSATION_ID);

    const sessions = await client.readResource({
      uri: `probridge://projects/${PROJECT_ID}/agent-sessions`,
    });
    expect(parseResourceText(sessions)).toEqual([agentSession()]);
    expect(api.listAgentSessions).toHaveBeenCalledWith(PROJECT_ID);

    const reports = await client.readResource({
      uri: `probridge://projects/${PROJECT_ID}/agent-reports`,
    });
    expect(parseResourceText(reports)).toEqual([agentReport()]);
    expect(api.listAgentReports).toHaveBeenCalledWith(PROJECT_ID);

    const sessionReports = await client.readResource({
      uri: `probridge://agent-sessions/${AGENT_SESSION_ID}/reports`,
    });
    expect(parseResourceText(sessionReports)).toEqual([agentReport()]);
    expect(api.listAgentSessionReports).toHaveBeenCalledWith(AGENT_SESSION_ID);
  });

  it('surfaces resource read errors', async () => {
    api.getProjectContext.mockRejectedValueOnce(
      new CoreApiError('Project not found.', 404, 'NOT_FOUND'),
    );

    await expect(
      client.readResource({ uri: `probridge://projects/${PROJECT_ID}/context` }),
    ).rejects.toThrow(/Project not found/);
  });
});
