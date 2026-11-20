import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AgentReportType } from '@pro-bridge/shared-types';
import {
  AgentReportTypeSchema,
  DecisionStatusSchema,
  RequirementKindSchema,
  TaskApprovalStatusSchema,
  TaskStatusSchema,
} from '@pro-bridge/validation';
import { z } from 'zod';
import type { CoreApi } from './client.js';
import { jsonResult, toErrorResult } from './results.js';

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const IDEMPOTENT_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

async function run(operation: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return jsonResult(await operation());
  } catch (error) {
    return toErrorResult(error);
  }
}

const projectId = z.uuid().describe('Pro_Bridge project identifier.');
const conversationId = z.uuid().describe('Pro_Bridge conversation identifier.');
const agentSessionId = z.uuid().describe('Pro_Bridge agent session identifier.');
const optionalTaskId = z
  .uuid()
  .optional()
  .describe('Optional Pro_Bridge task identifier to associate with the report.');
const optionalAgentSessionId = z
  .uuid()
  .optional()
  .describe('Optional agent session identifier. It must belong to the same project.');
const reportSummary = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .describe('Short, human-readable summary of the feedback.');
const reportDetails = z
  .string()
  .max(100_000)
  .optional()
  .describe('Optional longer details, such as commands run or errors encountered.');
const modifiedFiles = z
  .array(z.string().trim().min(1).max(2000))
  .max(1000)
  .optional()
  .describe('Optional list of repository-relative files changed by the agent.');

function registerReportTool(
  server: McpServer,
  api: CoreApi,
  type: AgentReportType,
  title: string,
  description: string,
): void {
  server.registerTool(
    `report_${type}`,
    {
      title,
      description,
      inputSchema: {
        projectId,
        summary: reportSummary,
        agentSessionId: optionalAgentSessionId,
        taskId: optionalTaskId,
        details: reportDetails,
        modifiedFiles,
      },
      annotations: WRITE,
    },
    (args) =>
      run(() =>
        api.createAgentReport(args.projectId, {
          type,
          summary: args.summary,
          ...(args.agentSessionId !== undefined ? { agentSessionId: args.agentSessionId } : {}),
          ...(args.taskId !== undefined ? { taskId: args.taskId } : {}),
          ...(args.details !== undefined ? { details: args.details } : {}),
          ...(args.modifiedFiles !== undefined ? { modifiedFiles: args.modifiedFiles } : {}),
        }),
      ),
  );
}

export function registerTools(server: McpServer, api: CoreApi): void {
  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description:
        'List all Pro_Bridge projects. Each project groups captured conversations and extracted context.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    () => run(() => api.listProjects()),
  );

  server.registerTool(
    'get_project',
    {
      title: 'Get project',
      description: 'Read a single Pro_Bridge project by identifier.',
      inputSchema: {
        projectId,
      },
      annotations: READ_ONLY,
    },
    (args) => run(() => api.getProject(args.projectId)),
  );

  server.registerTool(
    'get_project_context',
    {
      title: 'Get project context',
      description:
        'Read the full extracted context for a project: requirements, decisions and tasks. Extracted items are suggestions; check each item status before treating it as approved.',
      inputSchema: {
        projectId,
      },
      annotations: READ_ONLY,
    },
    (args) => run(() => api.getProjectContext(args.projectId)),
  );

  server.registerTool(
    'list_conversations',
    {
      title: 'List conversations',
      description:
        'List captured conversations, optionally filtered to one project. Conversations contain synchronized chat messages.',
      inputSchema: {
        projectId: projectId
          .optional()
          .describe('Only return conversations linked to this project.'),
      },
      annotations: READ_ONLY,
    },
    (args) => run(() => api.listConversations(args.projectId)),
  );

  server.registerTool(
    'get_conversation',
    {
      title: 'Get conversation',
      description: 'Read a single captured conversation by identifier.',
      inputSchema: {
        conversationId,
      },
      annotations: READ_ONLY,
    },
    (args) => run(() => api.getConversation(args.conversationId)),
  );

  server.registerTool(
    'list_messages',
    {
      title: 'List messages',
      description:
        'List synchronized messages for a conversation in sequence order. Use afterSequence for incremental reads and limit to cap the page size.',
      inputSchema: {
        conversationId,
        afterSequence: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe('Return only messages with a sequence greater than this value.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe('Maximum number of messages to return. The core API defaults to 500.'),
      },
      annotations: READ_ONLY,
    },
    (args) =>
      run(() =>
        api.listMessages(args.conversationId, {
          ...(args.afterSequence !== undefined ? { afterSequence: args.afterSequence } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
        }),
      ),
  );

  server.registerTool(
    'list_requirements',
    {
      title: 'List requirements',
      description:
        'List requirements, constraints, dependencies and clarification questions extracted for a project. Items default to proposed status and are not approved automatically.',
      inputSchema: {
        projectId,
        kind: RequirementKindSchema.optional().describe('Filter by extracted item kind.'),
        status: DecisionStatusSchema.optional().describe('Filter by review status.'),
      },
      annotations: READ_ONLY,
    },
    (args) =>
      run(() =>
        api.listRequirements(args.projectId, {
          ...(args.kind !== undefined ? { kind: args.kind } : {}),
          ...(args.status !== undefined ? { status: args.status } : {}),
        }),
      ),
  );

  server.registerTool(
    'list_decisions',
    {
      title: 'List decisions',
      description:
        'List decisions extracted for a project. Items default to proposed status and are not approved automatically.',
      inputSchema: {
        projectId,
        status: DecisionStatusSchema.optional().describe('Filter by review status.'),
      },
      annotations: READ_ONLY,
    },
    (args) =>
      run(() =>
        api.listDecisions(args.projectId, {
          ...(args.status !== undefined ? { status: args.status } : {}),
        }),
      ),
  );

  server.registerTool(
    'list_tasks',
    {
      title: 'List tasks',
      description:
        'List tasks extracted for a project. Tasks default to proposed approval and pending work status; they are suggestions until a user confirms them.',
      inputSchema: {
        projectId,
        status: TaskStatusSchema.optional().describe('Filter by work status.'),
        approvalStatus: TaskApprovalStatusSchema.optional().describe('Filter by approval status.'),
      },
      annotations: READ_ONLY,
    },
    (args) =>
      run(() =>
        api.listTasks(args.projectId, {
          ...(args.status !== undefined ? { status: args.status } : {}),
          ...(args.approvalStatus !== undefined ? { approvalStatus: args.approvalStatus } : {}),
        }),
      ),
  );

  server.registerTool(
    'list_agent_sessions',
    {
      title: 'List agent sessions',
      description:
        'List coding-agent sessions recorded for a project, newest first. Sessions are feedback metadata only; they do not change task approval or work status.',
      inputSchema: {
        projectId,
      },
      annotations: READ_ONLY,
    },
    (args) => run(() => api.listAgentSessions(args.projectId)),
  );

  server.registerTool(
    'get_agent_session',
    {
      title: 'Get agent session',
      description: 'Read a single coding-agent session by identifier.',
      inputSchema: {
        agentSessionId,
      },
      annotations: READ_ONLY,
    },
    (args) => run(() => api.getAgentSession(args.agentSessionId)),
  );

  server.registerTool(
    'list_agent_reports',
    {
      title: 'List agent reports',
      description:
        'List append-only coding-agent reports for a project, newest first. Reports are feedback and never auto-approve tasks or change task status.',
      inputSchema: {
        projectId,
        agentSessionId: optionalAgentSessionId,
        taskId: optionalTaskId,
        type: AgentReportTypeSchema.optional().describe(
          'Filter by report type: progress, completion or blocker.',
        ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe('Maximum number of reports to return. The core API defaults to 200.'),
      },
      annotations: READ_ONLY,
    },
    (args) =>
      run(() =>
        api.listAgentReports(args.projectId, {
          ...(args.agentSessionId !== undefined ? { agentSessionId: args.agentSessionId } : {}),
          ...(args.taskId !== undefined ? { taskId: args.taskId } : {}),
          ...(args.type !== undefined ? { type: args.type } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
        }),
      ),
  );

  server.registerTool(
    'start_agent_session',
    {
      title: 'Start agent session',
      description:
        'Record the start of a coding-agent session for a project. Use the returned session identifier when reporting progress, completion or blockers.',
      inputSchema: {
        projectId,
        agentName: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe('Name of the coding agent or client, for example Antigravity or Codex.'),
        externalSessionId: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .optional()
          .describe('Optional identifier assigned by the external agent or client.'),
        startedAt: z.iso
          .datetime()
          .optional()
          .describe('Optional ISO 8601 start time. Defaults to the current time.'),
      },
      annotations: WRITE,
    },
    (args) =>
      run(() =>
        api.startAgentSession(args.projectId, {
          agentName: args.agentName,
          ...(args.externalSessionId !== undefined
            ? { externalSessionId: args.externalSessionId }
            : {}),
          ...(args.startedAt !== undefined ? { startedAt: args.startedAt } : {}),
        }),
      ),
  );

  server.registerTool(
    'end_agent_session',
    {
      title: 'End agent session',
      description:
        'Mark a coding-agent session as ended. Ending an already ended session returns the existing session unchanged.',
      inputSchema: {
        agentSessionId,
        endedAt: z.iso
          .datetime()
          .optional()
          .describe('Optional ISO 8601 end time. Defaults to the current time.'),
      },
      annotations: IDEMPOTENT_WRITE,
    },
    (args) =>
      run(() =>
        api.endAgentSession(
          args.agentSessionId,
          args.endedAt === undefined ? {} : { endedAt: args.endedAt },
        ),
      ),
  );

  registerReportTool(
    server,
    api,
    'progress',
    'Report progress',
    'Append a progress report for a coding-agent session. This records feedback only; it never approves a task or changes its work status.',
  );

  registerReportTool(
    server,
    api,
    'completion',
    'Report completion',
    'Append a completion report for a coding-agent session. This does not mark the task completed or approved; a user must still review and update the task.',
  );

  registerReportTool(
    server,
    api,
    'blocker',
    'Report blocker',
    'Append a blocker report for a coding-agent session. This records feedback only; it does not change task approval or work status.',
  );
}
