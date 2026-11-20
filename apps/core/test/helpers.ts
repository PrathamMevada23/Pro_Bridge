import type { Conversation, Project } from '@pro-bridge/shared-types';
import { ConversationSchema, ProjectSchema } from '@pro-bridge/validation';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

export const TEST_TOKEN = 'b'.repeat(64);
export const AUTH_HEADERS = {
  authorization: `Bearer ${TEST_TOKEN}`,
};

export async function createTestApp(): Promise<FastifyInstance> {
  const config = loadConfig({
    NODE_ENV: 'test',
    PRO_BRIDGE_LOCAL_TOKEN: TEST_TOKEN,
    PRO_BRIDGE_DATABASE_PATH: ':memory:',
  });

  return buildApp({ config, logger: false });
}

export async function createProject(
  app: FastifyInstance,
  overrides: Record<string, unknown> = {},
): Promise<Project> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: AUTH_HEADERS,
    payload: {
      name: 'Test Project',
      description: 'A project used by the test suite.',
      ...overrides,
    },
  });

  if (response.statusCode !== 201) {
    throw new Error(`Failed to create project: ${response.statusCode} ${response.body}`);
  }

  return ProjectSchema.parse(response.json());
}

export async function createConversation(
  app: FastifyInstance,
  projectId: string,
  overrides: Record<string, unknown> = {},
): Promise<Conversation> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: AUTH_HEADERS,
    payload: {
      projectId,
      provider: 'chatgpt',
      providerConversationId: 'chatgpt-conversation-1',
      url: 'https://chatgpt.com/c/chatgpt-conversation-1',
      title: 'Test conversation',
      ...overrides,
    },
  });

  if (response.statusCode !== 201) {
    throw new Error(`Failed to create conversation: ${response.statusCode} ${response.body}`);
  }

  const body = response.json<{ conversation: unknown }>();
  return ConversationSchema.parse(body.conversation);
}
