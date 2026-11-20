import type { ConversationProvider } from '@pro-bridge/shared-types';
import { browser } from 'wxt/browser';
import { conversationKey, type LastAutoSync } from './auto-sync.js';

export const AUTO_SYNC_KEYS_STORAGE_KEY = 'proBridgeAutoSyncKeys';
export const LAST_AUTO_SYNC_STORAGE_KEY = 'proBridgeLastAutoSync';

function readKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

export async function isAutoSyncEnabled(
  provider: ConversationProvider,
  providerConversationId: string,
): Promise<boolean> {
  const stored = await browser.storage.local.get(AUTO_SYNC_KEYS_STORAGE_KEY);

  return readKeys(stored[AUTO_SYNC_KEYS_STORAGE_KEY]).includes(
    conversationKey(provider, providerConversationId),
  );
}

export async function setAutoSyncEnabled(
  provider: ConversationProvider,
  providerConversationId: string,
  enabled: boolean,
): Promise<void> {
  const stored = await browser.storage.local.get(AUTO_SYNC_KEYS_STORAGE_KEY);
  const keys = new Set(readKeys(stored[AUTO_SYNC_KEYS_STORAGE_KEY]));
  const key = conversationKey(provider, providerConversationId);

  if (enabled) {
    keys.add(key);
  } else {
    keys.delete(key);
  }

  await browser.storage.local.set({ [AUTO_SYNC_KEYS_STORAGE_KEY]: [...keys].sort() });
}

function isLastAutoSync(value: unknown): value is LastAutoSync {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    (record.provider === 'chatgpt' ||
      record.provider === 'claude' ||
      record.provider === 'gemini') &&
    typeof record.providerConversationId === 'string' &&
    (record.status === 'synced' || record.status === 'error') &&
    typeof record.message === 'string' &&
    typeof record.syncedAt === 'string' &&
    typeof record.receivedMessages === 'number' &&
    typeof record.createdMessages === 'number' &&
    typeof record.updatedMessages === 'number'
  );
}

export async function loadLastAutoSync(): Promise<LastAutoSync | null> {
  const stored = await browser.storage.local.get(LAST_AUTO_SYNC_STORAGE_KEY);
  const value = stored[LAST_AUTO_SYNC_STORAGE_KEY];

  return isLastAutoSync(value) ? value : null;
}

export async function recordLastAutoSync(result: LastAutoSync): Promise<void> {
  await browser.storage.local.set({ [LAST_AUTO_SYNC_STORAGE_KEY]: result });
}
