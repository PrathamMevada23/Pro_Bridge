import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';

export type AppDatabase = BetterSQLite3Database<typeof schema>;
export type SqliteDatabase = InstanceType<typeof Database>;

export interface DatabaseConnection {
  db: AppDatabase;
  sqlite: SqliteDatabase;
  close: () => void;
}

export interface OpenDatabaseOptions {
  path: string;
  migrationsFolder?: string;
  runMigrations?: boolean;
}

function resolveMigrationsFolder(explicitFolder?: string): string {
  if (explicitFolder) {
    return resolve(explicitFolder);
  }

  const candidates = [
    resolve(process.cwd(), 'drizzle'),
    fileURLToPath(new URL('../drizzle', import.meta.url)),
    fileURLToPath(new URL('../../drizzle', import.meta.url)),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? resolve(process.cwd(), 'drizzle');
}

export function openDatabase(options: OpenDatabaseOptions): DatabaseConnection {
  const { path, migrationsFolder, runMigrations = true } = options;
  const databasePath = path === ':memory:' ? path : resolve(path);

  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const sqlite = new Database(databasePath);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');

  const db = drizzle(sqlite, { schema });

  try {
    if (runMigrations) {
      migrate(db, { migrationsFolder: resolveMigrationsFolder(migrationsFolder) });
    }
  } catch (error) {
    sqlite.close();
    throw error;
  }

  return {
    db,
    sqlite,
    close: () => {
      if (sqlite.open) {
        sqlite.close();
      }
    },
  };
}
