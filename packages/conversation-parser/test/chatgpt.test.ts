import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import {
  chatGptConversationIdFromUrl,
  ConversationParseError,
  isChatGptUrl,
  parseChatGptConversation,
} from '../src/index.js';

const CONVERSATION_URL = 'https://chatgpt.com/c/abc-123';

function createDocument(
  html: string,
  url = CONVERSATION_URL,
  title = 'Example conversation',
): Document {
  const window = new Window({ url });
  window.document.title = title;
  window.document.body.innerHTML = html;

  return window.document as unknown as Document;
}

const CONVERSATION_HTML = `
  <main>
    <article data-testid="conversation-turn-0">
      <div data-message-author-role="user" data-message-id="user-message-1">
        <div class="whitespace-pre-wrap">Build a local-first bridge.</div>
      </div>
    </article>
    <article data-testid="conversation-turn-1">
      <div data-message-author-role="assistant" data-message-id="assistant-message-1">
        <div class="markdown"><p>I can help with that.</p><pre><code>const ok = true;</code></pre></div>
      </div>
    </article>
  </main>
`;

describe('parseChatGptConversation', () => {
  it('extracts messages in order with stable provider IDs', () => {
    const conversation = parseChatGptConversation({
      document: createDocument(
        CONVERSATION_HTML,
        `${CONVERSATION_URL}?model=gpt-5`,
        'Bridge plan - ChatGPT',
      ),
      url: `${CONVERSATION_URL}?model=gpt-5`,
    });

    expect(conversation.provider).toBe('chatgpt');
    expect(conversation.providerConversationId).toBe('abc-123');
    expect(conversation.url).toBe(CONVERSATION_URL);
    expect(conversation.title).toBe('Bridge plan');
    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[0]).toMatchObject({
      providerMessageId: 'user-message-1',
      role: 'user',
      sequence: 0,
    });
    expect(conversation.messages[0]?.content).toBe('Build a local-first bridge.');
    expect(conversation.messages[1]).toMatchObject({
      providerMessageId: 'assistant-message-1',
      role: 'assistant',
      sequence: 1,
    });
    expect(conversation.messages[1]?.content).toContain('I can help with that.');
    expect(conversation.messages[1]?.content).toContain('const ok = true;');
  });

  it('extracts messages from modern (2025/2026) ChatGPT DOM', () => {
    const modernHtml = `
      <main>
        <div class="flex flex-col gap-3 browser:gap-1">
          <div class="block-BQZwFn">
            <div class="bg-user-message text-user-message">
              <div class="text-size-chat whitespace-pre-wrap">Build a local-first bridge.</div>
            </div>
          </div>
          <div class="block-BQZwFn">
            <div class="DilRenderer-tB76Jj DilResponseRoot-HfQrEh">
              <div class="MarkdownRoot-rZKhxa">
                <p>I can help with that.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;

    const conversation = parseChatGptConversation({
      document: createDocument(modernHtml, CONVERSATION_URL, 'Bridge plan - ChatGPT'),
      url: CONVERSATION_URL,
    });

    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[0]?.role).toBe('user');
    expect(conversation.messages[0]?.content).toBe('Build a local-first bridge.');
    expect(conversation.messages[1]?.role).toBe('assistant');
    expect(conversation.messages[1]?.content).toBe('I can help with that.');
  });

  it('falls back to the conversation turn test ID', () => {
    const document = createDocument(`
      <article data-testid="conversation-turn-4">
        <div data-message-author-role="user">
          <div class="whitespace-pre-wrap">Fallback message</div>
        </div>
      </article>
    `);

    const conversation = parseChatGptConversation({ document, url: CONVERSATION_URL });

    expect(conversation.messages[0]?.providerMessageId).toBe('chatgpt-conversation-turn-4');
  });

  it('supports role elements without turn wrappers', () => {
    const document = createDocument(`
      <div data-message-author-role="user" data-message-id="plain-user">
        <div class="whitespace-pre-wrap">Plain message</div>
      </div>
    `);

    const conversation = parseChatGptConversation({ document, url: CONVERSATION_URL });

    expect(conversation.messages).toHaveLength(1);
    expect(conversation.messages[0]?.providerMessageId).toBe('plain-user');
  });

  it('skips unknown roles and empty messages while keeping sequence contiguous', () => {
    const document = createDocument(`
      <article data-testid="conversation-turn-0">
        <div data-message-author-role="tool" data-message-id="tool-1">Tool output</div>
      </article>
      <article data-testid="conversation-turn-1">
        <div data-message-author-role="user" data-message-id="user-1">
          <div class="whitespace-pre-wrap">First visible message</div>
        </div>
      </article>
      <article data-testid="conversation-turn-2">
        <div data-message-author-role="assistant" data-message-id="assistant-1">
          <div class="markdown">   </div>
        </div>
      </article>
      <article data-testid="conversation-turn-3">
        <div data-message-author-role="assistant" data-message-id="assistant-2">
          <div class="markdown">Second visible message</div>
        </div>
      </article>
    `);

    const conversation = parseChatGptConversation({ document, url: CONVERSATION_URL });

    expect(conversation.messages.map((message) => message.sequence)).toEqual([0, 1]);
    expect(conversation.messages.map((message) => message.content)).toEqual([
      'First visible message',
      'Second visible message',
    ]);
  });

  it('supports custom GPT conversation URLs', () => {
    const url = 'https://chatgpt.com/g/g-custom-gpt/c/custom-conversation';
    const document = createDocument(
      `<article data-testid="conversation-turn-0"><div data-message-author-role="user" data-message-id="u1">Hello</div></article>`,
      url,
    );

    const conversation = parseChatGptConversation({ document, url });

    expect(conversation.providerConversationId).toBe('custom-conversation');
  });

  it('uses a title fallback when the document title is empty', () => {
    const document = createDocument(CONVERSATION_HTML, CONVERSATION_URL, '');

    const conversation = parseChatGptConversation({ document, url: CONVERSATION_URL });

    expect(conversation.title).toBe('ChatGPT conversation');
  });

  it('extracts messages when data-message-author-role is absent (modern layout)', () => {
    const modernHtml = `
      <main>
        <article>
          <h5 class="sr-only">You said:</h5>
          <div class="whitespace-pre-wrap">How do I build a bridge?</div>
        </article>
        <article>
          <h6 class="sr-only">ChatGPT said:</h6>
          <div class="markdown prose"><p>Start with requirements and design.</p></div>
          <button aria-label="Copy">Copy</button>
        </article>
      </main>
    `;

    const conversation = parseChatGptConversation({
      document: createDocument(modernHtml, CONVERSATION_URL),
      url: CONVERSATION_URL,
    });

    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[0]).toMatchObject({
      role: 'user',
      content: 'How do I build a bridge?',
      sequence: 0,
    });
    expect(conversation.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Start with requirements and design.',
      sequence: 1,
    });
  });

  it('rejects non-ChatGPT URLs', () => {
    const document = createDocument(CONVERSATION_HTML);

    expect(() =>
      parseChatGptConversation({ document, url: 'https://example.com/c/abc-123' }),
    ).toThrow(ConversationParseError);
  });

  it('rejects ChatGPT pages that are not saved conversations', () => {
    const document = createDocument(CONVERSATION_HTML);

    expect(() => parseChatGptConversation({ document, url: 'https://chatgpt.com/' })).toThrow(
      'Open a saved ChatGPT conversation',
    );
  });

  it('rejects pages with no visible messages', () => {
    const document = createDocument('<main></main>');

    expect(() => parseChatGptConversation({ document, url: CONVERSATION_URL })).toThrow(
      'No ChatGPT messages were found',
    );
  });
});

describe('ChatGPT URL helpers', () => {
  it('recognizes supported hosts', () => {
    expect(isChatGptUrl('https://chatgpt.com/c/abc')).toBe(true);
    expect(isChatGptUrl('https://chat.openai.com/c/abc')).toBe(true);
    expect(isChatGptUrl('https://example.com/c/abc')).toBe(false);
    expect(isChatGptUrl('not a url')).toBe(false);
  });

  it('extracts conversation IDs', () => {
    expect(chatGptConversationIdFromUrl('https://chatgpt.com/c/abc-123')).toBe('abc-123');
    expect(chatGptConversationIdFromUrl('https://chatgpt.com/g/g-1/c/abc-123/')).toBe('abc-123');
    expect(chatGptConversationIdFromUrl('https://chatgpt.com/')).toBeNull();
  });
});
