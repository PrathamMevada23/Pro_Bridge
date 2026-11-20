import {
  AGENT_REPORT_TYPES,
  API_ERROR_CODES,
  CONVERSATION_PROVIDERS,
  DECISION_STATUSES,
  MESSAGE_ROLES,
  REQUIREMENT_KINDS,
  SYNC_STATUSES,
  TASK_APPROVAL_STATUSES,
  TASK_STATUSES,
  type AgentReport,
  type AgentReportListResponse,
  type AgentSession,
  type AgentSessionListResponse,
  type ApiErrorBody,
  type ContextExtractionResult,
  type Conversation,
  type Decision,
  type HealthResponse,
  type LinkConversationResponse,
  type Message,
  type ParsedConversation,
  type ParsedMessage,
  type Project,
  type ProjectContext,
  type Requirement,
  type SyncCheckpoint,
  type SyncResult,
  type Task,
} from '@pro-bridge/shared-types';
import { z } from 'zod';

const isoDateTime = z.iso.datetime();
const httpUrl = z.url({ protocol: /^https?$/ });

export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
}) satisfies z.ZodType<ApiErrorBody>;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string().min(1),
  version: z.string().min(1),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: isoDateTime,
}) satisfies z.ZodType<HealthResponse>;

export const ConversationProviderSchema = z.enum(CONVERSATION_PROVIDERS);
export const MessageRoleSchema = z.enum(MESSAGE_ROLES);
export const DecisionStatusSchema = z.enum(DECISION_STATUSES);
export const RequirementKindSchema = z.enum(REQUIREMENT_KINDS);
export const TaskApprovalStatusSchema = z.enum(TASK_APPROVAL_STATUSES);
export const TaskStatusSchema = z.enum(TASK_STATUSES);
export const SyncStatusSchema = z.enum(SYNC_STATUSES);
export const AgentReportTypeSchema = z.enum(AGENT_REPORT_TYPES);

export const ProjectIdSchema = z.uuid();
export const ConversationIdSchema = z.uuid();
export const AgentSessionIdSchema = z.uuid();

export const ProjectSchema = z.object({
  id: ProjectIdSchema,
  name: z.string().min(1),
  description: z.string(),
  repositoryPath: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
}) satisfies z.ZodType<Project>;

export const ConversationSchema = z.object({
  id: ConversationIdSchema,
  projectId: ProjectIdSchema.nullable(),
  provider: ConversationProviderSchema,
  providerConversationId: z.string().min(1),
  url: httpUrl,
  title: z.string(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  lastSyncedAt: isoDateTime.nullable(),
}) satisfies z.ZodType<Conversation>;

export const MessageSchema = z.object({
  id: z.uuid(),
  conversationId: ConversationIdSchema,
  providerMessageId: z.string().min(1),
  role: MessageRoleSchema,
  content: z.string(),
  contentHash: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  createdAt: isoDateTime,
  capturedAt: isoDateTime,
  editedAt: isoDateTime.nullable(),
}) satisfies z.ZodType<Message>;

export const SyncResultSchema = z.object({
  conversationId: ConversationIdSchema,
  receivedMessages: z.number().int().nonnegative(),
  createdMessages: z.number().int().nonnegative(),
  updatedMessages: z.number().int().nonnegative(),
  lastSyncedAt: isoDateTime,
  messages: z.array(MessageSchema),
}) satisfies z.ZodType<SyncResult>;

export const SyncCheckpointSchema = z.object({
  conversationId: ConversationIdSchema,
  lastMessageSequence: z.number().int().nonnegative(),
  lastMessageId: z.string().min(1).nullable(),
  lastSyncedAt: isoDateTime.nullable(),
  status: SyncStatusSchema,
  lastError: z.string().nullable(),
}) satisfies z.ZodType<SyncCheckpoint>;

export const RequirementSchema = z.object({
  id: z.uuid(),
  projectId: ProjectIdSchema,
  conversationId: ConversationIdSchema.nullable(),
  sourceMessageId: z.uuid().nullable(),
  kind: RequirementKindSchema,
  text: z.string().min(1),
  status: DecisionStatusSchema,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
}) satisfies z.ZodType<Requirement>;

export const DecisionSchema = z.object({
  id: z.uuid(),
  projectId: ProjectIdSchema,
  conversationId: ConversationIdSchema.nullable(),
  sourceMessageId: z.uuid().nullable(),
  text: z.string().min(1),
  rationale: z.string().nullable(),
  status: DecisionStatusSchema,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
}) satisfies z.ZodType<Decision>;

export const TaskSchema = z.object({
  id: z.uuid(),
  projectId: ProjectIdSchema,
  conversationId: ConversationIdSchema.nullable(),
  sourceMessageId: z.uuid().nullable(),
  title: z.string().min(1),
  description: z.string(),
  approvalStatus: TaskApprovalStatusSchema,
  status: TaskStatusSchema,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  completedAt: isoDateTime.nullable(),
}) satisfies z.ZodType<Task>;

export const AgentSessionSchema = z.object({
  id: z.uuid(),
  projectId: ProjectIdSchema,
  agentName: z.string().min(1),
  externalSessionId: z.string().nullable(),
  startedAt: isoDateTime,
  endedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
}) satisfies z.ZodType<AgentSession>;

export const AgentReportSchema = z.object({
  id: z.uuid(),
  projectId: ProjectIdSchema,
  agentSessionId: z.uuid().nullable(),
  taskId: z.uuid().nullable(),
  type: AgentReportTypeSchema,
  summary: z.string().min(1),
  details: z.string().nullable(),
  modifiedFiles: z.array(z.string()),
  createdAt: isoDateTime,
}) satisfies z.ZodType<AgentReport>;

export const AgentSessionListResponseSchema = z.object({
  sessions: z.array(AgentSessionSchema),
}) satisfies z.ZodType<AgentSessionListResponse>;

export const AgentReportListResponseSchema = z.object({
  reports: z.array(AgentReportSchema),
}) satisfies z.ZodType<AgentReportListResponse>;

export const ContextExtractionResultSchema = z.object({
  projectId: ProjectIdSchema,
  conversationId: ConversationIdSchema,
  requirementsCreated: z.number().int().nonnegative(),
  decisionsCreated: z.number().int().nonnegative(),
  tasksCreated: z.number().int().nonnegative(),
  duplicatesSkipped: z.number().int().nonnegative(),
  requirements: z.array(RequirementSchema),
  decisions: z.array(DecisionSchema),
  tasks: z.array(TaskSchema),
}) satisfies z.ZodType<ContextExtractionResult>;

export const ProjectContextSchema = z.object({
  projectId: ProjectIdSchema,
  requirements: z.array(RequirementSchema),
  decisions: z.array(DecisionSchema),
  tasks: z.array(TaskSchema),
}) satisfies z.ZodType<ProjectContext>;

export const RequirementListResponseSchema = z.object({
  requirements: z.array(RequirementSchema),
});

export const DecisionListResponseSchema = z.object({
  decisions: z.array(DecisionSchema),
});

export const TaskListResponseSchema = z.object({
  tasks: z.array(TaskSchema),
});

export const ParsedMessageSchema = z.object({
  providerMessageId: z.string().min(1),
  role: MessageRoleSchema,
  content: z.string().min(1),
  sequence: z.number().int().nonnegative(),
}) satisfies z.ZodType<ParsedMessage>;

export const ParsedConversationSchema = z.object({
  provider: ConversationProviderSchema,
  providerConversationId: z.string().min(1),
  url: httpUrl,
  title: z.string(),
  messages: z.array(ParsedMessageSchema).min(1),
}) satisfies z.ZodType<ParsedConversation>;

export const ProjectListResponseSchema = z.object({
  projects: z.array(ProjectSchema),
});

export const ConversationListResponseSchema = z.object({
  conversations: z.array(ConversationSchema),
});

export const MessageListResponseSchema = z.object({
  messages: z.array(MessageSchema),
});

export const LinkConversationResponseSchema = z.object({
  conversation: ConversationSchema,
  created: z.boolean(),
}) satisfies z.ZodType<LinkConversationResponse>;

export const ProjectCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  repositoryPath: z.string().trim().max(2000).nullable().optional(),
});

export const ProjectUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    repositoryPath: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export const ConversationCreateSchema = z.object({
  projectId: ProjectIdSchema,
  provider: ConversationProviderSchema,
  providerConversationId: z.string().trim().min(1).max(500),
  url: httpUrl,
  title: z.string().trim().max(500).optional(),
});

export const ConversationUpdateSchema = z
  .object({
    projectId: ProjectIdSchema.nullable().optional(),
    title: z.string().trim().max(500).optional(),
    url: httpUrl.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export const MessageInputSchema = z.object({
  providerMessageId: z.string().trim().min(1).max(500),
  role: MessageRoleSchema,
  content: z.string().min(1).max(1_000_000),
  sequence: z.number().int().nonnegative(),
  createdAt: isoDateTime.optional(),
});

export const SyncMessagesSchema = z
  .object({
    messages: z.array(MessageInputSchema).max(1000),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();

    value.messages.forEach((message, index) => {
      if (seen.has(message.providerMessageId)) {
        context.addIssue({
          code: 'custom',
          path: ['messages', index, 'providerMessageId'],
          message: 'providerMessageId values must be unique within a sync request.',
        });
      }

      seen.add(message.providerMessageId);
    });
  });

export const MessageListQuerySchema = z.object({
  afterSequence: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

export const ConversationListQuerySchema = z.object({
  projectId: ProjectIdSchema.optional(),
});

export const RequirementListQuerySchema = z.object({
  kind: RequirementKindSchema.optional(),
  status: DecisionStatusSchema.optional(),
});

export const DecisionListQuerySchema = z.object({
  status: DecisionStatusSchema.optional(),
});

export const TaskListQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  approvalStatus: TaskApprovalStatusSchema.optional(),
});

export const RequirementUpdateSchema = z.object({
  status: DecisionStatusSchema,
});

export const DecisionUpdateSchema = z.object({
  status: DecisionStatusSchema,
});

export const TaskUpdateSchema = z
  .object({
    approvalStatus: TaskApprovalStatusSchema.optional(),
    status: TaskStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export const AgentSessionCreateSchema = z.object({
  agentName: z.string().trim().min(1).max(200),
  externalSessionId: z.string().trim().min(1).max(500).nullable().optional(),
  startedAt: isoDateTime.optional(),
});

export const AgentSessionEndSchema = z.object({
  endedAt: isoDateTime.optional(),
});

export const AgentReportCreateSchema = z.object({
  agentSessionId: AgentSessionIdSchema.nullable().optional(),
  taskId: z.uuid().nullable().optional(),
  type: AgentReportTypeSchema,
  summary: z.string().trim().min(1).max(2000),
  details: z.string().max(100_000).optional(),
  modifiedFiles: z.array(z.string().trim().min(1).max(2000)).max(1000).optional(),
});

export const AgentReportListQuerySchema = z.object({
  agentSessionId: AgentSessionIdSchema.optional(),
  taskId: z.uuid().optional(),
  type: AgentReportTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

export const AgentSessionReportListQuerySchema = z.object({
  taskId: z.uuid().optional(),
  type: AgentReportTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

export const ProjectIdParamsSchema = z.object({
  projectId: ProjectIdSchema,
});

export const ConversationIdParamsSchema = z.object({
  conversationId: ConversationIdSchema,
});

export const AgentSessionIdParamsSchema = z.object({
  agentSessionId: AgentSessionIdSchema,
});

export const RequirementIdParamsSchema = z.object({
  requirementId: z.uuid(),
});

export const DecisionIdParamsSchema = z.object({
  decisionId: z.uuid(),
});

export const TaskIdParamsSchema = z.object({
  taskId: z.uuid(),
});

export type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateSchema>;
export type ConversationCreateInput = z.infer<typeof ConversationCreateSchema>;
export type ConversationUpdateInput = z.infer<typeof ConversationUpdateSchema>;
export type MessageInput = z.infer<typeof MessageInputSchema>;
export type SyncMessagesInput = z.infer<typeof SyncMessagesSchema>;
export type MessageListQuery = z.infer<typeof MessageListQuerySchema>;
export type RequirementListQuery = z.infer<typeof RequirementListQuerySchema>;
export type DecisionListQuery = z.infer<typeof DecisionListQuerySchema>;
export type TaskListQuery = z.infer<typeof TaskListQuerySchema>;
export type RequirementUpdateInput = z.infer<typeof RequirementUpdateSchema>;
export type DecisionUpdateInput = z.infer<typeof DecisionUpdateSchema>;
export type TaskUpdateInput = z.infer<typeof TaskUpdateSchema>;
export type AgentSessionCreateInput = z.infer<typeof AgentSessionCreateSchema>;
export type AgentSessionEndInput = z.infer<typeof AgentSessionEndSchema>;
export type AgentReportCreateInput = z.infer<typeof AgentReportCreateSchema>;
export type AgentReportListQuery = z.infer<typeof AgentReportListQuerySchema>;
export type AgentSessionReportListQuery = z.infer<typeof AgentSessionReportListQuerySchema>;
