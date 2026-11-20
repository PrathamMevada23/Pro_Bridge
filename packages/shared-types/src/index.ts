/**
 * Shared, transport-agnostic types used by the core API, browser extension and MCP server.
 *
 * Keep this package free of runtime dependencies and framework-specific types. Runtime
 * validation lives in `@pro-bridge/validation`.
 */

export const API_ERROR_CODES = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'FORBIDDEN_ORIGIN',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}

export const CONVERSATION_PROVIDERS = ['chatgpt', 'claude', 'gemini'] as const;
export type ConversationProvider = (typeof CONVERSATION_PROVIDERS)[number];

export const MESSAGE_ROLES = ['user', 'assistant', 'system'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const DECISION_STATUSES = ['proposed', 'confirmed', 'rejected'] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const REQUIREMENT_KINDS = [
  'requirement',
  'constraint',
  'dependency',
  'clarification',
] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export const TASK_APPROVAL_STATUSES = ['proposed', 'confirmed', 'rejected'] as const;
export type TaskApprovalStatus = (typeof TASK_APPROVAL_STATUSES)[number];

export const TASK_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'blocked',
  'cancelled',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const SYNC_STATUSES = ['idle', 'syncing', 'success', 'error'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const AGENT_REPORT_TYPES = ['progress', 'completion', 'blocker'] as const;
export type AgentReportType = (typeof AGENT_REPORT_TYPES)[number];

export interface Project {
  id: string;
  name: string;
  description: string;
  repositoryPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  projectId: string | null;
  provider: ConversationProvider;
  providerConversationId: string;
  url: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  providerMessageId: string;
  role: MessageRole;
  content: string;
  contentHash: string;
  sequence: number;
  createdAt: string;
  capturedAt: string;
  editedAt: string | null;
}

export interface SyncResult {
  conversationId: string;
  receivedMessages: number;
  createdMessages: number;
  updatedMessages: number;
  lastSyncedAt: string;
  messages: Message[];
}

export interface SyncCheckpoint {
  conversationId: string;
  lastMessageSequence: number;
  lastMessageId: string | null;
  lastSyncedAt: string | null;
  status: SyncStatus;
  lastError: string | null;
}

export interface Requirement {
  id: string;
  projectId: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  kind: RequirementKind;
  text: string;
  status: DecisionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Decision {
  id: string;
  projectId: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  text: string;
  rationale: string | null;
  status: DecisionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  title: string;
  description: string;
  approvalStatus: TaskApprovalStatus;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AgentSession {
  id: string;
  projectId: string;
  agentName: string;
  externalSessionId: string | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentReport {
  id: string;
  projectId: string;
  agentSessionId: string | null;
  taskId: string | null;
  type: AgentReportType;
  summary: string;
  details: string | null;
  modifiedFiles: string[];
  createdAt: string;
}

export interface ContextExtractionResult {
  projectId: string;
  conversationId: string;
  requirementsCreated: number;
  decisionsCreated: number;
  tasksCreated: number;
  duplicatesSkipped: number;
  requirements: Requirement[];
  decisions: Decision[];
  tasks: Task[];
}

export interface ProjectContext {
  projectId: string;
  requirements: Requirement[];
  decisions: Decision[];
  tasks: Task[];
}

export interface ParsedMessage {
  providerMessageId: string;
  role: MessageRole;
  content: string;
  sequence: number;
}

export interface ParsedConversation {
  provider: ConversationProvider;
  providerConversationId: string;
  url: string;
  title: string;
  messages: ParsedMessage[];
}

export interface ProjectListResponse {
  projects: Project[];
}

export interface ConversationListResponse {
  conversations: Conversation[];
}

export interface MessageListResponse {
  messages: Message[];
}

export interface AgentSessionListResponse {
  sessions: AgentSession[];
}

export interface AgentReportListResponse {
  reports: AgentReport[];
}

export interface LinkConversationResponse {
  conversation: Conversation;
  created: boolean;
}
