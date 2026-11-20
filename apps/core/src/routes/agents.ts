import {
  AgentReportCreateSchema,
  AgentReportListQuerySchema,
  AgentSessionCreateSchema,
  AgentSessionEndSchema,
  AgentSessionIdParamsSchema,
  AgentSessionReportListQuerySchema,
  ProjectIdParamsSchema,
} from '@pro-bridge/validation';
import type { FastifyInstance } from 'fastify';
import { parseInput } from '../http/parse.js';
import type { AgentService } from '../services/agent-service.js';

export function registerAgentRoutes(app: FastifyInstance, service: AgentService): void {
  app.post('/api/projects/:projectId/agent-sessions', (request, reply) => {
    const { projectId } = parseInput(ProjectIdParamsSchema, request.params);
    const input = parseInput(AgentSessionCreateSchema, request.body);

    return reply.code(201).send(service.startSession(projectId, input));
  });

  app.get('/api/projects/:projectId/agent-sessions', (request) => {
    const { projectId } = parseInput(ProjectIdParamsSchema, request.params);

    return { sessions: service.listSessions(projectId) };
  });

  app.get('/api/agent-sessions/:agentSessionId', (request) => {
    const { agentSessionId } = parseInput(AgentSessionIdParamsSchema, request.params);

    return service.getSession(agentSessionId);
  });

  app.post('/api/agent-sessions/:agentSessionId/end', (request) => {
    const { agentSessionId } = parseInput(AgentSessionIdParamsSchema, request.params);
    const input = parseInput(AgentSessionEndSchema, request.body ?? {});

    return service.endSession(agentSessionId, input);
  });

  app.get('/api/agent-sessions/:agentSessionId/reports', (request) => {
    const { agentSessionId } = parseInput(AgentSessionIdParamsSchema, request.params);
    const query = parseInput(AgentSessionReportListQuerySchema, request.query);

    return { reports: service.listSessionReports(agentSessionId, query) };
  });

  app.post('/api/projects/:projectId/agent-reports', (request, reply) => {
    const { projectId } = parseInput(ProjectIdParamsSchema, request.params);
    const input = parseInput(AgentReportCreateSchema, request.body);

    return reply.code(201).send(service.createReport(projectId, input));
  });

  app.get('/api/projects/:projectId/agent-reports', (request) => {
    const { projectId } = parseInput(ProjectIdParamsSchema, request.params);
    const query = parseInput(AgentReportListQuerySchema, request.query);

    return { reports: service.listReports(projectId, query) };
  });
}
