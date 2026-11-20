import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import {
  claudeConversationIdFromUrl,
  ConversationParseError,
  isClaudeUrl,
  parseClaudeConversation,
} from '../src/index.js';

const CONVERSATION_URL = 'https://claude.ai/chat/11111111-aaaa-4bbb-8ccc-dddddddddddd';

function createDocument(
  html: string,
  url = CONVERSATION_URL,
  title = 'Pro_Bridge planning - Claude',
): Document {
  const window = new Window({ url });
  window.document.title = title;
  window.document.body.innerHTML = html;
  return window.document as unknown as Document;
}

const CONVERSATION_HTML = `
  <div data-testid="user-message">Build a local-first bridge.</div>
  <div class="font-claude-message"><p>I can help with that.</p><pre><code>const ok = true;</code></pre></div>
  <div data-testid="user-message">What about the database?</div>
  <div class="font-claude-message"><p>Use SQLite with Drizzle ORM.</p></div>
`;

describe('parseClaudeConversation', () => {
  it('extracts interleaved user and assistant messages in document order', () => {
    const conversation = parseClaudeConversation({
      document: createDocument(CONVERSATION_HTML),
      url: CONVERSATION_URL,
    });

    expect(conversation.provider).toBe('claude');
    expect(conversation.providerConversationId).toBe('11111111-aaaa-4bbb-8ccc-dddddddddddd');
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

    expect(conversation.messages[2]).toMatchObject({
      role: 'user',
      sequence: 2,
    });
    expect(conversation.messages[3]).toMatchObject({
      role: 'assistant',
      sequence: 3,
    });
    expect(conversation.messages[3]?.content).toContain('SQLite');
  });

  it('assigns stable provider message IDs derived from role and sequence', () => {
    const conversation = parseClaudeConversation({
      document: createDocument(CONVERSATION_HTML),
      url: CONVERSATION_URL,
    });

    expect(conversation.messages[0]?.providerMessageId).toBe('claude-user-0');
    expect(conversation.messages[1]?.providerMessageId).toBe('claude-assistant-1');
  });

  it('strips the Claude suffix from the document title', () => {
    const conversation = parseClaudeConversation({
      document: createDocument(CONVERSATION_HTML, CONVERSATION_URL, 'My project · Claude'),
      url: CONVERSATION_URL,
    });

    expect(conversation.title).toBe('My project');
  });

  it('uses a title fallback when the document title is empty', () => {
    const conversation = parseClaudeConversation({
      document: createDocument(CONVERSATION_HTML, CONVERSATION_URL, ''),
      url: CONVERSATION_URL,
    });

    expect(conversation.title).toBe('Claude conversation');
  });

  it('skips empty message elements', () => {
    const html = `
      <div data-testid="user-message">Hello</div>
      <div class="font-claude-message">   </div>
      <div class="font-claude-message">A real answer.</div>
    `;
    const conversation = parseClaudeConversation({
      document: createDocument(html),
      url: CONVERSATION_URL,
    });

    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[1]?.content).toBe('A real answer.');
  });

  it('rejects non-Claude URLs', () => {
    const document = createDocument(CONVERSATION_HTML);

    expect(() => parseClaudeConversation({ document, url: 'https://chatgpt.com/c/abc' })).toThrow(
      ConversationParseError,
    );
  });

  it('rejects Claude pages without a conversation UUID in the URL', () => {
    const document = createDocument(CONVERSATION_HTML);

    expect(() => parseClaudeConversation({ document, url: 'https://claude.ai/' })).toThrow(
      'conversation UUID',
    );
  });

  it('rejects pages with no visible messages', () => {
    const document = createDocument('<main></main>');

    expect(() => parseClaudeConversation({ document, url: CONVERSATION_URL })).toThrow(
      'No Claude messages',
    );
  });
});

describe('Claude URL helpers', () => {
  it('recognizes supported hosts', () => {
    expect(isClaudeUrl('https://claude.ai/chat/11111111-aaaa-4bbb-8ccc-dddddddddddd')).toBe(true);
    expect(isClaudeUrl('https://www.claude.ai/chat/abc')).toBe(true);
    expect(isClaudeUrl('https://chatgpt.com/c/abc')).toBe(false);
    expect(isClaudeUrl('not a url')).toBe(false);
  });

  it('extracts conversation IDs from Claude URLs', () => {
    expect(claudeConversationIdFromUrl(CONVERSATION_URL)).toBe(
      '11111111-aaaa-4bbb-8ccc-dddddddddddd',
    );
    expect(claudeConversationIdFromUrl('https://claude.ai/')).toBeNull();
  });
});
