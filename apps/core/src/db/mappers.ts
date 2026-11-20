import type {
  AgentReport,
  AgentSession,
  Conversation,
  Decision,
  Message,
  Project,
  Requirement,
  SyncCheckpoint,
  Task,
} from '@pro-bridge/shared-types';
import type {
  agentReports,
  agentSessions,
  conversations,
  decisions,
  messages,
  projects,
  requirements,
  syncCheckpoints,
  tasks,
} from './schema.js';

type ProjectRow = typeof projects.$inferSelect;
type ConversationRow = typeof conversations.$inferSelect;
type MessageRow = typeof messages.$inferSelect;
type SyncCheckpointRow = typeof syncCheckpoints.$inferSelect;
type RequirementRow = typeof requirements.$inferSelect;
type DecisionRow = typeof decisions.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;
type AgentSessionRow = typeof agentSessions.$inferSelect;
type AgentReportRow = typeof agentReports.$inferSelect;

function toIsoString(value: Date): string {
  return value.toISOString();
}

function toNullableIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    repositoryPath: row.repositoryPath,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    projectId: row.projectId,
    provider: row.provider,
    providerConversationId: row.providerConversationId,
    url: row.url,
    title: row.title,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    lastSyncedAt: toNullableIsoString(row.lastSyncedAt),
  };
}

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    providerMessageId: row.providerMessageId,
    role: row.role,
    content: row.content,
    contentHash: row.contentHash,
    sequence: row.sequence,
    createdAt: toIsoString(row.createdAt),
    capturedAt: toIsoString(row.capturedAt),
    editedAt: toNullableIsoString(row.editedAt),
  };
}

export function toSyncCheckpoint(row: SyncCheckpointRow): SyncCheckpoint {
  return {
    conversationId: row.conversationId,
    lastMessageSequence: row.lastMessageSequence,
    lastMessageId: row.lastMessageId,
    lastSyncedAt: toNullableIsoString(row.lastSyncedAt),
    status: row.status,
    lastError: row.lastError,
  };
}

export function toRequirement(row: RequirementRow): Requirement {
  return {
    id: row.id,
    projectId: row.projectId,
    conversationId: row.conversationId,
    sourceMessageId: row.sourceMessageId,
    kind: row.kind,
    text: row.text,
    status: row.status,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function toDecision(row: DecisionRow): Decision {
  return {
    id: row.id,
    projectId: row.projectId,
    conversationId: row.conversationId,
    sourceMessageId: row.sourceMessageId,
    text: row.text,
    rationale: row.rationale,
    status: row.status,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    conversationId: row.conversationId,
    sourceMessageId: row.sourceMessageId,
    title: row.title,
    description: row.description,
    approvalStatus: row.approvalStatus,
    status: row.status,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    completedAt: toNullableIsoString(row.completedAt),
  };
}

export function toAgentSession(row: AgentSessionRow): AgentSession {
  return {
    id: row.id,
    projectId: row.projectId,
    agentName: row.agentName,
    externalSessionId: row.externalSessionId,
    startedAt: toIsoString(row.startedAt),
    endedAt: toNullableIsoString(row.endedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function toAgentReport(row: AgentReportRow): AgentReport {
  return {
    id: row.id,
    projectId: row.projectId,
    agentSessionId: row.agentSessionId,
    taskId: row.taskId,
    type: row.type,
    summary: row.summary,
    details: row.details,
    modifiedFiles: row.modifiedFiles,
    createdAt: toIsoString(row.createdAt),
  };
}
