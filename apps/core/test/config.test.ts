import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';

const validToken = 'a'.repeat(64);

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PRO_BRIDGE_LOCAL_TOKEN: validToken,
};

describe('loadConfig', () => {
  it('defaults to a loopback host and the default port', () => {
    const config = loadConfig(baseEnv);

    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(4317);
    expect(config.databasePath).toBe('./data/pro-bridge.db');
    expect(config.bodyLimitBytes).toBe(16 * 1024 * 1024);
    expect(config.localToken).toBe(validToken);
    expect(config.tokenWasGenerated).toBe(false);
  });

  it('accepts a custom database path', () => {
    const config = loadConfig({
      ...baseEnv,
      PRO_BRIDGE_DATABASE_PATH: ':memory:',
    });

    expect(config.databasePath).toBe(':memory:');
  });

  it('rejects a host that is not loopback', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        PRO_BRIDGE_HOST: '0.0.0.0',
      }),
    ).toThrow(/PRO_BRIDGE_HOST/);
  });

  it('generates an ephemeral token outside production when none is configured', () => {
    const config = loadConfig({ NODE_ENV: 'development' });

    expect(config.tokenWasGenerated).toBe(true);
    expect(config.localToken).toHaveLength(64);
  });

  it('requires a token in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        PRO_BRIDGE_ALLOWED_ORIGINS: 'chrome-extension://abcdefghijklmnop',
      }),
    ).toThrow(/PRO_BRIDGE_LOCAL_TOKEN/);
  });

  it('requires an explicit origin allowlist in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        PRO_BRIDGE_LOCAL_TOKEN: validToken,
      }),
    ).toThrow(/PRO_BRIDGE_ALLOWED_ORIGINS/);
  });

  it('normalizes and deduplicates extension origins', () => {
    const config = loadConfig({
      ...baseEnv,
      PRO_BRIDGE_ALLOWED_ORIGINS:
        'chrome-extension://abcdefghijklmnop/, moz-extension://example, chrome-extension://abcdefghijklmnop',
    });

    expect(config.allowedOrigins).toEqual([
      'chrome-extension://abcdefghijklmnop',
      'moz-extension://example',
    ]);
  });

  it('rejects non-extension origins', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        PRO_BRIDGE_ALLOWED_ORIGINS: 'https://example.com',
      }),
    ).toThrow(/Only chrome-extension/);
  });

  it('rejects invalid ports', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        PRO_BRIDGE_PORT: '70000',
      }),
    ).toThrow(/PRO_BRIDGE_PORT/);
  });

  it('accepts a custom request body limit', () => {
    const config = loadConfig({
      ...baseEnv,
      PRO_BRIDGE_BODY_LIMIT_BYTES: '1048576',
    });

    expect(config.bodyLimitBytes).toBe(1024 * 1024);
  });

  it('rejects an invalid request body limit', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        PRO_BRIDGE_BODY_LIMIT_BYTES: '10',
      }),
    ).toThrow(/PRO_BRIDGE_BODY_LIMIT_BYTES/);
  });
});
