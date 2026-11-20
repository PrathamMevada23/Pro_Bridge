import { randomUUID } from 'node:crypto';
import type { ConversationProvider, MessageRole } from '@pro-bridge/shared-types';
import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm';
import type { AppDatabase } from '../db/client.js';
import { conversations, messages, syncCheckpoints } from '../db/schema.js';

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type SyncCheckpointRow = typeof syncCheckpoints.$inferSelect;

export interface ConversationInsert {
  id: string;
  projectId: string | null;
  provider: ConversationProvider;
  providerConversationId: string;
  url: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt: Date | null;
}

export interface ConversationUpdate {
  projectId?: string | null;
  title?: string;
  url?: string;
  lastSyncedAt?: Date | null;
  updatedAt: Date;
}

export interface MessageSyncInput {
  providerMessageId: string;
  role: MessageRole;
  content: string;
  contentHash: string;
  sequence: number;
  createdAt: Date;
}

export interface MessageSyncResult {
  messages: MessageRow[];
  createdMessages: number;
  updatedMessages: number;
  syncedAt: Date;
}

export interface ListMessagesOptions {
  afterSequence?: number;
  limit: number;
}

export function listConversationRows(db: AppDatabase, projectId?: string): ConversationRow[] {
  const query = db.select().from(conversations);

  if (projectId) {
    return query
      .where(eq(conversations.projectId, projectId))
      .orderBy(desc(conversations.updatedAt))
      .all();
  }

  return query.orderBy(desc(conversations.updatedAt)).all();
}

export function findConversationRowById(db: AppDatabase, id: string): ConversationRow | undefined {
  return db.select().from(conversations).where(eq(conversations.id, id)).get();
}

export function findConversationRowByProvider(
  db: AppDatabase,
  provider: ConversationProvider,
  providerConversationId: string,
): ConversationRow | undefined {
  return db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.provider, provider),
        eq(conversations.providerConversationId, providerConversationId),
      ),
    )
    .get();
}

export function insertConversationRow(db: AppDatabase, row: ConversationInsert): ConversationRow {
  return db.insert(conversations).values(row).returning().get();
}

export function updateConversationRow(
  db: AppDatabase,
  id: string,
  changes: ConversationUpdate,
): ConversationRow | undefined {
  const values: Partial<typeof conversations.$inferInsert> = {
    updatedAt: changes.updatedAt,
  };

  if (changes.projectId !== undefined) {
    values.projectId = changes.projectId;
  }

  if (changes.title !== undefined) {
    values.title = changes.title;
  }

  if (changes.url !== undefined) {
    values.url = changes.url;
  }

  if (changes.lastSyncedAt !== undefined) {
    values.lastSyncedAt = changes.lastSyncedAt;
  }

  return db.update(conversations).set(values).where(eq(conversations.id, id)).returning().get();
}

export function deleteConversationRow(db: AppDatabase, id: string): boolean {
  const result = db.delete(conversations).where(eq(conversations.id, id)).run();
  return result.changes > 0;
}

export function findSyncCheckpointRow(
  db: AppDatabase,
  conversationId: string,
): SyncCheckpointRow | undefined {
  return db
    .select()
    .from(syncCheckpoints)
    .where(eq(syncCheckpoints.conversationId, conversationId))
    .get();
}

export function listAllMessageRows(db: AppDatabase, conversationId: string): MessageRow[] {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.sequence))
    .all();
}

export function listMessageRows(
  db: AppDatabase,
  conversationId: string,
  options: ListMessagesOptions,
): MessageRow[] {
  const condition =
    options.afterSequence === undefined
      ? eq(messages.conversationId, conversationId)
      : and(
          eq(messages.conversationId, conversationId),
          gt(messages.sequence, options.afterSequence),
        );

  return db
    .select()
    .from(messages)
    .where(condition)
    .orderBy(asc(messages.sequence))
    .limit(options.limit)
    .all();
}

export function persistMessageSync(
  db: AppDatabase,
  conversationId: string,
  inputs: MessageSyncInput[],
): MessageSyncResult {
  return db.transaction((tx) => {
    const now = new Date();
    let createdMessages = 0;
    let updatedMessages = 0;
    const resultMessages: MessageRow[] = [];

    const providerMessageIds = inputs.map((input) => input.providerMessageId);
    const existingRows =
      providerMessageIds.length > 0
        ? tx
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.conversationId, conversationId),
                inArray(messages.providerMessageId, providerMessageIds),
              ),
            )
            .all()
        : [];
    const existingByProviderId = new Map(existingRows.map((row) => [row.providerMessageId, row]));

    for (const input of inputs) {
      const existing = existingByProviderId.get(input.providerMessageId);

      if (!existing) {
        const row: MessageRow = {
          id: randomUUID(),
          conversationId,
          providerMessageId: input.providerMessageId,
          role: input.role,
          content: input.content,
          contentHash: input.contentHash,
          sequence: input.sequence,
          createdAt: input.createdAt,
          capturedAt: now,
          editedAt: null,
        };

        tx.insert(messages).values(row).run();
        resultMessages.push(row);
        createdMessages += 1;
        continue;
      }

      const contentChanged = existing.contentHash !== input.contentHash;
      const sequenceChanged = existing.sequence !== input.sequence;

      if (!contentChanged && !sequenceChanged) {
        resultMessages.push(existing);
        continue;
      }

      const updatedRow: MessageRow = {
        ...existing,
        content: input.content,
        contentHash: input.contentHash,
        sequence: input.sequence,
        editedAt: contentChanged ? now : existing.editedAt,
      };

      tx.update(messages)
        .set({
          content: updatedRow.content,
          contentHash: updatedRow.contentHash,
          sequence: updatedRow.sequence,
          editedAt: updatedRow.editedAt,
        })
        .where(eq(messages.id, existing.id))
        .run();

      resultMessages.push(updatedRow);
      updatedMessages += 1;
    }

    tx.update(conversations)
      .set({ lastSyncedAt: now, updatedAt: now })
      .where(eq(conversations.id, conversationId))
      .run();

    const latestMessage = tx
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.sequence))
      .limit(1)
      .get();

    tx.insert(syncCheckpoints)
      .values({
        conversationId,
        lastMessageSequence: latestMessage?.sequence ?? 0,
        lastMessageId: latestMessage?.id ?? null,
        lastSyncedAt: now,
        status: 'success',
        lastError: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: syncCheckpoints.conversationId,
        set: {
          lastMessageSequence: latestMessage?.sequence ?? 0,
          lastMessageId: latestMessage?.id ?? null,
          lastSyncedAt: now,
          status: 'success',
          lastError: null,
          updatedAt: now,
        },
      })
      .run();

    return {
      messages: resultMessages,
      createdMessages,
      updatedMessages,
      syncedAt: now,
    };
  });
}
