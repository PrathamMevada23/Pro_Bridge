import type { ApiErrorBody, ApiErrorCode } from '@pro-bridge/shared-types';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { loadConfig, type AppConfig } from './config/env.js';
import { openDatabase, type DatabaseConnection } from './db/client.js';
import { HttpError } from './errors.js';
import { registerSecurity } from './plugins/security.js';
import { registerAgentRoutes } from './routes/agents.js';
import { registerContextRoutes } from './routes/context.js';
import { registerConversationRoutes } from './routes/conversations.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerProjectRoutes } from './routes/projects.js';
import { AgentService } from './services/agent-service.js';
import { ContextService } from './services/context-service.js';
import { ConversationService } from './services/conversation-service.js';
import { ProjectService } from './services/project-service.js';

export interface BuildAppOptions {
  config?: AppConfig;
  logger?: boolean;
  database?: DatabaseConnection;
}

function errorCodeForStatus(statusCode: number): ApiErrorCode {
  switch (statusCode) {
    case 400:
    case 413:
    case 415:
    case 422:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    default:
      return 'INTERNAL_ERROR';
  }
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    logger: options.logger ?? { level: config.logLevel },
    bodyLimit: config.bodyLimitBytes,
  });
  const ownsDatabase = options.database === undefined;
  const database = options.database ?? openDatabase({ path: config.databasePath });

  try {
    await registerSecurity(app, config);
    registerHealthRoutes(app);
    registerProjectRoutes(app, new ProjectService(database.db));
    registerConversationRoutes(app, new ConversationService(database.db));
    registerContextRoutes(app, new ContextService(database.db));
    registerAgentRoutes(app, new AgentService(database.db));
  } catch (error) {
    if (ownsDatabase) {
      database.close();
    }

    throw error;
  }

  app.addHook('onClose', () => {
    database.close();
  });

  app.setNotFoundHandler((_request, reply) => {
    const body: ApiErrorBody = {
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found.',
      },
    };

    return reply.code(404).send(body);
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof HttpError) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error }, 'Request failed');
      }

      const body: ApiErrorBody = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      };

      return reply.code(error.statusCode).send(body);
    }

    const statusCode =
      typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;

    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Request failed');
    }

    if (error.validation) {
      const body: ApiErrorBody = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          details: error.validation,
        },
      };

      return reply.code(400).send(body);
    }

    const body: ApiErrorBody = {
      error: {
        code: errorCodeForStatus(statusCode),
        message: statusCode >= 500 ? 'Internal server error.' : error.message,
      },
    };

    return reply.code(statusCode).send(body);
  });

  return app;
}
