import { describe, expect, it } from 'vitest';
import { CoreApiError } from '../src/client.js';
import { errorResult, jsonResult, toErrorResult } from '../src/results.js';

describe('jsonResult', () => {
  it('serializes a plain object as pretty-printed JSON text', () => {
    const result = jsonResult({ id: '123', name: 'Test' });

    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify({ id: '123', name: 'Test' }, null, 2),
    });
    expect(result.isError).toBeUndefined();
  });

  it('serializes an array', () => {
    const result = jsonResult([1, 2, 3]);

    expect(result.content[0]).toEqual({
      type: 'text',
      text: '[\n  1,\n  2,\n  3\n]',
    });
  });

  it('serializes null', () => {
    const result = jsonResult(null);

    expect(result.content[0]).toEqual({ type: 'text', text: 'null' });
  });
});

describe('errorResult', () => {
  it('returns an isError result with the given message', () => {
    const result = errorResult('Something went wrong');

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({ type: 'text', text: 'Something went wrong' });
  });
});

describe('toErrorResult', () => {
  it('converts a 404 CoreApiError to a not-found message', () => {
    const result = toErrorResult(new CoreApiError('project not found', 404));

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('Not found');
    expect((result.content[0] as { text: string }).text).toContain('project not found');
  });

  it('converts a 401 CoreApiError to an auth message', () => {
    const result = toErrorResult(new CoreApiError('unauthorized', 401));

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('PRO_BRIDGE_LOCAL_TOKEN');
  });

  it('converts a 403 CoreApiError to an auth message', () => {
    const result = toErrorResult(new CoreApiError('forbidden', 403));

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('PRO_BRIDGE_LOCAL_TOKEN');
  });

  it('converts other CoreApiError statuses using the error message', () => {
    const result = toErrorResult(new CoreApiError('internal server error', 500));

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toBe('internal server error');
  });

  it('converts a plain Error using its message', () => {
    const result = toErrorResult(new Error('network timeout'));

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toBe('network timeout');
  });

  it('converts a non-Error value to a generic message', () => {
    const result = toErrorResult('some string error');

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('unexpected error');
  });
});
