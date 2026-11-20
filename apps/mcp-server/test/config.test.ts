import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const TOKEN = 't'.repeat(64);

describe('loadConfig', () => {
  it('uses the default loopback API URL', () => {
    expect(loadConfig({ PRO_BRIDGE_LOCAL_TOKEN: TOKEN })).toEqual({
      apiBaseUrl: 'http://127.0.0.1:4317',
      token: TOKEN,
    });
  });

  it('accepts loopback hosts and normalizes the origin', () => {
    expect(
      loadConfig({
        PRO_BRIDGE_LOCAL_TOKEN: TOKEN,
        PRO_BRIDGE_API_URL: 'http://localhost:5000/',
      }).apiBaseUrl,
    ).toBe('http://localhost:5000');

    expect(
      loadConfig({
        PRO_BRIDGE_LOCAL_TOKEN: TOKEN,
        PRO_BRIDGE_API_URL: 'https://[::1]:4317',
      }).apiBaseUrl,
    ).toBe('https://[::1]:4317');
  });

  it('requires a local token of at least 32 characters', () => {
    expect(() => loadConfig({})).toThrow(/PRO_BRIDGE_LOCAL_TOKEN/);
    expect(() => loadConfig({ PRO_BRIDGE_LOCAL_TOKEN: 'too-short' })).toThrow(
      /at least 32 characters/,
    );
  });

  it('rejects non-loopback hosts', () => {
    expect(() =>
      loadConfig({
        PRO_BRIDGE_LOCAL_TOKEN: TOKEN,
        PRO_BRIDGE_API_URL: 'http://192.168.1.10:4317',
      }),
    ).toThrow(/loopback host/);
  });

  it('rejects unsupported protocols, credentials, paths, queries and fragments', () => {
    expect(() =>
      loadConfig({
        PRO_BRIDGE_LOCAL_TOKEN: TOKEN,
        PRO_BRIDGE_API_URL: 'ftp://127.0.0.1:4317',
      }),
    ).toThrow(/http or https/);

    expect(() =>
      loadConfig({
        PRO_BRIDGE_LOCAL_TOKEN: TOKEN,
        PRO_BRIDGE_API_URL: 'http://user:pass@127.0.0.1:4317',
      }),
    ).toThrow(/credentials/);

    expect(() =>
      loadConfig({
        PRO_BRIDGE_LOCAL_TOKEN: TOKEN,
        PRO_BRIDGE_API_URL: 'http://127.0.0.1:4317/api',
      }),
    ).toThrow(/path, query or fragment/);

    expect(() =>
      loadConfig({
        PRO_BRIDGE_LOCAL_TOKEN: TOKEN,
        PRO_BRIDGE_API_URL: 'http://127.0.0.1:4317?token=secret',
      }),
    ).toThrow(/path, query or fragment/);
  });

  it('rejects malformed URLs', () => {
    expect(() =>
      loadConfig({
        PRO_BRIDGE_LOCAL_TOKEN: TOKEN,
        PRO_BRIDGE_API_URL: 'not a url',
      }),
    ).toThrow(/Invalid PRO_BRIDGE_API_URL/);
  });
});
