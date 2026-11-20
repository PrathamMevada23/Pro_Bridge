import { z } from 'zod';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

const EnvSchema = z.object({
  PRO_BRIDGE_API_URL: z.string().trim().default('http://127.0.0.1:4317'),
  PRO_BRIDGE_LOCAL_TOKEN: z
    .string()
    .trim()
    .min(32, 'PRO_BRIDGE_LOCAL_TOKEN must be at least 32 characters long.'),
});

export interface McpConfig {
  apiBaseUrl: string;
  token: string;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

function parseApiBaseUrl(rawUrl: string): string {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid PRO_BRIDGE_API_URL: ${rawUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('PRO_BRIDGE_API_URL must use http or https.');
  }

  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(
      'PRO_BRIDGE_API_URL must point to a loopback host: 127.0.0.1, ::1 or localhost.',
    );
  }

  if (url.username !== '' || url.password !== '') {
    throw new Error('PRO_BRIDGE_API_URL must not include credentials.');
  }

  if ((url.pathname !== '' && url.pathname !== '/') || url.search !== '' || url.hash !== '') {
    throw new Error('PRO_BRIDGE_API_URL must not include a path, query or fragment.');
  }

  return url.origin;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const parsed = EnvSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error(`Invalid MCP server configuration:\n${formatIssues(parsed.error)}`);
  }

  return {
    apiBaseUrl: parseApiBaseUrl(parsed.data.PRO_BRIDGE_API_URL),
    token: parsed.data.PRO_BRIDGE_LOCAL_TOKEN,
  };
}
