import type { ParsedConversation, ParsedMessage } from '@pro-bridge/shared-types';
import { ConversationParseError } from './chatgpt.js';

const GEMINI_HOSTS = new Set(['gemini.google.com']);

/**
 * Gemini is built with Angular and uses Web Component custom element tags that are stable
 * across CSS class rotations and framework updates.
 *
 * - `user-query`     – each user prompt turn
 * - `model-response` – each Gemini model response turn
 *
 * We prefer these tag selectors over class-based selectors because Angular does not
 * hash custom element tag names the way it hashes CSS class names.
 */
const USER_TURN_SELECTOR = 'user-query';
const ASSISTANT_TURN_SELECTOR = 'model-response';

/**
 * Content selectors tried in order within each turn element.
 */
const USER_CONTENT_SELECTORS = ['.query-text', '.user-query-container', '.user-query-text', 'p'];

const ASSISTANT_CONTENT_SELECTORS = [
  'message-content',
  '.model-response-text',
  '.response-container',
  'p',
];

const TITLE_SUFFIX = /\s*[|·–—-]\s*Gemini\s*$/i;

/**
 * Gemini conversation URLs follow the pattern /app/<conversationId>.
 */
const GEMINI_CONVERSATION_ID_RE = /\/app\/([a-zA-Z0-9_-]+)\/?/;

export interface GeminiParseInput {
  document: Document;
  url: string;
}

export function isGeminiUrl(url: string): boolean {
  try {
    return GEMINI_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function geminiConversationIdFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(GEMINI_CONVERSATION_ID_RE);
    return match?.[1] ?? null;
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
  const inner = typeof htmlElement.innerText === 'string' ? htmlElement.innerText : '';
  const text = inner.length > 0 ? inner : (element.textContent ?? '');
  return text.replace(/\r\n?/g, '\n').trim();
}

function findContentIn(element: Element, selectors: string[]): string {
  for (const selector of selectors) {
    const child = element.querySelector(selector);

    if (child) {
      const text = textFromElement(child);

      if (text.length > 0) {
        return text;
      }
    }
  }

  // Final fallback: use the entire element's text
  return textFromElement(element);
}

function extractMessages(document: Document): ParsedMessage[] {
  const userTurns = Array.from(document.querySelectorAll(USER_TURN_SELECTOR));
  const assistantTurns = Array.from(document.querySelectorAll(ASSISTANT_TURN_SELECTOR));

  if (userTurns.length === 0 && assistantTurns.length === 0) {
    return [];
  }

  type Candidate = { element: Element; role: 'user' | 'assistant' };

  const candidates: Candidate[] = [];

  for (const el of userTurns) {
    candidates.push({ element: el, role: 'user' });
  }

  for (const el of assistantTurns) {
    candidates.push({ element: el, role: 'assistant' });
  }

  // Sort by DOM position
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

  for (const { element, role } of candidates) {
    const contentSelectors = role === 'user' ? USER_CONTENT_SELECTORS : ASSISTANT_CONTENT_SELECTORS;
    const content = findContentIn(element, contentSelectors);

    if (content.length === 0) {
      continue;
    }

    messages.push({
      providerMessageId: `gemini-${role}-${messages.length}`,
      role,
      content,
      sequence: messages.length,
    });
  }

  return messages;
}

/**
 * Extracts a complete Gemini conversation from the rendered DOM.
 *
 * The parser reads only the visible conversation content. It never submits, edits or
 * approves anything in the Gemini UI.
 */
export function parseGeminiConversation(input: GeminiParseInput): ParsedConversation {
  let url: URL;

  try {
    url = new URL(input.url);
  } catch {
    throw new ConversationParseError('The current tab does not have a valid URL.');
  }

  if (!GEMINI_HOSTS.has(url.hostname)) {
    throw new ConversationParseError('Open a Gemini conversation before syncing.');
  }

  const providerConversationId = geminiConversationIdFromUrl(input.url);

  if (!providerConversationId) {
    throw new ConversationParseError(
      'Open a saved Gemini conversation (a URL containing /app/<id>) before syncing.',
    );
  }

  const messages = extractMessages(input.document);

  if (messages.length === 0) {
    throw new ConversationParseError('No Gemini messages were found on this page.');
  }

  const title = titleFromDocument(input.document);

  return {
    provider: 'gemini',
    providerConversationId,
    url: canonicalUrl(url),
    title: title.length > 0 ? title : 'Gemini conversation',
    messages,
  };
}
