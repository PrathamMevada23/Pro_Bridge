import { randomUUID } from 'node:crypto';
import { extractContext, normalizeTextForComparison } from '@pro-bridge/context-engine';
import type {
  ContextExtractionResult,
  Decision,
  ProjectContext,
  Requirement,
  Task,
} from '@pro-bridge/shared-types';
import type {
  DecisionListQuery,
  DecisionUpdateInput,
  RequirementListQuery,
  RequirementUpdateInput,
  TaskListQuery,
  TaskUpdateInput,
} from '@pro-bridge/validation';
import type { AppDatabase } from '../db/client.js';
import { toDecision, toRequirement, toTask } from '../db/mappers.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import {
  findConversationRowById,
  listAllMessageRows,
} from '../repositories/conversation-repository.js';
import {
  findTaskRow,
  insertContextRows,
  listDecisionRows,
  listRequirementRows,
  listTaskRows,
  updateDecisionRow,
  updateRequirementRow,
  updateTaskRow,
  type DecisionInsert,
  type RequirementInsert,
  type TaskInsert,
  type TaskUpdate,
} from '../repositories/context-repository.js';
import { findProjectRow } from '../repositories/project-repository.js';

export class ContextService {
  constructor(private readonly db: AppDatabase) {}

  extractConversation(conversationId: string): ContextExtractionResult {
    const conversation = findConversationRowById(this.db, conversationId);

    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }

    if (!conversation.projectId) {
      throw new BadRequestError('Conversation must be linked to a project before extraction.');
    }

    const projectId = conversation.projectId;
    const messages = listAllMessageRows(this.db, conversationId).map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      sequence: row.sequence,
    }));
    const extracted = extractContext(messages);
    const existingRequirementKeys = new Set(
      listRequirementRows(this.db, projectId).map(
        (row) => `${row.kind}:${normalizeTextForComparison(row.text)}`,
      ),
    );
    const existingDecisionKeys = new Set(
      listDecisionRows(this.db, projectId).map((row) => normalizeTextForComparison(row.text)),
    );
    const existingTaskKeys = new Set(
      listTaskRows(this.db, projectId).map((row) => normalizeTextForComparison(row.title)),
    );

    const now = new Date();
    let duplicatesSkipped = 0;
    const requirementInserts: RequirementInsert[] = [];
    const decisionInserts: DecisionInsert[] = [];
    const taskInserts: TaskInsert[] = [];

    for (const item of extracted.requirements) {
      const key = `${item.kind}:${normalizeTextForComparison(item.text)}`;

      if (existingRequirementKeys.has(key)) {
        duplicatesSkipped += 1;
        continue;
      }

      existingRequirementKeys.add(key);
      requirementInserts.push({
        id: randomUUID(),
        projectId,
        conversationId,
        sourceMessageId: item.sourceMessageId,
        kind: item.kind,
        text: item.text,
        status: 'proposed',
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const item of extracted.decisions) {
      const key = normalizeTextForComparison(item.text);

      if (existingDecisionKeys.has(key)) {
        duplicatesSkipped += 1;
        continue;
      }

      existingDecisionKeys.add(key);
      decisionInserts.push({
        id: randomUUID(),
        projectId,
        conversationId,
        sourceMessageId: item.sourceMessageId,
        text: item.text,
        rationale: item.rationale,
        status: 'proposed',
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const item of extracted.tasks) {
      const key = normalizeTextForComparison(item.title);

      if (existingTaskKeys.has(key)) {
        duplicatesSkipped += 1;
        continue;
      }

      existingTaskKeys.add(key);
      taskInserts.push({
        id: randomUUID(),
        projectId,
        conversationId,
        sourceMessageId: item.sourceMessageId,
        title: item.title,
        description: item.description,
        approvalStatus: 'proposed',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    }

    const inserted = insertContextRows(this.db, {
      requirements: requirementInserts,
      decisions: decisionInserts,
      tasks: taskInserts,
    });

    return {
      projectId,
      conversationId,
      requirementsCreated: inserted.requirements.length,
      decisionsCreated: inserted.decisions.length,
      tasksCreated: inserted.tasks.length,
      duplicatesSkipped,
      requirements: inserted.requirements.map(toRequirement),
      decisions: inserted.decisions.map(toDecision),
      tasks: inserted.tasks.map(toTask),
    };
  }

  getProjectContext(projectId: string): ProjectContext {
    this.ensureProject(projectId);

    return {
      projectId,
      requirements: listRequirementRows(this.db, projectId).map(toRequirement),
      decisions: listDecisionRows(this.db, projectId).map(toDecision),
      tasks: listTaskRows(this.db, projectId).map(toTask),
    };
  }

  listRequirements(projectId: string, query: RequirementListQuery): Requirement[] {
    this.ensureProject(projectId);

    const filters: {
      kind?: NonNullable<RequirementListQuery['kind']>;
      status?: NonNullable<RequirementListQuery['status']>;
    } = {};

    if (query.kind !== undefined) {
      filters.kind = query.kind;
    }

    if (query.status !== undefined) {
      filters.status = query.status;
    }

    return listRequirementRows(this.db, projectId, filters).map(toRequirement);
  }

  listDecisions(projectId: string, query: DecisionListQuery): Decision[] {
    this.ensureProject(projectId);

    const filters: { status?: NonNullable<DecisionListQuery['status']> } = {};

    if (query.status !== undefined) {
      filters.status = query.status;
    }

    return listDecisionRows(this.db, projectId, filters).map(toDecision);
  }

  listTasks(projectId: string, query: TaskListQuery): Task[] {
    this.ensureProject(projectId);

    const filters: {
      status?: NonNullable<TaskListQuery['status']>;
      approvalStatus?: NonNullable<TaskListQuery['approvalStatus']>;
    } = {};

    if (query.status !== undefined) {
      filters.status = query.status;
    }

    if (query.approvalStatus !== undefined) {
      filters.approvalStatus = query.approvalStatus;
    }

    return listTaskRows(this.db, projectId, filters).map(toTask);
  }

  updateRequirement(id: string, input: RequirementUpdateInput): Requirement {
    const row = updateRequirementRow(this.db, id, {
      status: input.status,
      updatedAt: new Date(),
    });

    if (!row) {
      throw new NotFoundError('Requirement not found.');
    }

    return toRequirement(row);
  }

  updateDecision(id: string, input: DecisionUpdateInput): Decision {
    const row = updateDecisionRow(this.db, id, {
      status: input.status,
      updatedAt: new Date(),
    });

    if (!row) {
      throw new NotFoundError('Decision not found.');
    }

    return toDecision(row);
  }

  updateTask(id: string, input: TaskUpdateInput): Task {
    const existing = findTaskRow(this.db, id);

    if (!existing) {
      throw new NotFoundError('Task not found.');
    }

    const now = new Date();
    const changes: TaskUpdate = { updatedAt: now };

    if (input.approvalStatus !== undefined) {
      changes.approvalStatus = input.approvalStatus;
    }

    if (input.status !== undefined) {
      changes.status = input.status;
      changes.completedAt = input.status === 'completed' ? (existing.completedAt ?? now) : null;
    }

    const row = updateTaskRow(this.db, id, changes);

    if (!row) {
      throw new NotFoundError('Task not found.');
    }

    return toTask(row);
  }

  private ensureProject(projectId: string): void {
    if (!findProjectRow(this.db, projectId)) {
      throw new NotFoundError('Project not found.');
    }
  }
}
