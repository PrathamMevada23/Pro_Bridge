import type { ParsedConversation } from '@pro-bridge/shared-types';
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { ProBridgeClient } from '../lib/api.js';
import {
  conversationKey,
  messagesForIncrementalSync,
  type LastAutoSync,
} from '../lib/auto-sync.js';
import { isAutoSyncEnabled, recordLastAutoSync } from '../lib/auto-sync-storage.js';
import { isConversationUpdatedRequest } from '../lib/messages.js';
import { loadSettings } from '../lib/settings.js';

const pendingConversations = new Map<string, ParsedConversation>();
const activeConversations = new Set<string>();

async function recordError(conversation: ParsedConversation, error: unknown): Promise<void> {
  const result: LastAutoSync = {
    provider: conversation.provider,
    providerConversationId: conversation.providerConversationId,
    status: 'error',
    message: error instanceof Error ? error.message : 'Automatic sync failed.',
    syncedAt: new Date().toISOString(),
    receivedMessages: 0,
    createdMessages: 0,
    updatedMessages: 0,
  };

  try {
    await recordLastAutoSync(result);
  } catch {
    // Storage failures should not break the background worker.
  }
}

async function syncConversation(conversation: ParsedConversation): Promise<void> {
  const settings = await loadSettings();

  if (settings.token.length === 0) {
    return;
  }

  if (!(await isAutoSyncEnabled(conversation.provider, conversation.providerConversationId))) {
    return;
  }

  const client = new ProBridgeClient({
    baseUrl: settings.apiBaseUrl,
    token: settings.token,
  });
  const linked = await client.findConversation(
    conversation.provider,
    conversation.providerConversationId,
  );

  if (!linked) {
    return;
  }

  const checkpoint = await client.getSyncStatus(linked.id);
  const lastSequence = checkpoint.lastSyncedAt === null ? null : checkpoint.lastMessageSequence;
  const messages = messagesForIncrementalSync(conversation.messages, lastSequence);

  if (messages.length === 0) {
    return;
  }

  const summary = await client.syncMessages(linked.id, messages);
  const changedMessages = summary.createdMessages + summary.updatedMessages;
  const result: LastAutoSync = {
    provider: conversation.provider,
    providerConversationId: conversation.providerConversationId,
    status: 'synced',
    message:
      changedMessages === 0
        ? 'Auto-sync checked; already up to date.'
        : `Auto-synced ${summary.createdMessages} new and ${summary.updatedMessages} updated messages.`,
    syncedAt: summary.lastSyncedAt,
    receivedMessages: summary.receivedMessages,
    createdMessages: summary.createdMessages,
    updatedMessages: summary.updatedMessages,
  };

  try {
    await recordLastAutoSync(result);
  } catch {
    // Storage failures should not break the background worker.
  }
}

async function drainQueue(key: string): Promise<void> {
  try {
    while (pendingConversations.has(key)) {
      const conversation = pendingConversations.get(key);
      pendingConversations.delete(key);

      if (!conversation) {
        continue;
      }

      try {
        await syncConversation(conversation);
      } catch (error) {
        await recordError(conversation, error);
      }
    }
  } finally {
    activeConversations.delete(key);
  }
}

function enqueueConversation(conversation: ParsedConversation): void {
  const key = conversationKey(conversation.provider, conversation.providerConversationId);
  pendingConversations.set(key, conversation);

  if (activeConversations.has(key)) {
    return;
  }

  activeConversations.add(key);
  void drainQueue(key).catch(() => {
    activeConversations.delete(key);
  });
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isConversationUpdatedRequest(message)) {
      return;
    }

    enqueueConversation(message.conversation);
    sendResponse({ queued: true });
  });
});
