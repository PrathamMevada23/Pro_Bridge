export interface ShutdownLogger {
  info: (details: Record<string, unknown>, message: string) => void;
  warn: (details: Record<string, unknown>, message: string) => void;
  error: (details: Record<string, unknown>, message: string) => void;
}

export interface CreateShutdownHandlerOptions {
  close: () => Promise<void>;
  logger: ShutdownLogger;
  timeoutMs?: number;
  exit?: (code: number) => void;
}

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Creates a guarded shutdown function. Repeated signals are ignored, the close operation is
 * bounded by a timeout, and a failed or timed-out close forces a non-zero exit.
 */
export function createShutdownHandler(
  options: CreateShutdownHandlerOptions,
): (reason: string) => Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
  const exit = options.exit ?? ((code: number) => process.exit(code));
  let shuttingDown = false;

  return async (reason: string): Promise<void> => {
    if (shuttingDown) {
      options.logger.warn({ reason }, 'Shutdown already in progress.');
      return;
    }

    shuttingDown = true;
    options.logger.info({ reason }, 'Shutting down core API');

    const timer = setTimeout(() => {
      options.logger.error({ timeoutMs }, 'Graceful shutdown timed out; forcing exit.');
      exit(1);
    }, timeoutMs);
    timer.unref();

    try {
      await options.close();
      options.logger.info({}, 'Core API stopped.');
    } catch (error) {
      options.logger.error({ err: error }, 'Failed to shut down cleanly.');
      exit(1);
    } finally {
      clearTimeout(timer);
    }
  };
}
