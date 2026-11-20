import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  clean: true,
  sourcemap: true,
  dts: false,
  external: [
    '@modelcontextprotocol/sdk',
    '@pro-bridge/shared-types',
    '@pro-bridge/validation',
    'zod',
  ],
  define: {
    __SERVICE_VERSION__: JSON.stringify(packageJson.version),
  },
});
