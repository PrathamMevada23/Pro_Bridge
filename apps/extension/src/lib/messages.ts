import type { ParsedConversation } from '@pro-bridge/shared-types';
import { ParsedConversationSchema } from '@pro-bridge/validation';

export const GET_CONVERSATION = 'GET_CONVERSATION' as const;
export const CONVERSATION_UPDATED = 'CONVERSATION_UPDATED' as const;

export interface GetConversationRequest {
  type: typeof GET_CONVERSATION;
}

export interface ConversationUpdatedRequest {
  type: typeof CONVERSATION_UPDATED;
  conversation: ParsedConversation;
}

export type GetConversationResponse =
  { ok: true; conversation: ParsedConversation } | { ok: false; error: string };

export function isGetConversationRequest(value: unknown): value is GetConversationRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type?: unknown }).type === GET_CONVERSATION
  );
}

export function isConversationUpdatedRequest(value: unknown): value is ConversationUpdatedRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.type === CONVERSATION_UPDATED &&
    ParsedConversationSchema.safeParse(record.conversation).success
  );
}

export function parseGetConversationResponse(value: unknown): GetConversationResponse {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The conversation tab did not return a conversation.');
  }

  const record = value as Record<string, unknown>;

  if (record.ok === true) {
    const parsed = ParsedConversationSchema.safeParse(record.conversation);

    if (!parsed.success) {
      throw new Error('The conversation tab returned an invalid conversation.');
    }

    return { ok: true, conversation: parsed.data };
  }

  if (record.ok === false && typeof record.error === 'string' && record.error.length > 0) {
    return { ok: false, error: record.error };
  }

  throw new Error('The conversation tab returned an unexpected response.');
}
