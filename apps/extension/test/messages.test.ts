import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_UPDATED,
  GET_CONVERSATION,
  isConversationUpdatedRequest,
  isGetConversationRequest,
  parseGetConversationResponse,
} from '../src/lib/messages.js';

const CONVERSATION = {
  provider: 'chatgpt',
  providerConversationId: 'conversation-1',
  url: 'https://chatgpt.com/c/conversation-1',
  title: 'Conversation',
  messages: [
    {
      providerMessageId: 'message-1',
      role: 'user',
      content: 'Hello',
      sequence: 0,
    },
  ],
};

describe('extension messages', () => {
  it('recognizes conversation requests', () => {
    expect(isGetConversationRequest({ type: GET_CONVERSATION })).toBe(true);
    expect(isGetConversationRequest({ type: 'OTHER' })).toBe(false);
    expect(isGetConversationRequest(null)).toBe(false);
  });

  it('recognizes valid conversation update messages', () => {
    expect(
      isConversationUpdatedRequest({
        type: CONVERSATION_UPDATED,
        conversation: CONVERSATION,
      }),
    ).toBe(true);
    expect(
      isConversationUpdatedRequest({
        type: CONVERSATION_UPDATED,
        conversation: { provider: 'chatgpt' },
      }),
    ).toBe(false);
  });

  it('parses a successful conversation response', () => {
    expect(
      parseGetConversationResponse({
        ok: true,
        conversation: CONVERSATION,
      }),
    ).toEqual({ ok: true, conversation: CONVERSATION });
  });

  it('parses an error response', () => {
    expect(parseGetConversationResponse({ ok: false, error: 'Open a conversation.' })).toEqual({
      ok: false,
      error: 'Open a conversation.',
    });
  });

  it('rejects malformed responses', () => {
    expect(() => parseGetConversationResponse(null)).toThrow('did not return a conversation');
    expect(() => parseGetConversationResponse({ ok: true, conversation: {} })).toThrow(
      'invalid conversation',
    );
    expect(() => parseGetConversationResponse({ ok: false, error: '' })).toThrow(
      'unexpected response',
    );
  });
});
