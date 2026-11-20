import { ApiErrorBodySchema, ProjectSchema } from '@pro-bridge/validation';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AUTH_HEADERS, createProject, createTestApp } from './helpers.js';

let app: FastifyInstance;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  await app.close();
});

describe('project API', () => {
  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/projects',
    });

    expect(response.statusCode).toBe(401);
  });

  it('creates and lists projects', async () => {
    const project = await createProject(app, {
      name: 'Pro_Bridge',
      description: 'Local-first bridge.',
      repositoryPath: '/Users/example/Pro_Bridge',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/projects',
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ projects: unknown[] }>();
    expect(body.projects).toHaveLength(1);
    expect(ProjectSchema.parse(body.projects[0])).toEqual(project);
  });

  it('gets and updates a project', async () => {
    const project = await createProject(app);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}`,
      headers: AUTH_HEADERS,
    });

    expect(getResponse.statusCode).toBe(200);
    expect(ProjectSchema.parse(getResponse.json())).toEqual(project);

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${project.id}`,
      headers: AUTH_HEADERS,
      payload: {
        name: 'Updated project',
        repositoryPath: null,
      },
    });

    expect(patchResponse.statusCode).toBe(200);
    const updated = ProjectSchema.parse(patchResponse.json());
    expect(updated.name).toBe('Updated project');
    expect(updated.repositoryPath).toBeNull();
  });

  it('deletes a project', async () => {
    const project = await createProject(app);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${project.id}`,
      headers: AUTH_HEADERS,
    });

    expect(deleteResponse.statusCode).toBe(204);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}`,
      headers: AUTH_HEADERS,
    });

    expect(getResponse.statusCode).toBe(404);
  });

  it('returns 404 for a missing project', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/projects/00000000-0000-4000-8000-000000000000',
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(404);
    const body = ApiErrorBodySchema.parse(response.json());
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('rejects invalid project bodies', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: AUTH_HEADERS,
      payload: {
        name: '',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = ApiErrorBodySchema.parse(response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
