import {
  ProjectCreateSchema,
  ProjectIdParamsSchema,
  ProjectUpdateSchema,
} from '@pro-bridge/validation';
import type { FastifyInstance } from 'fastify';
import { parseInput } from '../http/parse.js';
import type { ProjectService } from '../services/project-service.js';

export function registerProjectRoutes(app: FastifyInstance, service: ProjectService): void {
  app.get('/api/projects', () => {
    return { projects: service.list() };
  });

  app.post('/api/projects', (request, reply) => {
    const input = parseInput(ProjectCreateSchema, request.body);
    const project = service.create(input);

    return reply.code(201).send(project);
  });

  app.get('/api/projects/:projectId', (request) => {
    const { projectId } = parseInput(ProjectIdParamsSchema, request.params);

    return service.get(projectId);
  });

  app.patch('/api/projects/:projectId', (request) => {
    const { projectId } = parseInput(ProjectIdParamsSchema, request.params);
    const input = parseInput(ProjectUpdateSchema, request.body);

    return service.update(projectId, input);
  });

  app.delete('/api/projects/:projectId', (request, reply) => {
    const { projectId } = parseInput(ProjectIdParamsSchema, request.params);
    service.delete(projectId);

    return reply.code(204).send();
  });
}
