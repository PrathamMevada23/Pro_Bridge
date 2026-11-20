import { mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';

export interface BackupDatabaseOptions {
  sourcePath: string;
  destinationPath: string;
}

export interface BackupDatabaseResult {
  sourcePath: string;
  destinationPath: string;
  sizeBytes: number;
}

/**
 * Creates a consistent copy of a SQLite database using SQLite's online backup API. The
 * source is opened read-only, so a running core API can continue serving requests while the
 * backup is taken.
 */
export async function backupDatabase(
  options: BackupDatabaseOptions,
): Promise<BackupDatabaseResult> {
  if (options.sourcePath === ':memory:') {
    throw new Error('Cannot back up an in-memory database.');
  }

  const sourcePath = resolve(options.sourcePath);
  const destinationPath = resolve(options.destinationPath);

  if (sourcePath === destinationPath) {
    throw new Error('Backup destination must differ from the source database.');
  }

  mkdirSync(dirname(destinationPath), { recursive: true });

  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });

  try {
    await source.backup(destinationPath);
  } finally {
    source.close();
  }

  return {
    sourcePath,
    destinationPath,
    sizeBytes: statSync(destinationPath).size,
  };
}
