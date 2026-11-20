import { randomUUID } from 'node:crypto';
import type { Project } from '@pro-bridge/shared-types';
import type { ProjectCreateInput, ProjectUpdateInput } from '@pro-bridge/validation';
import type { AppDatabase } from '../db/client.js';
import { toProject } from '../db/mappers.js';
import { NotFoundError } from '../errors.js';
import {
  deleteProjectRow,
  findProjectRow,
  insertProjectRow,
  listProjectRows,
  updateProjectRow,
  type ProjectUpdate,
} from '../repositories/project-repository.js';

export class ProjectService {
  constructor(private readonly db: AppDatabase) {}

  list(): Project[] {
    return listProjectRows(this.db).map(toProject);
  }

  get(id: string): Project {
    const row = findProjectRow(this.db, id);

    if (!row) {
      throw new NotFoundError('Project not found.');
    }

    return toProject(row);
  }

  create(input: ProjectCreateInput): Project {
    const now = new Date();
    const row = insertProjectRow(this.db, {
      id: randomUUID(),
      name: input.name,
      description: input.description ?? '',
      repositoryPath: input.repositoryPath ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return toProject(row);
  }

  update(id: string, input: ProjectUpdateInput): Project {
    const changes: ProjectUpdate = { updatedAt: new Date() };

    if (input.name !== undefined) {
      changes.name = input.name;
    }

    if (input.description !== undefined) {
      changes.description = input.description;
    }

    if (input.repositoryPath !== undefined) {
      changes.repositoryPath = input.repositoryPath;
    }

    const row = updateProjectRow(this.db, id, changes);

    if (!row) {
      throw new NotFoundError('Project not found.');
    }

    return toProject(row);
  }

  delete(id: string): void {
    if (!deleteProjectRow(this.db, id)) {
      throw new NotFoundError('Project not found.');
    }
  }
}
