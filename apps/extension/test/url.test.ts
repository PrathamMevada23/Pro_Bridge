import { describe, expect, it } from 'vitest';
import { normalizeApiBaseUrl } from '../src/lib/url.js';

describe('normalizeApiBaseUrl', () => {
  it('normalizes a local API URL', () => {
    expect(normalizeApiBaseUrl(' http://127.0.0.1:4317/ ')).toBe('http://127.0.0.1:4317');
    expect(normalizeApiBaseUrl('http://localhost:4317/api/')).toBe('http://localhost:4317/api');
  });

  it('rejects empty or invalid URLs', () => {
    expect(() => normalizeApiBaseUrl('')).toThrow('Enter the local API URL');
    expect(() => normalizeApiBaseUrl('not a url')).toThrow('Enter a valid local API URL');
    expect(() => normalizeApiBaseUrl('ftp://127.0.0.1:4317')).toThrow('must use http or https');
    expect(() => normalizeApiBaseUrl('http://user:pass@127.0.0.1:4317')).toThrow(
      'must not contain credentials',
    );
  });
});
