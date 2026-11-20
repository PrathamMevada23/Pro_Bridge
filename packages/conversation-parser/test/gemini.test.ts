import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import {
  ConversationParseError,
  geminiConversationIdFromUrl,
  isGeminiUrl,
  parseGeminiConversation,
} from '../src/index.js';

const CONVERSATION_URL = 'https://gemini.google.com/app/abc123def456';

function createDocument(
  html: string,
  url = CONVERSATION_URL,
  title = 'Pro_Bridge planning - Gemini',
): Document {
  const window = new Window({ url });
  window.document.title = title;
  window.document.body.innerHTML = html;
  return window.document as unknown as Document;
}

/**
 * Gemini uses Angular Web Components: `user-query` and `model-response` are actual
 * custom element tag names. happy-dom renders unknown tags as HTMLElement, which is
 * sufficient for testing our parser logic.
 */
const CONVERSATION_HTML = `
  <user-query>
    <div class="query-text">Build a local-first bridge.</div>
  </user-query>
  <model-response>
    <message-content><p>I can help with that.</p></message-content>
  </model-response>
  <user-query>
    <div class="query-text">What about the database?</div>
  </user-query>
  <model-response>
    <message-content><p>Use SQLite with Drizzle ORM.</p></message-content>
  </model-response>
`;

describe('parseGeminiConversation', () => {
  it('extracts interleaved user and assistant messages in document order', () => {
    const conversation = parseGeminiConversation({
      document: createDocument(CONVERSATION_HTML),
      url: CONVERSATION_URL,
    });

    expect(conversation.provider).toBe('gemini');
    expect(conversation.providerConversationId).toBe('abc123def456');
    expect(conversation.url).toBe(CONVERSATION_URL);
    expect(conversation.title).toBe('Pro_Bridge planning');
    expect(conversation.messages).toHaveLength(4);

    expect(conversation.messages[0]).toMatchObject({
      role: 'user',
      sequence: 0,
    });
    expect(conversation.messages[0]?.content).toBe('Build a local-first bridge.');

    expect(conversation.messages[1]).toMatchObject({
      role: 'assistant',
      sequence: 1,
    });
    expect(conversation.messages[1]?.content).toContain('I can help with that.');

    expect(conversation.messages[2]).toMatchObject({ role: 'user', sequence: 2 });
    expect(conversation.messages[3]).toMatchObject({ role: 'assistant', sequence: 3 });
    expect(conversation.messages[3]?.content).toContain('SQLite');
  });

  it('assigns stable provider message IDs derived from role and sequence', () => {
    const conversation = parseGeminiConversation({
      document: createDocument(CONVERSATION_HTML),
      url: CONVERSATION_URL,
    });

    expect(conversation.messages[0]?.providerMessageId).toBe('gemini-user-0');
    expect(conversation.messages[1]?.providerMessageId).toBe('gemini-assistant-1');
  });

  it('strips the Gemini suffix from the document title', () => {
    const conversation = parseGeminiConversation({
      document: createDocument(CONVERSATION_HTML, CONVERSATION_URL, 'My project | Gemini'),
      url: CONVERSATION_URL,
    });

    expect(conversation.title).toBe('My project');
  });

  it('uses a title fallback when the document title is empty', () => {
    const conversation = parseGeminiConversation({
      document: createDocument(CONVERSATION_HTML, CONVERSATION_URL, ''),
      url: CONVERSATION_URL,
    });

    expect(conversation.title).toBe('Gemini conversation');
  });

  it('falls back to the full element text when no content child selector matches', () => {
    const html = `
      <user-query>Direct text without a wrapper</user-query>
      <model-response>Direct model reply</model-response>
    `;
    const conversation = parseGeminiConversation({
      document: createDocument(html),
      url: CONVERSATION_URL,
    });

    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[0]?.content).toBe('Direct text without a wrapper');
    expect(conversation.messages[1]?.content).toBe('Direct model reply');
  });

  it('skips empty message elements', () => {
    const html = `
      <user-query><div class="query-text">Hello</div></user-query>
      <model-response>   </model-response>
      <model-response><message-content>A real answer.</message-content></model-response>
    `;
    const conversation = parseGeminiConversation({
      document: createDocument(html),
      url: CONVERSATION_URL,
    });

    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[1]?.content).toBe('A real answer.');
  });

  it('rejects non-Gemini URLs', () => {
    const document = createDocument(CONVERSATION_HTML);

    expect(() => parseGeminiConversation({ document, url: 'https://chatgpt.com/c/abc' })).toThrow(
      ConversationParseError,
    );
  });

  it('rejects Gemini pages without a conversation ID in the URL', () => {
    const document = createDocument(CONVERSATION_HTML);

    expect(() => parseGeminiConversation({ document, url: 'https://gemini.google.com/' })).toThrow(
      '/app/<id>',
    );
  });

  it('rejects pages with no visible messages', () => {
    const document = createDocument('<main></main>');

    expect(() => parseGeminiConversation({ document, url: CONVERSATION_URL })).toThrow(
      'No Gemini messages',
    );
  });
});

describe('Gemini URL helpers', () => {
  it('recognizes supported hosts', () => {
    expect(isGeminiUrl('https://gemini.google.com/app/abc123')).toBe(true);
    expect(isGeminiUrl('https://chatgpt.com/c/abc')).toBe(false);
    expect(isGeminiUrl('not a url')).toBe(false);
  });

  it('extracts conversation IDs from Gemini URLs', () => {
    expect(geminiConversationIdFromUrl(CONVERSATION_URL)).toBe('abc123def456');
    expect(geminiConversationIdFromUrl('https://gemini.google.com/')).toBeNull();
    expect(geminiConversationIdFromUrl('https://gemini.google.com/app/xyz_789/')).toBe('xyz_789');
  });
});
