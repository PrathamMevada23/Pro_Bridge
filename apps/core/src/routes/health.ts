import type { HealthResponse } from '@pro-bridge/shared-types';
import type { FastifyInstance } from 'fastify';
import { SERVICE_NAME } from '../constants.js';
import { SERVICE_VERSION } from '../version.js';

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/health', () => {
    const body: HealthResponse = {
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      uptimeSeconds: Math.round(process.uptime() * 1000) / 1000,
      timestamp: new Date().toISOString(),
    };

    return body;
  });
}
