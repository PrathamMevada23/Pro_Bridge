import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShutdownHandler, type ShutdownLogger } from '../src/lifecycle.js';

function createLogger(): ShutdownLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createShutdownHandler', () => {
  it('closes once and logs completion', async () => {
    const close = vi.fn(() => Promise.resolve());
    const logger = createLogger();
    const exit = vi.fn();
    const shutdown = createShutdownHandler({ close, logger, exit });

    await shutdown('SIGTERM');

    expect(close).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ reason: 'SIGTERM' }, 'Shutting down core API');
    expect(logger.info).toHaveBeenCalledWith({}, 'Core API stopped.');
  });

  it('ignores duplicate shutdown requests', async () => {
    const close = vi.fn(() => Promise.resolve());
    const logger = createLogger();
    const shutdown = createShutdownHandler({ close, logger, exit: vi.fn() });

    await Promise.all([shutdown('SIGINT'), shutdown('SIGTERM')]);

    expect(close).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      { reason: 'SIGTERM' },
      'Shutdown already in progress.',
    );
  });

  it('forces exit when close exceeds the timeout', async () => {
    vi.useFakeTimers();
    const logger = createLogger();
    const exit = vi.fn();
    let resolveClose: (() => void) | undefined;
    const close = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );
    const shutdown = createShutdownHandler({ close, logger, timeoutMs: 1000, exit });

    const promise = shutdown('SIGTERM');
    await vi.advanceTimersByTimeAsync(1000);

    expect(exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(
      { timeoutMs: 1000 },
      'Graceful shutdown timed out; forcing exit.',
    );

    resolveClose?.();
    await promise;
  });

  it('forces exit when close fails', async () => {
    const logger = createLogger();
    const exit = vi.fn();
    const shutdown = createShutdownHandler({
      close: () => Promise.reject(new Error('close failed')),
      logger,
      exit,
    });

    await shutdown('SIGTERM');

    expect(exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(
      { err: new Error('close failed') },
      'Failed to shut down cleanly.',
    );
  });
});
