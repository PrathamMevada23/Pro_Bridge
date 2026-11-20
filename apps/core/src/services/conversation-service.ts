import { createHash, randomUUID } from 'node:crypto';
import type { Conversation, Message, SyncCheckpoint, SyncResult } from '@pro-bridge/shared-types';
import type {
  ConversationCreateInput,
  ConversationUpdateInput,
  MessageListQuery,
  SyncMessagesInput,
} from '@pro-bridge/validation';
import type { AppDatabase } from '../db/client.js';
import { toConversation, toMessage, toSyncCheckpoint } from '../db/mappers.js';
import { NotFoundError } from '../errors.js';
import { findProjectRow } from '../repositories/project-repository.js';
import {
  deleteConversationRow,
  findConversationRowById,
  findConversationRowByProvider,
  findSyncCheckpointRow,
  insertConversationRow,
  listConversationRows,
  listMessageRows,
  persistMessageSync,
  updateConversationRow,
  type ConversationUpdate,
} from '../repositories/conversation-repository.js';

function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export class ConversationService {
  constructor(private readonly db: AppDatabase) {}

  list(projectId?: string): Conversation[] {
    return listConversationRows(this.db, projectId).map(toConversation);
  }

  get(id: string): Conversation {
    const row = findConversationRowById(this.db, id);

    if (!row) {
      throw new NotFoundError('Conversation not found.');
    }

    return toConversation(row);
  }

  link(input: ConversationCreateInput): { conversation: Conversation; created: boolean } {
    const project = findProjectRow(this.db, input.projectId);

    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    const existing = findConversationRowByProvider(
      this.db,
      input.provider,
      input.providerConversationId,
    );
    const now = new Date();

    if (existing) {
      const changes: ConversationUpdate = {
        projectId: input.projectId,
        url: input.url,
        updatedAt: now,
      };

      if (input.title !== undefined) {
        changes.title = input.title;
      }

      const row = updateConversationRow(this.db, existing.id, changes);

      if (!row) {
        throw new NotFoundError('Conversation not found.');
      }

      return {
        conversation: toConversation(row),
        created: false,
      };
    }

    const row = insertConversationRow(this.db, {
      id: randomUUID(),
      projectId: input.projectId,
      provider: input.provider,
      providerConversationId: input.providerConversationId,
      url: input.url,
      title: input.title ?? '',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: null,
    });

    return {
      conversation: toConversation(row),
      created: true,
    };
  }

  update(id: string, input: ConversationUpdateInput): Conversation {
    if (input.projectId !== undefined && input.projectId !== null) {
      const project = findProjectRow(this.db, input.projectId);

      if (!project) {
        throw new NotFoundError('Project not found.');
      }
    }

    const changes: ConversationUpdate = { updatedAt: new Date() };

    if (input.projectId !== undefined) {
      changes.projectId = input.projectId;
    }

    if (input.title !== undefined) {
      changes.title = input.title;
    }

    if (input.url !== undefined) {
      changes.url = input.url;
    }

    const row = updateConversationRow(this.db, id, changes);

    if (!row) {
      throw new NotFoundError('Conversation not found.');
    }

    return toConversation(row);
  }

  delete(id: string): void {
    if (!deleteConversationRow(this.db, id)) {
      throw new NotFoundError('Conversation not found.');
    }
  }

  getSyncStatus(id: string): SyncCheckpoint {
    const conversation = findConversationRowById(this.db, id);

    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }

    const row = findSyncCheckpointRow(this.db, id);

    if (!row) {
      return {
        conversationId: id,
        lastMessageSequence: 0,
        lastMessageId: null,
        lastSyncedAt: null,
        status: 'idle',
        lastError: null,
      };
    }

    return toSyncCheckpoint(row);
  }

  listMessages(id: string, query: MessageListQuery): Message[] {
    const conversation = findConversationRowById(this.db, id);

    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }

    const options =
      query.afterSequence === undefined
        ? { limit: query.limit }
        : { afterSequence: query.afterSequence, limit: query.limit };

    return listMessageRows(this.db, id, options).map(toMessage);
  }

  syncMessages(id: string, input: SyncMessagesInput): SyncResult {
    const conversation = findConversationRowById(this.db, id);

    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }

    const now = new Date();
    const messageInputs = input.messages.map((message) => ({
      providerMessageId: message.providerMessageId,
      role: message.role,
      content: message.content,
      contentHash: hashContent(message.content),
      sequence: message.sequence,
      createdAt: message.createdAt ? new Date(message.createdAt) : now,
    }));

    const result = persistMessageSync(this.db, id, messageInputs);

    return {
      conversationId: id,
      receivedMessages: input.messages.length,
      createdMessages: result.createdMessages,
      updatedMessages: result.updatedMessages,
      lastSyncedAt: result.syncedAt.toISOString(),
      messages: result.messages.map(toMessage),
    };
  }
}
