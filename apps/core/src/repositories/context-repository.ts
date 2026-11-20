import type {
  DecisionStatus,
  RequirementKind,
  TaskApprovalStatus,
  TaskStatus,
} from '@pro-bridge/shared-types';
import { and, asc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../db/client.js';
import { decisions, requirements, tasks } from '../db/schema.js';

export type RequirementRow = typeof requirements.$inferSelect;
export type DecisionRow = typeof decisions.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;

export interface RequirementInsert {
  id: string;
  projectId: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  kind: RequirementKind;
  text: string;
  status: DecisionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DecisionInsert {
  id: string;
  projectId: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  text: string;
  rationale: string | null;
  status: DecisionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskInsert {
  id: string;
  projectId: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  title: string;
  description: string;
  approvalStatus: TaskApprovalStatus;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface ContextRowsInput {
  requirements: RequirementInsert[];
  decisions: DecisionInsert[];
  tasks: TaskInsert[];
}

export interface ContextRowsResult {
  requirements: RequirementRow[];
  decisions: DecisionRow[];
  tasks: TaskRow[];
}

export interface RequirementFilters {
  kind?: RequirementKind;
  status?: DecisionStatus;
}

export interface DecisionFilters {
  status?: DecisionStatus;
}

export interface TaskFilters {
  status?: TaskStatus;
  approvalStatus?: TaskApprovalStatus;
}

export interface RequirementUpdate {
  status: DecisionStatus;
  updatedAt: Date;
}

export interface DecisionUpdate {
  status: DecisionStatus;
  updatedAt: Date;
}

export interface TaskUpdate {
  approvalStatus?: TaskApprovalStatus;
  status?: TaskStatus;
  completedAt?: Date | null;
  updatedAt: Date;
}

export function listRequirementRows(
  db: AppDatabase,
  projectId: string,
  filters: RequirementFilters = {},
): RequirementRow[] {
  const conditions = [eq(requirements.projectId, projectId)];

  if (filters.kind !== undefined) {
    conditions.push(eq(requirements.kind, filters.kind));
  }

  if (filters.status !== undefined) {
    conditions.push(eq(requirements.status, filters.status));
  }

  return db
    .select()
    .from(requirements)
    .where(and(...conditions))
    .orderBy(asc(requirements.createdAt), asc(requirements.id))
    .all();
}

export function listDecisionRows(
  db: AppDatabase,
  projectId: string,
  filters: DecisionFilters = {},
): DecisionRow[] {
  const conditions = [eq(decisions.projectId, projectId)];

  if (filters.status !== undefined) {
    conditions.push(eq(decisions.status, filters.status));
  }

  return db
    .select()
    .from(decisions)
    .where(and(...conditions))
    .orderBy(asc(decisions.createdAt), asc(decisions.id))
    .all();
}

export function listTaskRows(
  db: AppDatabase,
  projectId: string,
  filters: TaskFilters = {},
): TaskRow[] {
  const conditions = [eq(tasks.projectId, projectId)];

  if (filters.status !== undefined) {
    conditions.push(eq(tasks.status, filters.status));
  }

  if (filters.approvalStatus !== undefined) {
    conditions.push(eq(tasks.approvalStatus, filters.approvalStatus));
  }

  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(asc(tasks.createdAt), asc(tasks.id))
    .all();
}

export function insertContextRows(db: AppDatabase, input: ContextRowsInput): ContextRowsResult {
  return db.transaction((tx) => ({
    requirements: input.requirements.map((row) =>
      tx.insert(requirements).values(row).returning().get(),
    ),
    decisions: input.decisions.map((row) => tx.insert(decisions).values(row).returning().get()),
    tasks: input.tasks.map((row) => tx.insert(tasks).values(row).returning().get()),
  }));
}

export function findRequirementRow(db: AppDatabase, id: string): RequirementRow | undefined {
  return db.select().from(requirements).where(eq(requirements.id, id)).get();
}

export function findDecisionRow(db: AppDatabase, id: string): DecisionRow | undefined {
  return db.select().from(decisions).where(eq(decisions.id, id)).get();
}

export function findTaskRow(db: AppDatabase, id: string): TaskRow | undefined {
  return db.select().from(tasks).where(eq(tasks.id, id)).get();
}

export function updateRequirementRow(
  db: AppDatabase,
  id: string,
  changes: RequirementUpdate,
): RequirementRow | undefined {
  return db
    .update(requirements)
    .set({ status: changes.status, updatedAt: changes.updatedAt })
    .where(eq(requirements.id, id))
    .returning()
    .get();
}

export function updateDecisionRow(
  db: AppDatabase,
  id: string,
  changes: DecisionUpdate,
): DecisionRow | undefined {
  return db
    .update(decisions)
    .set({ status: changes.status, updatedAt: changes.updatedAt })
    .where(eq(decisions.id, id))
    .returning()
    .get();
}

export function updateTaskRow(
  db: AppDatabase,
  id: string,
  changes: TaskUpdate,
): TaskRow | undefined {
  const values: Partial<typeof tasks.$inferInsert> = {
    updatedAt: changes.updatedAt,
  };

  if (changes.approvalStatus !== undefined) {
    values.approvalStatus = changes.approvalStatus;
  }

  if (changes.status !== undefined) {
    values.status = changes.status;
  }

  if (changes.completedAt !== undefined) {
    values.completedAt = changes.completedAt;
  }

  return db.update(tasks).set(values).where(eq(tasks.id, id)).returning().get();
}
