import Database from 'better-sqlite3';
import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backupDatabase } from '../src/db/backup.js';

const tmpBase = join(tmpdir(), 'pro-bridge-backup-test');

function uniqueDir(): string {
  return join(tmpBase, Math.random().toString(36).slice(2));
}

function createSourceDb(path: string): void {
  const db = new Database(path);
  db.exec('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY)');
  db.exec('INSERT INTO test VALUES (1)');
  db.close();
}

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe('backupDatabase', () => {
  it('rejects an in-memory source', async () => {
    await expect(
      backupDatabase({
        sourcePath: ':memory:',
        destinationPath: join(uniqueDir(), 'backup.db'),
      }),
    ).rejects.toThrow('Cannot back up an in-memory database.');
  });

  it('rejects when source and destination resolve to the same path', async () => {
    const dir = uniqueDir();
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, 'source.db');
    createSourceDb(dbPath);

    await expect(
      backupDatabase({
        sourcePath: dbPath,
        destinationPath: dbPath,
      }),
    ).rejects.toThrow('Backup destination must differ from the source database.');
  });

  it('creates a backup and returns resolved paths with a byte count', async () => {
    const dir = uniqueDir();
    mkdirSync(dir, { recursive: true });
    const sourcePath = join(dir, 'source.db');
    const destPath = join(dir, 'backup', 'backup.db');

    createSourceDb(sourcePath);

    const result = await backupDatabase({
      sourcePath,
      destinationPath: destPath,
    });

    expect(result.sourcePath).toBe(resolve(sourcePath));
    expect(result.destinationPath).toBe(resolve(destPath));
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('creates the destination directory when it does not exist', async () => {
    const dir = uniqueDir();
    mkdirSync(dir, { recursive: true });
    const sourcePath = join(dir, 'source.db');
    const destPath = join(dir, 'nested', 'sub', 'backup.db');

    createSourceDb(sourcePath);

    const result = await backupDatabase({
      sourcePath,
      destinationPath: destPath,
    });

    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('rejects when the source database does not exist', async () => {
    const dir = uniqueDir();
    mkdirSync(dir, { recursive: true });

    await expect(
      backupDatabase({
        sourcePath: join(dir, 'nonexistent.db'),
        destinationPath: join(dir, 'backup.db'),
      }),
    ).rejects.toThrow();
  });
});
