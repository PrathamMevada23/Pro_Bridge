import { describe, expect, it } from 'vitest';
import { detectConversationProvider, isSupportedConversationUrl } from '../src/index.js';

describe('provider detection helpers', () => {
  it('identifies supported conversation URLs', () => {
    expect(isSupportedConversationUrl('https://chatgpt.com/c/123')).toBe(true);
    expect(isSupportedConversationUrl('https://chat.openai.com/c/123')).toBe(true);
    expect(
      isSupportedConversationUrl('https://claude.ai/chat/11111111-2222-3333-4444-555555555555'),
    ).toBe(true);
    expect(isSupportedConversationUrl('https://gemini.google.com/app/abc123')).toBe(true);
    expect(isSupportedConversationUrl('https://example.com/c/123')).toBe(false);
    expect(isSupportedConversationUrl('invalid url')).toBe(false);
  });

  it('detects the specific conversation provider', () => {
    expect(detectConversationProvider('https://chatgpt.com/c/123')).toBe('chatgpt');
    expect(detectConversationProvider('https://chat.openai.com/c/123')).toBe('chatgpt');
    expect(
      detectConversationProvider('https://claude.ai/chat/11111111-2222-3333-4444-555555555555'),
    ).toBe('claude');
    expect(detectConversationProvider('https://gemini.google.com/app/abc123')).toBe('gemini');
    expect(detectConversationProvider('https://example.com/c/123')).toBeNull();
  });
});
