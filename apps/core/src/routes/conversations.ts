import {
  ConversationCreateSchema,
  ConversationIdParamsSchema,
  ConversationListQuerySchema,
  ConversationUpdateSchema,
  MessageListQuerySchema,
  SyncMessagesSchema,
} from '@pro-bridge/validation';
import type { FastifyInstance } from 'fastify';
import { parseInput } from '../http/parse.js';
import type { ConversationService } from '../services/conversation-service.js';

export function registerConversationRoutes(
  app: FastifyInstance,
  service: ConversationService,
): void {
  app.get('/api/conversations', (request) => {
    const query = parseInput(ConversationListQuerySchema, request.query);

    return { conversations: service.list(query.projectId) };
  });

  app.post('/api/conversations', (request, reply) => {
    const input = parseInput(ConversationCreateSchema, request.body);
    const result = service.link(input);

    return reply.code(result.created ? 201 : 200).send(result);
  });

  app.get('/api/conversations/:conversationId', (request) => {
    const { conversationId } = parseInput(ConversationIdParamsSchema, request.params);

    return service.get(conversationId);
  });

  app.patch('/api/conversations/:conversationId', (request) => {
    const { conversationId } = parseInput(ConversationIdParamsSchema, request.params);
    const input = parseInput(ConversationUpdateSchema, request.body);

    return service.update(conversationId, input);
  });

  app.delete('/api/conversations/:conversationId', (request, reply) => {
    const { conversationId } = parseInput(ConversationIdParamsSchema, request.params);
    service.delete(conversationId);

    return reply.code(204).send();
  });

  app.get('/api/conversations/:conversationId/sync-status', (request) => {
    const { conversationId } = parseInput(ConversationIdParamsSchema, request.params);

    return service.getSyncStatus(conversationId);
  });

  app.get('/api/conversations/:conversationId/messages', (request) => {
    const { conversationId } = parseInput(ConversationIdParamsSchema, request.params);
    const query = parseInput(MessageListQuerySchema, request.query);

    return { messages: service.listMessages(conversationId, query) };
  });

  app.post('/api/conversations/:conversationId/messages', (request) => {
    const { conversationId } = parseInput(ConversationIdParamsSchema, request.params);
    const input = parseInput(SyncMessagesSchema, request.body);

    return service.syncMessages(conversationId, input);
  });
}
