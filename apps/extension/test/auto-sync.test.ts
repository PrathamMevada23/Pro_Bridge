import type { ParsedMessage } from '@pro-bridge/shared-types';
import { describe, expect, it } from 'vitest';
import {
  conversationKey,
  messagesForIncrementalSync,
  SYNC_OVERLAP_MESSAGES,
} from '../src/lib/auto-sync.js';

function messages(count: number): ParsedMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    providerMessageId: `message-${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${index}`,
    sequence: index,
  }));
}

describe('conversationKey', () => {
  it('combines the provider and provider conversation ID', () => {
    expect(conversationKey('chatgpt', 'abc-123')).toBe('chatgpt:abc-123');
  });
});

describe('messagesForIncrementalSync', () => {
  it('sends every message when there is no checkpoint', () => {
    expect(messagesForIncrementalSync(messages(4), null)).toHaveLength(4);
  });

  it('sends new messages plus the edit overlap window', () => {
    const selected = messagesForIncrementalSync(messages(8), 5);

    expect(SYNC_OVERLAP_MESSAGES).toBe(2);
    expect(selected.map((message) => message.sequence)).toEqual([3, 4, 5, 6, 7]);
  });

  it('never uses a negative start sequence', () => {
    expect(messagesForIncrementalSync(messages(3), 0).map((message) => message.sequence)).toEqual([
      0, 1, 2,
    ]);
    expect(messagesForIncrementalSync(messages(3), 1).map((message) => message.sequence)).toEqual([
      0, 1, 2,
    ]);
  });

  it('handles empty message lists', () => {
    expect(messagesForIncrementalSync([], 10)).toEqual([]);
  });
});
