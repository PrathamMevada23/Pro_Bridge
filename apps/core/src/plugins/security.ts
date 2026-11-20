import { timingSafeEqual } from 'node:crypto';
import cors from '@fastify/cors';
import type { ApiErrorBody } from '@pro-bridge/shared-types';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AppConfig } from '../config/env.js';
import { isAllowedOrigin } from '../security/origins.js';

const PUBLIC_PATHS = new Set(['/health']);
const BEARER_PREFIX = 'Bearer ';

function pathnameOf(url: string): string {
  return url.split('?', 1)[0] ?? url;
}

function isPublicPath(url: string): boolean {
  return PUBLIC_PATHS.has(pathnameOf(url));
}

function tokensMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorBody['error']['code'],
  message: string,
): FastifyReply {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
    },
  };

  return reply.code(statusCode).send(body);
}

/**
 * Applies the local API security boundary:
 * - only explicitly allowed browser extension origins are accepted;
 * - all routes except `/health` require the local bearer token;
 * - CORS preflight requests are answered without requiring the token.
 */
export async function registerSecurity(app: FastifyInstance, config: AppConfig): Promise<void> {
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, false);
        return;
      }

      callback(null, isAllowedOrigin(origin, config));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
    maxAge: 600,
  });

  app.addHook('onSend', async (request, reply) => {
    const origin = request.headers.origin;

    if (origin && isAllowedOrigin(origin, config)) {
      reply.header('Access-Control-Allow-Private-Network', 'true');
    }
  });

  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;

    if (origin && !isAllowedOrigin(origin, config)) {
      request.log.warn({ origin }, 'Rejected request from disallowed origin');
      return sendApiError(reply, 403, 'FORBIDDEN_ORIGIN', 'Origin is not allowed.');
    }

    if (request.method === 'OPTIONS') {
      return;
    }

    if (isPublicPath(request.url)) {
      return;
    }

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith(BEARER_PREFIX)) {
      return sendApiError(reply, 401, 'UNAUTHORIZED', 'A valid local token is required.');
    }

    const token = authorization.slice(BEARER_PREFIX.length);

    if (!tokensMatch(token, config.localToken)) {
      request.log.warn('Rejected request with an invalid local token');
      return sendApiError(reply, 401, 'UNAUTHORIZED', 'A valid local token is required.');
    }
  });
}
