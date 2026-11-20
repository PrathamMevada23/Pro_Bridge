import { ApiErrorBodySchema, HealthResponseSchema } from '@pro-bridge/validation';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig, type AppConfig } from '../src/config/env.js';

const localToken = 'b'.repeat(64);
const extensionOrigin = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

let app: FastifyInstance;
let config: AppConfig;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PRO_BRIDGE_LOCAL_TOKEN: localToken,
    PRO_BRIDGE_DATABASE_PATH: ':memory:',
  });
  app = await buildApp({ config, logger: false });
});

afterEach(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('returns a valid health response without authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = HealthResponseSchema.parse(response.json());
    expect(body.service).toBe('pro-bridge-core');
    expect(body.status).toBe('ok');
  });

  it('rejects disallowed browser origins', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'https://example.com',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = ApiErrorBodySchema.parse(response.json());
    expect(body.error.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('allows extension origins outside production', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: extensionOrigin,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(extensionOrigin);
  });
});

describe('local token authentication', () => {
  it('rejects protected routes without a token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/unknown',
    });

    expect(response.statusCode).toBe(401);
    const body = ApiErrorBodySchema.parse(response.json());
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects an invalid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/unknown',
      headers: {
        authorization: `Bearer ${'c'.repeat(64)}`,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('allows a valid token through to the router', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/unknown',
      headers: {
        authorization: `Bearer ${localToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
    const body = ApiErrorBodySchema.parse(response.json());
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('CORS preflight', () => {
  it('answers preflight requests from allowed extension origins without a token', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/unknown',
      headers: {
        origin: extensionOrigin,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(extensionOrigin);
  });
});

describe('request error handling', () => {
  const authHeaders = {
    authorization: `Bearer ${localToken}`,
  };

  it('returns a validation error for malformed JSON', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: {
        ...authHeaders,
        'content-type': 'application/json',
      },
      payload: '{"name":',
    });

    expect(response.statusCode).toBe(400);
    const body = ApiErrorBodySchema.parse(response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a validation error for unsupported content types', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: {
        ...authHeaders,
        'content-type': 'application/x-www-form-urlencoded',
      },
      payload: 'name=test',
    });

    expect(response.statusCode).toBe(415);
    const body = ApiErrorBodySchema.parse(response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects request bodies above the configured limit', async () => {
    const smallConfig = loadConfig({
      NODE_ENV: 'test',
      PRO_BRIDGE_LOCAL_TOKEN: localToken,
      PRO_BRIDGE_DATABASE_PATH: ':memory:',
      PRO_BRIDGE_BODY_LIMIT_BYTES: '1024',
    });
    const smallApp = await buildApp({ config: smallConfig, logger: false });

    try {
      const response = await smallApp.inject({
        method: 'POST',
        url: '/api/projects',
        headers: authHeaders,
        payload: {
          name: 'Large project',
          description: 'x'.repeat(2000),
        },
      });

      expect(response.statusCode).toBe(413);
      const body = ApiErrorBodySchema.parse(response.json());
      expect(body.error.code).toBe('VALIDATION_ERROR');
    } finally {
      await smallApp.close();
    }
  });
});
