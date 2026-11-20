import type { ZodType } from 'zod';
import { ValidationError } from '../errors.js';

export function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ValidationError(result.error);
  }

  return result.data;
}
