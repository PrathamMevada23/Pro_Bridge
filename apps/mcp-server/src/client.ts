import type {
  AgentReport,
  AgentReportType,
  AgentSession,
  Conversation,
  Decision,
  DecisionStatus,
  Message,
  Project,
  ProjectContext,
  Requirement,
  RequirementKind,
  Task,
  TaskApprovalStatus,
  TaskStatus,
} from '@pro-bridge/shared-types';
import {
  AgentReportListResponseSchema,
  AgentReportSchema,
  AgentSessionListResponseSchema,
  AgentSessionSchema,
  ApiErrorBodySchema,
  ConversationListResponseSchema,
  ConversationSchema,
  DecisionListResponseSchema,
  MessageListResponseSchema,
  ProjectContextSchema,
  ProjectListResponseSchema,
  ProjectSchema,
  RequirementListResponseSchema,
  TaskListResponseSchema,
  type AgentReportCreateInput,
  type AgentSessionCreateInput,
  type AgentSessionEndInput,
} from '@pro-bridge/validation';

export interface MessageQuery {
  afterSequence?: number;
  limit?: number;
}

export interface RequirementQuery {
  kind?: RequirementKind;
  status?: DecisionStatus;
}

export interface DecisionQuery {
  status?: DecisionStatus;
}

export interface TaskQuery {
  status?: TaskStatus;
  approvalStatus?: TaskApprovalStatus;
}

export interface AgentReportQuery {
  agentSessionId?: string;
  taskId?: string;
  type?: AgentReportType;
  limit?: number;
}

export interface AgentSessionReportQuery {
  taskId?: string;
  type?: AgentReportType;
  limit?: number;
}

/**
 * Surface used by the MCP tools and resources. Read methods load captured data; the agent
 * session and report methods append feedback without changing task approval or work status.
 * Keeping this as an interface makes the MCP layer testable without a running core API.
 */
export interface CoreApi {
  listProjects(): Promise<Project[]>;
  getProject(projectId: string): Promise<Project>;
  listConversations(projectId?: string): Promise<Conversation[]>;
  getConversation(conversationId: string): Promise<Conversation>;
  listMessages(conversationId: string, query?: MessageQuery): Promise<Message[]>;
  getProjectContext(projectId: string): Promise<ProjectContext>;
  listRequirements(projectId: string, query?: RequirementQuery): Promise<Requirement[]>;
  listDecisions(projectId: string, query?: DecisionQuery): Promise<Decision[]>;
  listTasks(projectId: string, query?: TaskQuery): Promise<Task[]>;
  listAgentSessions(projectId: string): Promise<AgentSession[]>;
  getAgentSession(agentSessionId: string): Promise<AgentSession>;
  startAgentSession(projectId: string, input: AgentSessionCreateInput): Promise<AgentSession>;
  endAgentSession(agentSessionId: string, input?: AgentSessionEndInput): Promise<AgentSession>;
  listAgentReports(projectId: string, query?: AgentReportQuery): Promise<AgentReport[]>;
  listAgentSessionReports(
    agentSessionId: string,
    query?: AgentSessionReportQuery,
  ): Promise<AgentReport[]>;
  createAgentReport(projectId: string, input: AgentReportCreateInput): Promise<AgentReport>;
}

export class CoreApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'CoreApiError';
    this.status = status;
    this.code = code;
  }
}

export interface CoreApiClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 200;
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

function isRetryable(error: CoreApiError): boolean {
  return error.status === 0 || RETRYABLE_STATUS_CODES.has(error.status);
}

function retryDelay(attempt: number, baseDelayMs: number): Promise<void> {
  const delayMs = baseDelayMs * 2 ** attempt;

  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query.length > 0 ? `?${query}` : '';
}

export class CoreApiClient implements CoreApi {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;

  constructor(options: CoreApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.fetchImpl = options.fetchImpl
      ? options.fetchImpl
      : (input, init) => globalThis.fetch(input, init);
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_MAX_RETRIES);
    this.retryBaseDelayMs = Math.max(0, options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS);
  }

  async listProjects(): Promise<Project[]> {
    const body = ProjectListResponseSchema.parse(
      await this.request('/api/projects', { method: 'GET' }),
    );

    return body.projects;
  }

  async getProject(projectId: string): Promise<Project> {
    return ProjectSchema.parse(
      await this.request(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'GET' }),
    );
  }

  async listConversations(projectId?: string): Promise<Conversation[]> {
    const body = ConversationListResponseSchema.parse(
      await this.request(`/api/conversations${queryString({ projectId })}`, { method: 'GET' }),
    );

    return body.conversations;
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    return ConversationSchema.parse(
      await this.request(`/api/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'GET',
      }),
    );
  }

  async listMessages(conversationId: string, query: MessageQuery = {}): Promise<Message[]> {
    const body = MessageListResponseSchema.parse(
      await this.request(
        `/api/conversations/${encodeURIComponent(conversationId)}/messages${queryString({
          afterSequence: query.afterSequence,
          limit: query.limit,
        })}`,
        { method: 'GET' },
      ),
    );

    return body.messages;
  }

  async getProjectContext(projectId: string): Promise<ProjectContext> {
    return ProjectContextSchema.parse(
      await this.request(`/api/projects/${encodeURIComponent(projectId)}/context`, {
        method: 'GET',
      }),
    );
  }

  async listRequirements(projectId: string, query: RequirementQuery = {}): Promise<Requirement[]> {
    const body = RequirementListResponseSchema.parse(
      await this.request(
        `/api/projects/${encodeURIComponent(projectId)}/requirements${queryString({
          kind: query.kind,
          status: query.status,
        })}`,
        { method: 'GET' },
      ),
    );

    return body.requirements;
  }

  async listDecisions(projectId: string, query: DecisionQuery = {}): Promise<Decision[]> {
    const body = DecisionListResponseSchema.parse(
      await this.request(
        `/api/projects/${encodeURIComponent(projectId)}/decisions${queryString({
          status: query.status,
        })}`,
        { method: 'GET' },
      ),
    );

    return body.decisions;
  }

  async listTasks(projectId: string, query: TaskQuery = {}): Promise<Task[]> {
    const body = TaskListResponseSchema.parse(
      await this.request(
        `/api/projects/${encodeURIComponent(projectId)}/tasks${queryString({
          status: query.status,
          approvalStatus: query.approvalStatus,
        })}`,
        { method: 'GET' },
      ),
    );

    return body.tasks;
  }

  async listAgentSessions(projectId: string): Promise<AgentSession[]> {
    const body = AgentSessionListResponseSchema.parse(
      await this.request(`/api/projects/${encodeURIComponent(projectId)}/agent-sessions`, {
        method: 'GET',
      }),
    );

    return body.sessions;
  }

  async getAgentSession(agentSessionId: string): Promise<AgentSession> {
    return AgentSessionSchema.parse(
      await this.request(`/api/agent-sessions/${encodeURIComponent(agentSessionId)}`, {
        method: 'GET',
      }),
    );
  }

  async startAgentSession(
    projectId: string,
    input: AgentSessionCreateInput,
  ): Promise<AgentSession> {
    return AgentSessionSchema.parse(
      await this.request(`/api/projects/${encodeURIComponent(projectId)}/agent-sessions`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  }

  async endAgentSession(
    agentSessionId: string,
    input: AgentSessionEndInput = {},
  ): Promise<AgentSession> {
    return AgentSessionSchema.parse(
      await this.request(`/api/agent-sessions/${encodeURIComponent(agentSessionId)}/end`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  }

  async listAgentReports(projectId: string, query: AgentReportQuery = {}): Promise<AgentReport[]> {
    const body = AgentReportListResponseSchema.parse(
      await this.request(
        `/api/projects/${encodeURIComponent(projectId)}/agent-reports${queryString({
          agentSessionId: query.agentSessionId,
          taskId: query.taskId,
          type: query.type,
          limit: query.limit,
        })}`,
        { method: 'GET' },
      ),
    );

    return body.reports;
  }

  async listAgentSessionReports(
    agentSessionId: string,
    query: AgentSessionReportQuery = {},
  ): Promise<AgentReport[]> {
    const body = AgentReportListResponseSchema.parse(
      await this.request(
        `/api/agent-sessions/${encodeURIComponent(agentSessionId)}/reports${queryString({
          taskId: query.taskId,
          type: query.type,
          limit: query.limit,
        })}`,
        { method: 'GET' },
      ),
    );

    return body.reports;
  }

  async createAgentReport(projectId: string, input: AgentReportCreateInput): Promise<AgentReport> {
    return AgentReportSchema.parse(
      await this.request(`/api/projects/${encodeURIComponent(projectId)}/agent-reports`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const method = (init.method ?? 'GET').toUpperCase();
    const canRetry = method === 'GET' && init.signal === undefined;
    const attempts = canRetry ? this.maxRetries + 1 : 1;
    let lastError: CoreApiError | undefined;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await this.requestOnce(path, init);
      } catch (error) {
        const apiError =
          error instanceof CoreApiError
            ? error
            : new CoreApiError('The Pro_Bridge core API request failed.', 0);

        lastError = apiError;

        if (!canRetry || attempt === attempts - 1 || !isRetryable(apiError)) {
          throw apiError;
        }

        await retryDelay(attempt, this.retryBaseDelayMs);
      }
    }

    throw lastError ?? new CoreApiError('The Pro_Bridge core API request failed.', 0);
  }

  private async requestOnce(path: string, init: RequestInit): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.token}`);
    headers.set('Accept', 'application/json');

    if (init.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    let response: Response;

    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: init.signal ?? AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new CoreApiError('The Pro_Bridge core API request timed out.', 0);
      }

      throw new CoreApiError(
        'Could not reach the local Pro_Bridge core API. Is the core running?',
        0,
      );
    }

    const text = await response.text();
    let body: unknown = null;

    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }

    if (!response.ok) {
      const errorBody = ApiErrorBodySchema.safeParse(body);
      const message = errorBody.success
        ? errorBody.data.error.message
        : `The local API returned status ${response.status}.`;
      const code = errorBody.success ? errorBody.data.error.code : undefined;

      throw new CoreApiError(message, response.status, code);
    }

    return body;
  }
}
