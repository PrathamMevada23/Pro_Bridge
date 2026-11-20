import { parseGeminiConversation } from '@pro-bridge/conversation-parser';
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import {
  CONVERSATION_UPDATED,
  isGetConversationRequest,
  type ConversationUpdatedRequest,
  type GetConversationResponse,
} from '../lib/messages.js';

const DEBOUNCE_MS = 1200;

function readConversation(): GetConversationResponse {
  try {
    return {
      ok: true,
      conversation: parseGeminiConversation({
        document,
        url: window.location.href,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to read the Gemini conversation.',
    };
  }
}

export default defineContentScript({
  matches: ['https://gemini.google.com/*'],
  main() {
    let debounceTimer: number | undefined;
    let lastSignature = '';

    async function publishConversation(): Promise<void> {
      const response = readConversation();

      if (!response.ok) {
        return;
      }

      const signature = `${response.conversation.providerConversationId}:${JSON.stringify(
        response.conversation.messages,
      )}`;

      if (signature === lastSignature) {
        return;
      }

      try {
        await browser.runtime.sendMessage<ConversationUpdatedRequest, unknown>({
          type: CONVERSATION_UPDATED,
          conversation: response.conversation,
        });
        lastSignature = signature;
      } catch {
        // The background worker may not be ready yet. The next DOM change retries.
      }
    }

    function schedulePublish(delay = DEBOUNCE_MS): void {
      if (debounceTimer !== undefined) {
        window.clearTimeout(debounceTimer);
      }

      debounceTimer = window.setTimeout(() => {
        debounceTimer = undefined;
        void publishConversation();
      }, delay);
    }

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!isGetConversationRequest(message)) {
        return;
      }

      sendResponse(readConversation());
    });

    const root = document.body ?? document.documentElement;
    const observer = new MutationObserver(() => {
      schedulePublish();
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    schedulePublish(300);
  },
});
