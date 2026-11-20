import { desc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../db/client.js';
import { projects } from '../db/schema.js';

export type ProjectRow = typeof projects.$inferSelect;

export interface ProjectInsert {
  id: string;
  name: string;
  description: string;
  repositoryPath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  repositoryPath?: string | null;
  updatedAt: Date;
}

export function listProjectRows(db: AppDatabase): ProjectRow[] {
  return db.select().from(projects).orderBy(desc(projects.updatedAt)).all();
}

export function findProjectRow(db: AppDatabase, id: string): ProjectRow | undefined {
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

export function insertProjectRow(db: AppDatabase, row: ProjectInsert): ProjectRow {
  return db.insert(projects).values(row).returning().get();
}

export function updateProjectRow(
  db: AppDatabase,
  id: string,
  changes: ProjectUpdate,
): ProjectRow | undefined {
  const values: Partial<typeof projects.$inferInsert> = {
    updatedAt: changes.updatedAt,
  };

  if (changes.name !== undefined) {
    values.name = changes.name;
  }

  if (changes.description !== undefined) {
    values.description = changes.description;
  }

  if (changes.repositoryPath !== undefined) {
    values.repositoryPath = changes.repositoryPath;
  }

  return db.update(projects).set(values).where(eq(projects.id, id)).returning().get();
}

export function deleteProjectRow(db: AppDatabase, id: string): boolean {
  const result = db.delete(projects).where(eq(projects.id, id)).run();
  return result.changes > 0;
}
