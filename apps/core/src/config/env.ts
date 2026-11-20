import { randomBytes } from 'node:crypto';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

export const LOOPBACK_HOSTS = ['127.0.0.1', '::1', 'localhost'] as const;

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const EXTENSION_PROTOCOLS = new Set(['chrome-extension:', 'moz-extension:']);

const emptyToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const OptionalTokenSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .min(32, 'PRO_BRIDGE_LOCAL_TOKEN must be at least 32 characters long.')
    .optional(),
);

const OptionalOriginsSchema = z.preprocess(emptyToUndefined, z.string().optional());

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PRO_BRIDGE_HOST: z.enum(LOOPBACK_HOSTS).default('127.0.0.1'),
  PRO_BRIDGE_PORT: z.coerce.number().int().min(1).max(65535).default(4317),
  PRO_BRIDGE_LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  PRO_BRIDGE_DATABASE_PATH: z.string().trim().min(1).default('./data/pro-bridge.db'),
  PRO_BRIDGE_BODY_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(100 * 1024 * 1024)
    .default(16 * 1024 * 1024),
  PRO_BRIDGE_LOCAL_TOKEN: OptionalTokenSchema,
  PRO_BRIDGE_ALLOWED_ORIGINS: OptionalOriginsSchema,
});

type Env = z.infer<typeof EnvSchema>;

export interface AppConfig {
  nodeEnv: Env['NODE_ENV'];
  host: (typeof LOOPBACK_HOSTS)[number];
  port: number;
  logLevel: (typeof LOG_LEVELS)[number];
  databasePath: string;
  bodyLimitBytes: number;
  localToken: string;
  tokenWasGenerated: boolean;
  allowedOrigins: string[];
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

function normalizeExtensionOrigin(origin: string): string {
  let url: URL;

  try {
    url = new URL(origin);
  } catch {
    throw new Error(`Invalid origin in PRO_BRIDGE_ALLOWED_ORIGINS: ${origin}`);
  }

  if (!EXTENSION_PROTOCOLS.has(url.protocol) || url.hostname.length === 0) {
    throw new Error(
      `Invalid origin in PRO_BRIDGE_ALLOWED_ORIGINS: ${origin}. ` +
        'Only chrome-extension:// and moz-extension:// origins are supported.',
    );
  }

  if ((url.pathname !== '' && url.pathname !== '/') || url.search !== '' || url.hash !== '') {
    throw new Error(
      `Invalid origin in PRO_BRIDGE_ALLOWED_ORIGINS: ${origin}. Origins cannot contain a path.`,
    );
  }

  return `${url.protocol}//${url.host}`;
}

function parseAllowedOrigins(rawOrigins: string | undefined): string[] {
  if (!rawOrigins) {
    return [];
  }

  const origins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .map(normalizeExtensionOrigin);

  return [...new Set(origins)];
}

/**
 * Loads `.env` from the current working directory. The core app is always started from
 * `apps/core`, so this keeps environment configuration local to the app.
 */
export function loadEnvironment(): void {
  loadDotenv({ quiet: true });
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${formatIssues(parsed.error)}`);
  }

  const {
    NODE_ENV: nodeEnv,
    PRO_BRIDGE_HOST: host,
    PRO_BRIDGE_PORT: port,
    PRO_BRIDGE_LOG_LEVEL: logLevel,
    PRO_BRIDGE_DATABASE_PATH: databasePath,
    PRO_BRIDGE_BODY_LIMIT_BYTES: bodyLimitBytes,
    PRO_BRIDGE_LOCAL_TOKEN: configuredToken,
    PRO_BRIDGE_ALLOWED_ORIGINS: configuredOrigins,
  } = parsed.data;

  if (nodeEnv === 'production' && !configuredToken) {
    throw new Error('PRO_BRIDGE_LOCAL_TOKEN is required when NODE_ENV=production.');
  }

  const allowedOrigins = parseAllowedOrigins(configuredOrigins);

  if (nodeEnv === 'production' && allowedOrigins.length === 0) {
    throw new Error('PRO_BRIDGE_ALLOWED_ORIGINS is required when NODE_ENV=production.');
  }

  const tokenWasGenerated = !configuredToken;

  return {
    nodeEnv,
    host,
    port,
    logLevel,
    databasePath,
    bodyLimitBytes,
    localToken: configuredToken ?? randomBytes(32).toString('hex'),
    tokenWasGenerated,
    allowedOrigins,
  };
}
