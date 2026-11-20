import { buildApp } from './app.js';
import { loadConfig, loadEnvironment } from './config/env.js';
import { createShutdownHandler } from './lifecycle.js';

async function main(): Promise<void> {
  loadEnvironment();

  const config = loadConfig();
  const app = await buildApp({ config });

  if (config.tokenWasGenerated) {
    app.log.warn(
      { token: config.localToken },
      'Generated an ephemeral local token. Set PRO_BRIDGE_LOCAL_TOKEN to keep it stable across restarts.',
    );
  }

  const shutdown = createShutdownHandler({
    close: () => app.close(),
    logger: app.log,
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('unhandledRejection', (reason) => {
    app.log.error({ err: reason }, 'Unhandled promise rejection.');
    process.exitCode = 1;
    void shutdown('unhandledRejection');
  });
  process.on('uncaughtException', (error) => {
    app.log.error({ err: error }, 'Uncaught exception.');
    process.exitCode = 1;
    void shutdown('uncaughtException');
  });

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error({ err: error }, 'Failed to start core API');
    await app.close();
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error('Fatal startup error:', error);
  process.exitCode = 1;
});
