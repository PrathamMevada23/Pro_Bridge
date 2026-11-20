import type { ApiErrorCode } from '@pro-bridge/shared-types';
import type { ZodError } from 'zod';

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;

    if (details !== undefined) {
      this.details = details;
    }
  }
}

export class ValidationError extends HttpError {
  constructor(error: ZodError) {
    super(400, 'VALIDATION_ERROR', 'Request validation failed.', error.issues);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
    this.name = 'BadRequestError';
  }
}
