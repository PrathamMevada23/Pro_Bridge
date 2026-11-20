import {
  ConversationIdParamsSchema,
  DecisionIdParamsSchema,
  DecisionListQuerySchema,
  DecisionUpdateSchema,
  ProjectIdParamsSchema,
  RequirementIdParamsSchema,
  RequirementListQuerySchema,
  RequirementUpdateSchema,
  TaskIdParamsSchema,
  TaskListQuerySchema,
  TaskUpdateSchema,
} from '@pro-bridge/validation';
import type { FastifyInstance } from 'fastify';
import { parseInput } from '../http/parse.js';
import type { ContextService } from '../services/context-service.js';

export function registerContextRoutes(app: FastifyInstance, service: ContextService): void {
  app.post('/api/conversations/:conversationId/extract-context', (request) => {
    const { conversationId } = parseInput(ConversationIdParamsSchema, request.params);

    return service.extractConversation(conversationId);
  });

  app.get('/api/projects/:projectId/context', (request) => {
    const { projectId } = parseInput(ProjectIdParamsSchema, request.params);

    return service.getProjectContext(projectId);
  });

  app.get('/api/projects/:projectId/requirements', (request) => {
    const { projectId } = parseInput(ProjectIdParamsSchema, request.params);
    const query = parseInput(RequirementListQuerySchema, request.query);

    return { requirements: service.listRequirements(projectId, query) };
  });

  app.get('/api/projects/:projectId/decisions', (request) => {
    const { projectId } = parseInput(ProjectIdParamsSchema, request.params);
    const query = parseInput(DecisionListQuerySchema, request.query);

    return { decisions: service.listDecisions(projectId, query) };
  });

  app.get('/api/projects/:projectId/tasks', (request) => {
    const { projectId } = parseInput(ProjectIdParamsSchema, request.params);
    const query = parseInput(TaskListQuerySchema, request.query);

    return { tasks: service.listTasks(projectId, query) };
  });

  app.patch('/api/requirements/:requirementId', (request) => {
    const { requirementId } = parseInput(RequirementIdParamsSchema, request.params);
    const input = parseInput(RequirementUpdateSchema, request.body);

    return service.updateRequirement(requirementId, input);
  });

  app.patch('/api/decisions/:decisionId', (request) => {
    const { decisionId } = parseInput(DecisionIdParamsSchema, request.params);
    const input = parseInput(DecisionUpdateSchema, request.body);

    return service.updateDecision(decisionId, input);
  });

  app.patch('/api/tasks/:taskId', (request) => {
    const { taskId } = parseInput(TaskIdParamsSchema, request.params);
    const input = parseInput(TaskUpdateSchema, request.body);

    return service.updateTask(taskId, input);
  });
}
