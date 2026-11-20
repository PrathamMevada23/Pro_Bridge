import type { ConversationProvider } from '@pro-bridge/shared-types';
import { isChatGptUrl } from './chatgpt.js';
import { isClaudeUrl } from './claude.js';
import { isGeminiUrl } from './gemini.js';

export {
  chatGptConversationIdFromUrl,
  ConversationParseError,
  isChatGptUrl,
  parseChatGptConversation,
  type ChatGptParseInput,
} from './chatgpt.js';

export {
  claudeConversationIdFromUrl,
  isClaudeUrl,
  parseClaudeConversation,
  type ClaudeParseInput,
} from './claude.js';

export {
  geminiConversationIdFromUrl,
  isGeminiUrl,
  parseGeminiConversation,
  type GeminiParseInput,
} from './gemini.js';

export function isSupportedConversationUrl(url: string): boolean {
  return isChatGptUrl(url) || isClaudeUrl(url) || isGeminiUrl(url);
}

export function detectConversationProvider(url: string): ConversationProvider | null {
  if (isChatGptUrl(url)) {
    return 'chatgpt';
  }
  if (isClaudeUrl(url)) {
    return 'claude';
  }
  if (isGeminiUrl(url)) {
    return 'gemini';
  }
  return null;
}
