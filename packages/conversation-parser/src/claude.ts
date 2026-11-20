import type { MessageRole, ParsedConversation, ParsedMessage } from '@pro-bridge/shared-types';
import { ConversationParseError } from './chatgpt.js';

const CLAUDE_HOSTS = new Set(['claude.ai', 'www.claude.ai']);

/**
 * User message body. Anthropic uses `data-testid="user-message"` as a stable anchor that
 * survives CSS class rotations.
 */
const USER_MSG_SELECTOR = '[data-testid="user-message"]';

/**
 * Claude's assistant response area. The outer container wraps the markdown render and
 * carries a stable class. We prefer this over relying on positional sibling logic.
 */
const ASSISTANT_MSG_SELECTOR = '.font-claude-message';

/**
 * Fallback class used in some Claude UI variants.
 */
const ASSISTANT_MSG_SELECTOR_ALT = '[data-is-streaming]';

/**
 * Conversation title. The page-header testid is stable across UI refreshes. When absent
 * we fall back to the document title stripping the suffix Claude appends.
 */
const PAGE_HEADER_SELECTOR = '[data-testid="page-header"]';
const TITLE_SUFFIX = /\s*[|·–—-]\s*Claude\s*$/i;

const CLAUDE_CONVERSATION_ID_RE = /\/([a-f0-9-]{36})\/?$/i;

export interface ClaudeParseInput {
  document: Document;
  url: string;
}

export function isClaudeUrl(url: string): boolean {
  try {
    return CLAUDE_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function claudeConversationIdFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(CLAUDE_CONVERSATION_ID_RE);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function canonicalUrl(url: URL): string {
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

function titleFromDocument(document: Document): string {
  const header = document.querySelector(PAGE_HEADER_SELECTOR);

  if (header) {
    const text = (header as HTMLElement).innerText ?? header.textContent ?? '';
    const trimmed = text.replace(TITLE_SUFFIX, '').trim();

    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return document.title.replace(TITLE_SUFFIX, '').trim();
}

function textFromElement(element: Element): string {
  const htmlElement = element as HTMLElement;
  const inner = typeof htmlElement.innerText === 'string' ? htmlElement.innerText : '';
  const text = inner.length > 0 ? inner : (element.textContent ?? '');
  return text.replace(/\r\n?/g, '\n').trim();
}

/**
 * Returns the assistant message container elements. Claude renders user and assistant
 * messages as alternating siblings, so we locate assistant turns by their content class.
 * We fall back to the streaming attribute selector for in-progress responses.
 */
function findAssistantElements(document: Document): Element[] {
  const primary = Array.from(document.querySelectorAll(ASSISTANT_MSG_SELECTOR));

  if (primary.length > 0) {
    return primary;
  }

  return Array.from(document.querySelectorAll(ASSISTANT_MSG_SELECTOR_ALT));
}

function extractMessages(document: Document): ParsedMessage[] {
  const userElements = Array.from(document.querySelectorAll(USER_MSG_SELECTOR));
  const assistantElements = findAssistantElements(document);

  if (userElements.length === 0 && assistantElements.length === 0) {
    return [];
  }

  /**
   * Interleave user and assistant messages by their document position. Claude always
   * starts with a user message then alternates, but we sort by DOM order to stay
   * accurate if the DOM layout changes.
   */
  type Candidate = { element: Element; role: MessageRole; docOrder: number };

  const candidates: Candidate[] = [];

  for (const el of userElements) {
    candidates.push({ element: el, role: 'user', docOrder: 0 });
  }

  for (const el of assistantElements) {
    candidates.push({ element: el, role: 'assistant', docOrder: 0 });
  }

  // Sort by DOM position using compareDocumentPosition
  candidates.sort((a, b) => {
    const position = a.element.compareDocumentPosition(b.element);

    if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1;
    }

    if (position & Node.DOCUMENT_POSITION_PRECEDING) {
      return 1;
    }

    return 0;
  });

  const messages: ParsedMessage[] = [];

  for (let index = 0; index < candidates.length; index++) {
    const { element, role } = candidates[index]!;
    const content = textFromElement(element);

    if (content.length === 0) {
      continue;
    }

    // Build a stable ID from role + position in the final message list
    const providerMessageId = `claude-${role}-${messages.length}`;

    messages.push({
      providerMessageId,
      role,
      content,
      sequence: messages.length,
    });
  }

  return messages;
}

/**
 * Extracts a complete Claude conversation from the rendered DOM.
 *
 * The parser reads only the visible conversation content. It never submits, edits or
 * approves anything in the Claude UI.
 */
export function parseClaudeConversation(input: ClaudeParseInput): ParsedConversation {
  let url: URL;

  try {
    url = new URL(input.url);
  } catch {
    throw new ConversationParseError('The current tab does not have a valid URL.');
  }

  if (!CLAUDE_HOSTS.has(url.hostname)) {
    throw new ConversationParseError('Open a Claude conversation before syncing.');
  }

  const providerConversationId = claudeConversationIdFromUrl(input.url);

  if (!providerConversationId) {
    throw new ConversationParseError(
      'Open a saved Claude conversation (a URL containing a conversation UUID) before syncing.',
    );
  }

  const messages = extractMessages(input.document);

  if (messages.length === 0) {
    throw new ConversationParseError('No Claude messages were found on this page.');
  }

  const title = titleFromDocument(input.document);

  return {
    provider: 'claude',
    providerConversationId,
    url: canonicalUrl(url),
    title: title.length > 0 ? title : 'Claude conversation',
    messages,
  };
}
