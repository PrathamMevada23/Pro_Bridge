import { resolve } from 'node:path';
import { loadConfig, loadEnvironment } from '../config/env.js';
import { backupDatabase } from '../db/backup.js';

function defaultDestination(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return resolve(process.cwd(), 'backups', `pro-bridge-${timestamp}.db`);
}

async function main(): Promise<void> {
  loadEnvironment();

  const config = loadConfig();
  const destinationPath = process.argv[2] ?? defaultDestination();
  const result = await backupDatabase({
    sourcePath: config.databasePath,
    destinationPath,
  });

  console.log(
    `Backed up ${result.sourcePath} to ${result.destinationPath} (${result.sizeBytes} bytes).`,
  );
}

void main().catch((error: unknown) => {
  console.error('Backup failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
