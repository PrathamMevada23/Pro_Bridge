import type {
  AgentReportType,
  ConversationProvider,
  DecisionStatus,
  MessageRole,
  RequirementKind,
  SyncStatus,
  TaskApprovalStatus,
  TaskStatus,
} from '@pro-bridge/shared-types';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamps = () => ({
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  repositoryPath: text('repository_path'),
  ...timestamps(),
});

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
    provider: text('provider').$type<ConversationProvider>().notNull(),
    providerConversationId: text('provider_conversation_id').notNull(),
    url: text('url').notNull(),
    title: text('title').notNull().default(''),
    ...timestamps(),
    lastSyncedAt: integer('last_synced_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('conversations_provider_conversation_unique').on(
      table.provider,
      table.providerConversationId,
    ),
    index('conversations_project_id_index').on(table.projectId),
  ],
);

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    providerMessageId: text('provider_message_id').notNull(),
    role: text('role').$type<MessageRole>().notNull(),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    sequence: integer('sequence').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    capturedAt: integer('captured_at', { mode: 'timestamp_ms' }).notNull(),
    editedAt: integer('edited_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('messages_conversation_provider_message_unique').on(
      table.conversationId,
      table.providerMessageId,
    ),
    index('messages_conversation_sequence_index').on(table.conversationId, table.sequence),
  ],
);

export const syncCheckpoints = sqliteTable('sync_checkpoints', {
  conversationId: text('conversation_id')
    .primaryKey()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  lastMessageSequence: integer('last_message_sequence').notNull().default(0),
  lastMessageId: text('last_message_id'),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp_ms' }).notNull(),
  status: text('status').$type<SyncStatus>().notNull().default('idle'),
  lastError: text('last_error'),
  ...timestamps(),
});

export const requirements = sqliteTable(
  'requirements',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    sourceMessageId: text('source_message_id').references(() => messages.id, {
      onDelete: 'set null',
    }),
    kind: text('kind').$type<RequirementKind>().notNull().default('requirement'),
    text: text('text').notNull(),
    status: text('status').$type<DecisionStatus>().notNull().default('proposed'),
    ...timestamps(),
  },
  (table) => [
    index('requirements_project_id_index').on(table.projectId),
    index('requirements_status_index').on(table.status),
    index('requirements_kind_index').on(table.kind),
  ],
);

export const decisions = sqliteTable(
  'decisions',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    sourceMessageId: text('source_message_id').references(() => messages.id, {
      onDelete: 'set null',
    }),
    text: text('text').notNull(),
    rationale: text('rationale'),
    status: text('status').$type<DecisionStatus>().notNull().default('proposed'),
    ...timestamps(),
  },
  (table) => [
    index('decisions_project_id_index').on(table.projectId),
    index('decisions_status_index').on(table.status),
  ],
);

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    sourceMessageId: text('source_message_id').references(() => messages.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    approvalStatus: text('approval_status')
      .$type<TaskApprovalStatus>()
      .notNull()
      .default('proposed'),
    status: text('status').$type<TaskStatus>().notNull().default('pending'),
    ...timestamps(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('tasks_project_id_index').on(table.projectId),
    index('tasks_status_index').on(table.status),
    index('tasks_approval_status_index').on(table.approvalStatus),
  ],
);

export const agentSessions = sqliteTable(
  'agent_sessions',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    agentName: text('agent_name').notNull(),
    externalSessionId: text('external_session_id'),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (table) => [index('agent_sessions_project_id_index').on(table.projectId)],
);

export const agentReports = sqliteTable(
  'agent_reports',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    agentSessionId: text('agent_session_id').references(() => agentSessions.id, {
      onDelete: 'set null',
    }),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    type: text('type').$type<AgentReportType>().notNull(),
    summary: text('summary').notNull(),
    details: text('details'),
    modifiedFiles: text('modified_files', { mode: 'json' }).$type<string[]>().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('agent_reports_project_id_index').on(table.projectId),
    index('agent_reports_created_at_index').on(table.createdAt),
  ],
);

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    type: text('type').notNull(),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('events_project_id_index').on(table.projectId),
    index('events_created_at_index').on(table.createdAt),
  ],
);
