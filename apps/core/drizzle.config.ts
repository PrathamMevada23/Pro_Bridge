import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.PRO_BRIDGE_DATABASE_PATH ?? './data/pro-bridge.db',
  },
  verbose: true,
  strict: true,
});
