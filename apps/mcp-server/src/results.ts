import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { CoreApiError } from './client.js';

/**
 * Serializes a tool result as pretty-printed JSON text. MCP clients receive one text block,
 * which keeps the output readable in chat-oriented coding agents.
 */
export function jsonResult(value: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function errorResult(message: string): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
  };
}

/**
 * Converts failures into a short, user-facing message without leaking request headers or the
 * local token. Tool errors are returned as `isError` results so the calling agent can react.
 */
export function toErrorResult(error: unknown): CallToolResult {
  if (error instanceof CoreApiError) {
    if (error.status === 404) {
      return errorResult(`Not found: ${error.message}`);
    }

    if (error.status === 401 || error.status === 403) {
      return errorResult(
        'The Pro_Bridge core rejected the request. Check PRO_BRIDGE_LOCAL_TOKEN and that the core API is running.',
      );
    }

    return errorResult(error.message);
  }

  if (error instanceof Error) {
    return errorResult(error.message);
  }

  return errorResult(
    'An unexpected error occurred while communicating with the Pro_Bridge core API.',
  );
}
