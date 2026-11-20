import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CoreApiClient } from './client.js';
import { loadConfig } from './config.js';
import { createMcpServer } from './server.js';

/**
 * stdout is reserved for the MCP stdio protocol. Every diagnostic must go to stderr,
 * otherwise clients receive malformed JSON-RPC frames.
 */
function log(message: string): void {
  process.stderr.write(`[pro-bridge-mcp] ${message}\n`);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const api = new CoreApiClient({
    baseUrl: config.apiBaseUrl,
    token: config.token,
  });
  const server = createMcpServer(api);
  let shuttingDown = false;

  const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
    if (shuttingDown) {
      log(`Shutdown already in progress; ignoring ${reason}.`);
      return;
    }

    shuttingDown = true;
    log(`Received ${reason}; shutting down.`);

    const timer = setTimeout(() => {
      log('Graceful shutdown timed out; forcing exit.');
      process.exit(1);
    }, 10_000);
    timer.unref();

    try {
      await server.close();
    } catch (error) {
      log(`Error during shutdown: ${error instanceof Error ? error.message : String(error)}`);
      exitCode = 1;
    } finally {
      clearTimeout(timer);
    }

    process.exit(exitCode);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('unhandledRejection', (reason) => {
    log(
      `Unhandled promise rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
    );
    void shutdown('unhandledRejection', 1);
  });
  process.on('uncaughtException', (error) => {
    log(`Uncaught exception: ${error.message}`);
    void shutdown('uncaughtException', 1);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`MCP server ready on stdio. Core API: ${config.apiBaseUrl}`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log(`Fatal error: ${message}`);
  process.exit(1);
});
