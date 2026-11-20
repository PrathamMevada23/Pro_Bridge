import { describe, expect, it } from 'vitest';
import { ApiErrorBodySchema, HealthResponseSchema } from '../src/index.js';

describe('HealthResponseSchema', () => {
  it('accepts a valid health response', () => {
    const result = HealthResponseSchema.safeParse({
      status: 'ok',
      service: 'pro-bridge-core',
      version: '0.1.0',
      uptimeSeconds: 1.25,
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid timestamp', () => {
    const result = HealthResponseSchema.safeParse({
      status: 'ok',
      service: 'pro-bridge-core',
      version: '0.1.0',
      uptimeSeconds: 1.25,
      timestamp: 'not-a-date',
    });

    expect(result.success).toBe(false);
  });
});

describe('ApiErrorBodySchema', () => {
  it('accepts a known error code', () => {
    const result = ApiErrorBodySchema.safeParse({
      error: {
        code: 'UNAUTHORIZED',
        message: 'A valid local token is required.',
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unknown error code', () => {
    const result = ApiErrorBodySchema.safeParse({
      error: {
        code: 'SOMETHING_ELSE',
        message: 'Nope.',
      },
    });

    expect(result.success).toBe(false);
  });
});
