import type { AgentReportType } from '@pro-bridge/shared-types';
import { and, desc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../db/client.js';
import { agentReports, agentSessions } from '../db/schema.js';

export type AgentSessionRow = typeof agentSessions.$inferSelect;
export type AgentReportRow = typeof agentReports.$inferSelect;

export interface AgentSessionInsert {
  id: string;
  projectId: string;
  agentName: string;
  externalSessionId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentSessionUpdate {
  endedAt: Date;
  updatedAt: Date;
}

export interface AgentReportInsert {
  id: string;
  projectId: string;
  agentSessionId: string | null;
  taskId: string | null;
  type: AgentReportType;
  summary: string;
  details: string | null;
  modifiedFiles: string[];
  createdAt: Date;
}

export interface AgentReportFilters {
  agentSessionId?: string;
  taskId?: string;
  type?: AgentReportType;
  limit: number;
}

export function listAgentSessionRows(db: AppDatabase, projectId: string): AgentSessionRow[] {
  return db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.projectId, projectId))
    .orderBy(desc(agentSessions.startedAt), desc(agentSessions.id))
    .all();
}

export function findAgentSessionRow(db: AppDatabase, id: string): AgentSessionRow | undefined {
  return db.select().from(agentSessions).where(eq(agentSessions.id, id)).get();
}

export function insertAgentSessionRow(db: AppDatabase, row: AgentSessionInsert): AgentSessionRow {
  return db.insert(agentSessions).values(row).returning().get();
}

export function updateAgentSessionRow(
  db: AppDatabase,
  id: string,
  changes: AgentSessionUpdate,
): AgentSessionRow | undefined {
  return db
    .update(agentSessions)
    .set({ endedAt: changes.endedAt, updatedAt: changes.updatedAt })
    .where(eq(agentSessions.id, id))
    .returning()
    .get();
}

export function listAgentReportRows(
  db: AppDatabase,
  projectId: string,
  filters: AgentReportFilters,
): AgentReportRow[] {
  const conditions = [eq(agentReports.projectId, projectId)];

  if (filters.agentSessionId !== undefined) {
    conditions.push(eq(agentReports.agentSessionId, filters.agentSessionId));
  }

  if (filters.taskId !== undefined) {
    conditions.push(eq(agentReports.taskId, filters.taskId));
  }

  if (filters.type !== undefined) {
    conditions.push(eq(agentReports.type, filters.type));
  }

  return db
    .select()
    .from(agentReports)
    .where(and(...conditions))
    .orderBy(desc(agentReports.createdAt), desc(agentReports.id))
    .limit(filters.limit)
    .all();
}

export function insertAgentReportRow(db: AppDatabase, row: AgentReportInsert): AgentReportRow {
  return db.insert(agentReports).values(row).returning().get();
}
