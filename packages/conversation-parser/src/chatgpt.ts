import type { MessageRole, ParsedConversation, ParsedMessage } from '@pro-bridge/shared-types';

const CHATGPT_HOSTS = new Set(['chatgpt.com', 'www.chatgpt.com', 'chat.openai.com']);
const TURN_SELECTORS = [
  '[data-message-author-role]',
  '[data-message-role]',
  'article[data-testid^="conversation-turn-"]',
  '[data-testid^="conversation-turn-"]',
  '[class*="conversation-turn"]',
  'article',
  '[data-testid="text-message"]',
  // Modern ChatGPT (2025/2026 UI)
  '[class*="bg-user-message"], [class*="DilResponseRoot"], [class*="MarkdownRoot"]',
];

const CONTENT_SELECTORS = [
  '[data-testid="text-message"]',
  '.markdown',
  '.prose',
  '[class*="MarkdownRoot"]',
  '.whitespace-pre-wrap',
  '.message-content',
  '[class*="whitespace-pre-wrap"]',
  '[class*="markdown"]',
  '[class*="prose"]',
  '[data-message-id]',
];

const TITLE_SUFFIX = /\s*[|·–—-]\s*(ChatGPT|OpenAI)\s*$/i;

export class ConversationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversationParseError';
  }
}

export interface ChatGptParseInput {
  document: Document;
  url: string;
}

export function isChatGptUrl(url: string): boolean {
  try {
    return CHATGPT_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function chatGptConversationIdFromUrl(url: string): string | null {
  try {
    const match = new URL(url).pathname.match(/\/c\/([^/]+)\/?$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function canonicalUrl(url: URL): string {
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

function titleFromDocument(document: Document): string {
  return document.title.replace(TITLE_SUFFIX, '').trim();
}

function textFromElement(element: Element): string {
  const htmlElement = element as HTMLElement;
  const innerText = typeof htmlElement.innerText === 'string' ? htmlElement.innerText : '';
  const text = innerText.length > 0 ? innerText : (element.textContent ?? '');

  return text.replace(/\r\n?/g, '\n').trim();
}

function detectRole(
  turn: Element,
  index: number,
  previousRole: MessageRole | null,
): MessageRole | null {
  // 1. Check explicit attributes on turn or children
  const roleAttrElement = turn.matches(
    '[data-message-author-role], [data-message-role], [data-author]',
  )
    ? turn
    : turn.querySelector('[data-message-author-role], [data-message-role], [data-author]');

  if (roleAttrElement) {
    const rawRole = (
      roleAttrElement.getAttribute('data-message-author-role') ??
      roleAttrElement.getAttribute('data-message-role') ??
      roleAttrElement.getAttribute('data-author') ??
      ''
    )
      .toLowerCase()
      .trim();

    if (rawRole === 'user' || rawRole === 'human') return 'user';
    if (rawRole === 'assistant' || rawRole === 'model' || rawRole === 'bot') return 'assistant';
    if (rawRole === 'system') return 'system';
    return null;
  }

  // 2. Check testid attributes
  const testIdAttr = (turn.getAttribute('data-testid') ?? '').toLowerCase();
  if (testIdAttr.includes('user')) return 'user';
  if (testIdAttr.includes('assistant')) return 'assistant';

  const childTestId = turn.querySelector('[data-testid*="user"], [data-testid*="assistant"]');
  if (childTestId) {
    const childId = (childTestId.getAttribute('data-testid') ?? '').toLowerCase();
    if (childId.includes('user')) return 'user';
    if (childId.includes('assistant')) return 'assistant';
  }

  // 3. Check screen-reader heading indicators
  const srHeading = turn.querySelector('h5, h6, .sr-only, [aria-label*="said" i]');
  if (srHeading) {
    const headingText = (srHeading.textContent ?? '').toLowerCase();
    if (headingText.includes('you said')) return 'user';
    if (headingText.includes('chatgpt said') || headingText.includes('assistant said')) {
      return 'assistant';
    }
  }

  // 4. Check modern ChatGPT classes (2025/2026 UI)
  if (
    turn.matches('[class*="bg-user-message"], [class*="text-user-message"]') ||
    turn.querySelector('[class*="bg-user-message"], [class*="text-user-message"]')
  ) {
    return 'user';
  }

  if (
    turn.matches('[class*="DilResponseRoot"], [class*="DilRenderer"], [class*="MarkdownRoot"]') ||
    turn.querySelector(
      '[class*="DilResponseRoot"], [class*="DilRenderer"], [class*="MarkdownRoot"]',
    )
  ) {
    return 'assistant';
  }

  // 5. Check assistant-specific markers: markdown / prose or copy button
  if (
    turn.querySelector('.markdown, .prose, button[aria-label*="Copy" i], [data-testid*="copy" i]')
  ) {
    return 'assistant';
  }

  // 6. Alternating conversational fallback
  if (previousRole === 'user') return 'assistant';
  if (previousRole === 'assistant') return 'user';
  return index % 2 === 0 ? 'user' : 'assistant';
}

function extractTurnContent(turn: Element): string {
  for (const selector of CONTENT_SELECTORS) {
    const match = turn.matches(selector) ? turn : turn.querySelector(selector);

    if (match) {
      const text = textFromElement(match);
      if (text.length > 0) {
        return text;
      }
    }
  }

  // Fallback: clean cloned element of interactive controls and metadata
  try {
    const clone = turn.cloneNode(true) as Element;
    const unwanted = clone.querySelectorAll(
      'button, svg, nav, footer, .sr-only, [aria-hidden="true"], [data-testid*="action"]',
    );
    unwanted.forEach((el) => el.remove());

    const cleanedText = textFromElement(clone);
    if (cleanedText.length > 0) {
      return cleanedText;
    }
  } catch {
    // If cloneNode fails in some environment, fallback to raw text
  }

  return textFromElement(turn);
}

function providerMessageIdFor(turn: Element, role: MessageRole, index: number): string {
  const explicitId =
    turn.getAttribute('data-message-id') ??
    turn.querySelector('[data-message-id]')?.getAttribute('data-message-id') ??
    turn.closest('[data-message-id]')?.getAttribute('data-message-id');

  if (explicitId?.trim()) {
    return explicitId.trim();
  }

  const testId =
    turn.getAttribute('data-testid') ??
    turn.closest('[data-testid]')?.getAttribute('data-testid') ??
    turn.querySelector('[data-testid]')?.getAttribute('data-testid');

  if (testId?.trim()) {
    return `chatgpt-${testId.trim()}`;
  }

  return `chatgpt-${role}-${index}`;
}

function deduplicateHierarchy(elements: Element[]): Element[] {
  return elements.filter((el) => !elements.some((other) => other !== el && other.contains(el)));
}

function findTurnElements(document: Document): Element[] {
  for (const selector of TURN_SELECTORS) {
    const found = Array.from(document.querySelectorAll(selector));
    if (found.length > 0) {
      return deduplicateHierarchy(found);
    }
  }

  return [];
}

function extractMessages(document: Document): ParsedMessage[] {
  const turns = findTurnElements(document);
  const messages: ParsedMessage[] = [];
  let previousRole: MessageRole | null = null;

  turns.forEach((turn, index) => {
    const role = detectRole(turn, index, previousRole);

    if (!role) {
      return;
    }

    const content = extractTurnContent(turn);

    if (content.length === 0) {
      return;
    }

    previousRole = role;
    messages.push({
      providerMessageId: providerMessageIdFor(turn, role, messages.length),
      role,
      content,
      sequence: messages.length,
    });
  });

  return messages;
}

/**
 * Extracts a complete ChatGPT conversation from the rendered DOM.
 *
 * The parser intentionally reads only the visible conversation content. It never submits,
 * edits or approves anything in the ChatGPT UI.
 */
export function parseChatGptConversation(input: ChatGptParseInput): ParsedConversation {
  let url: URL;

  try {
    url = new URL(input.url);
  } catch {
    throw new ConversationParseError('The current tab does not have a valid URL.');
  }

  if (!CHATGPT_HOSTS.has(url.hostname)) {
    throw new ConversationParseError('Open a ChatGPT conversation before syncing.');
  }

  const providerConversationId = chatGptConversationIdFromUrl(input.url);

  if (!providerConversationId) {
    throw new ConversationParseError(
      'Open a saved ChatGPT conversation (a URL containing /c/) before syncing.',
    );
  }

  const messages = extractMessages(input.document);

  if (messages.length === 0) {
    throw new ConversationParseError('No ChatGPT messages were found on this page.');
  }

  const title = titleFromDocument(input.document);

  return {
    provider: 'chatgpt',
    providerConversationId,
    url: canonicalUrl(url),
    title: title.length > 0 ? title : 'ChatGPT conversation',
    messages,
  };
}
