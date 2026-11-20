import type { ConversationProvider, ParsedMessage } from '@pro-bridge/shared-types';

/**
 * Re-send a small overlap of already synced messages so edits and regenerated responses
 * are detected by the server's content hash comparison.
 */
export const SYNC_OVERLAP_MESSAGES = 2;

export function conversationKey(
  provider: ConversationProvider,
  providerConversationId: string,
): string {
  return `${provider}:${providerConversationId}`;
}

export function messagesForIncrementalSync(
  messages: readonly ParsedMessage[],
  lastMessageSequence: number | null,
): ParsedMessage[] {
  if (lastMessageSequence === null) {
    return [...messages];
  }

  const startSequence = Math.max(0, lastMessageSequence - SYNC_OVERLAP_MESSAGES);

  return messages.filter((message) => message.sequence >= startSequence);
}

export interface LastAutoSync {
  provider: ConversationProvider;
  providerConversationId: string;
  status: 'synced' | 'error';
  message: string;
  syncedAt: string;
  receivedMessages: number;
  createdMessages: number;
  updatedMessages: number;
}
