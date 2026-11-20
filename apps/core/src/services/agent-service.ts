import { randomUUID } from 'node:crypto';
import type { AgentReport, AgentSession } from '@pro-bridge/shared-types';
import type {
  AgentReportCreateInput,
  AgentReportListQuery,
  AgentSessionCreateInput,
  AgentSessionEndInput,
  AgentSessionReportListQuery,
} from '@pro-bridge/validation';
import type { AppDatabase } from '../db/client.js';
import { toAgentReport, toAgentSession } from '../db/mappers.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import {
  findAgentSessionRow,
  insertAgentReportRow,
  insertAgentSessionRow,
  listAgentReportRows,
  listAgentSessionRows,
  updateAgentSessionRow,
  type AgentReportFilters,
} from '../repositories/agent-repository.js';
import { findTaskRow } from '../repositories/context-repository.js';
import { findProjectRow } from '../repositories/project-repository.js';

export class AgentService {
  constructor(private readonly db: AppDatabase) {}

  listSessions(projectId: string): AgentSession[] {
    this.ensureProject(projectId);

    return listAgentSessionRows(this.db, projectId).map(toAgentSession);
  }

  getSession(agentSessionId: string): AgentSession {
    const row = findAgentSessionRow(this.db, agentSessionId);

    if (!row) {
      throw new NotFoundError('Agent session not found.');
    }

    return toAgentSession(row);
  }

  startSession(projectId: string, input: AgentSessionCreateInput): AgentSession {
    this.ensureProject(projectId);

    const now = new Date();
    const row = insertAgentSessionRow(this.db, {
      id: randomUUID(),
      projectId,
      agentName: input.agentName,
      externalSessionId: input.externalSessionId ?? null,
      startedAt: input.startedAt ? new Date(input.startedAt) : now,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return toAgentSession(row);
  }

  endSession(agentSessionId: string, input: AgentSessionEndInput): AgentSession {
    const existing = findAgentSessionRow(this.db, agentSessionId);

    if (!existing) {
      throw new NotFoundError('Agent session not found.');
    }

    if (existing.endedAt) {
      return toAgentSession(existing);
    }

    const endedAt = input.endedAt ? new Date(input.endedAt) : new Date();

    if (endedAt.getTime() < existing.startedAt.getTime()) {
      throw new BadRequestError('endedAt must not be before the session started.');
    }

    const row = updateAgentSessionRow(this.db, agentSessionId, {
      endedAt,
      updatedAt: endedAt,
    });

    if (!row) {
      throw new NotFoundError('Agent session not found.');
    }

    return toAgentSession(row);
  }

  listReports(projectId: string, query: AgentReportListQuery): AgentReport[] {
    this.ensureProject(projectId);

    const filters: AgentReportFilters = { limit: query.limit };

    if (query.agentSessionId !== undefined) {
      filters.agentSessionId = query.agentSessionId;
    }

    if (query.taskId !== undefined) {
      filters.taskId = query.taskId;
    }

    if (query.type !== undefined) {
      filters.type = query.type;
    }

    return listAgentReportRows(this.db, projectId, filters).map(toAgentReport);
  }

  listSessionReports(agentSessionId: string, query: AgentSessionReportListQuery): AgentReport[] {
    const session = findAgentSessionRow(this.db, agentSessionId);

    if (!session) {
      throw new NotFoundError('Agent session not found.');
    }

    const filters: AgentReportFilters = {
      agentSessionId,
      limit: query.limit,
    };

    if (query.taskId !== undefined) {
      filters.taskId = query.taskId;
    }

    if (query.type !== undefined) {
      filters.type = query.type;
    }

    return listAgentReportRows(this.db, session.projectId, filters).map(toAgentReport);
  }

  createReport(projectId: string, input: AgentReportCreateInput): AgentReport {
    this.ensureProject(projectId);
    this.validateSessionProject(projectId, input.agentSessionId);
    this.validateTaskProject(projectId, input.taskId);

    const row = insertAgentReportRow(this.db, {
      id: randomUUID(),
      projectId,
      agentSessionId: input.agentSessionId ?? null,
      taskId: input.taskId ?? null,
      type: input.type,
      summary: input.summary,
      details: input.details ?? null,
      modifiedFiles: input.modifiedFiles ?? [],
      createdAt: new Date(),
    });

    return toAgentReport(row);
  }

  private validateSessionProject(projectId: string, agentSessionId?: string | null): void {
    if (!agentSessionId) {
      return;
    }

    const session = findAgentSessionRow(this.db, agentSessionId);

    if (!session) {
      throw new NotFoundError('Agent session not found.');
    }

    if (session.projectId !== projectId) {
      throw new BadRequestError('Agent session does not belong to this project.');
    }
  }

  private validateTaskProject(projectId: string, taskId?: string | null): void {
    if (!taskId) {
      return;
    }

    const task = findTaskRow(this.db, taskId);

    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    if (task.projectId !== projectId) {
      throw new BadRequestError('Task does not belong to this project.');
    }
  }

  private ensureProject(projectId: string): void {
    if (!findProjectRow(this.db, projectId)) {
      throw new NotFoundError('Project not found.');
    }
  }
}
