import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { CoreApi } from './client.js';

function jsonResource(uri: URL, value: unknown): ReadResourceResult {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function variable(variables: Record<string, string | string[]>, name: string): string {
  const value = variables[name];
  const first = Array.isArray(value) ? value[0] : value;

  if (!first) {
    throw new Error(`Missing resource variable: ${name}`);
  }

  return first;
}

export function registerResources(server: McpServer, api: CoreApi): void {
  server.registerResource(
    'projects',
    'probridge://projects',
    {
      title: 'Pro_Bridge projects',
      description: 'All projects stored by the local Pro_Bridge core.',
      mimeType: 'application/json',
    },
    async (uri) => jsonResource(uri, await api.listProjects()),
  );

  const contextTemplate = new ResourceTemplate('probridge://projects/{projectId}/context', {
    list: async () => {
      const projects = await api.listProjects();

      return {
        resources: projects.map((project) => ({
          uri: `probridge://projects/${project.id}/context`,
          name: `Project context: ${project.name}`,
          description: `Requirements, decisions and tasks for ${project.name}.`,
          mimeType: 'application/json',
        })),
      };
    },
  });

  server.registerResource(
    'project-context',
    contextTemplate,
    {
      title: 'Project context',
      description:
        'Extracted requirements, decisions and tasks for one project. Items remain suggestions until reviewed.',
      mimeType: 'application/json',
    },
    async (uri, variables) =>
      jsonResource(uri, await api.getProjectContext(variable(variables, 'projectId'))),
  );

  const conversationsTemplate = new ResourceTemplate(
    'probridge://projects/{projectId}/conversations',
    {
      list: async () => {
        const projects = await api.listProjects();

        return {
          resources: projects.map((project) => ({
            uri: `probridge://projects/${project.id}/conversations`,
            name: `Project conversations: ${project.name}`,
            description: `Captured conversations linked to ${project.name}.`,
            mimeType: 'application/json',
          })),
        };
      },
    },
  );

  server.registerResource(
    'project-conversations',
    conversationsTemplate,
    {
      title: 'Project conversations',
      description: 'Captured conversations linked to one project.',
      mimeType: 'application/json',
    },
    async (uri, variables) =>
      jsonResource(uri, await api.listConversations(variable(variables, 'projectId'))),
  );

  const messagesTemplate = new ResourceTemplate(
    'probridge://conversations/{conversationId}/messages',
    {
      list: async () => {
        const conversations = await api.listConversations();

        return {
          resources: conversations.map((conversation) => ({
            uri: `probridge://conversations/${conversation.id}/messages`,
            name: `Conversation messages: ${
              conversation.title || conversation.providerConversationId
            }`,
            description: `Synchronized messages for ${conversation.url}.`,
            mimeType: 'application/json',
          })),
        };
      },
    },
  );

  server.registerResource(
    'conversation-messages',
    messagesTemplate,
    {
      title: 'Conversation messages',
      description: 'Synchronized messages for one conversation, in sequence order.',
      mimeType: 'application/json',
    },
    async (uri, variables) =>
      jsonResource(uri, await api.listMessages(variable(variables, 'conversationId'))),
  );

  const agentSessionsTemplate = new ResourceTemplate(
    'probridge://projects/{projectId}/agent-sessions',
    {
      list: async () => {
        const projects = await api.listProjects();

        return {
          resources: projects.map((project) => ({
            uri: `probridge://projects/${project.id}/agent-sessions`,
            name: `Project agent sessions: ${project.name}`,
            description: `Coding-agent sessions recorded for ${project.name}.`,
            mimeType: 'application/json',
          })),
        };
      },
    },
  );

  server.registerResource(
    'project-agent-sessions',
    agentSessionsTemplate,
    {
      title: 'Project agent sessions',
      description: 'Coding-agent sessions recorded for one project, newest first.',
      mimeType: 'application/json',
    },
    async (uri, variables) =>
      jsonResource(uri, await api.listAgentSessions(variable(variables, 'projectId'))),
  );

  const agentReportsTemplate = new ResourceTemplate(
    'probridge://projects/{projectId}/agent-reports',
    {
      list: async () => {
        const projects = await api.listProjects();

        return {
          resources: projects.map((project) => ({
            uri: `probridge://projects/${project.id}/agent-reports`,
            name: `Project agent reports: ${project.name}`,
            description: `Append-only coding-agent feedback for ${project.name}.`,
            mimeType: 'application/json',
          })),
        };
      },
    },
  );

  server.registerResource(
    'project-agent-reports',
    agentReportsTemplate,
    {
      title: 'Project agent reports',
      description:
        'Append-only coding-agent progress, completion and blocker reports for one project, newest first.',
      mimeType: 'application/json',
    },
    async (uri, variables) =>
      jsonResource(uri, await api.listAgentReports(variable(variables, 'projectId'))),
  );

  const sessionReportsTemplate = new ResourceTemplate(
    'probridge://agent-sessions/{agentSessionId}/reports',
    {
      list: async () => {
        const projects = await api.listProjects();
        const sessions = (
          await Promise.all(projects.map((project) => api.listAgentSessions(project.id)))
        ).flat();

        return {
          resources: sessions.map((session) => ({
            uri: `probridge://agent-sessions/${session.id}/reports`,
            name: `Agent session reports: ${session.agentName}`,
            description: `Feedback reported by ${session.agentName} for project ${session.projectId}.`,
            mimeType: 'application/json',
          })),
        };
      },
    },
  );

  server.registerResource(
    'agent-session-reports',
    sessionReportsTemplate,
    {
      title: 'Agent session reports',
      description: 'Append-only feedback for one coding-agent session, newest first.',
      mimeType: 'application/json',
    },
    async (uri, variables) =>
      jsonResource(uri, await api.listAgentSessionReports(variable(variables, 'agentSessionId'))),
  );
}
