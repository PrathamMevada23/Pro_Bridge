import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from '../src/security/origins.js';

const devConfig = { nodeEnv: 'development' as const, allowedOrigins: [] as string[] };
const testConfig = { nodeEnv: 'test' as const, allowedOrigins: [] as string[] };
const prodConfig = {
  nodeEnv: 'production' as const,
  allowedOrigins: ['chrome-extension://installedextensionid'],
};

describe('isAllowedOrigin', () => {
  it('allows an origin that is in the explicit allowlist', () => {
    expect(isAllowedOrigin('chrome-extension://installedextensionid', prodConfig)).toBe(true);
  });

  it('rejects an origin not in the allowlist in production', () => {
    expect(isAllowedOrigin('chrome-extension://otherid', prodConfig)).toBe(false);
  });

  it('allows any well-formed chrome-extension origin outside production', () => {
    expect(isAllowedOrigin('chrome-extension://anyunpackedextension', devConfig)).toBe(true);
  });

  it('allows any well-formed moz-extension origin outside production', () => {
    expect(isAllowedOrigin('moz-extension://firefoxdevextension', testConfig)).toBe(true);
  });

  it('rejects a non-extension origin outside production', () => {
    expect(isAllowedOrigin('https://example.com', devConfig)).toBe(false);
  });

  it('rejects a completely malformed (unparseable) origin string outside production', () => {
    // A string that cannot be parsed by `new URL()` hits the catch branch.
    expect(isAllowedOrigin('not a url at all ://???', devConfig)).toBe(false);
  });

  it('rejects an origin with a path outside production', () => {
    expect(isAllowedOrigin('chrome-extension://abc/some/path', devConfig)).toBe(false);
  });

  it('rejects an origin with a query string outside production', () => {
    expect(isAllowedOrigin('chrome-extension://abc?foo=bar', devConfig)).toBe(false);
  });
});
