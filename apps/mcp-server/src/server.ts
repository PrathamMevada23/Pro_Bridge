import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CoreApi } from './client.js';
import { registerResources } from './resources.js';
import { registerTools } from './tools.js';
import { SERVICE_VERSION } from './version.js';

export interface CreateMcpServerOptions {
  name?: string;
  version?: string;
}

/**
 * Creates the Pro_Bridge MCP server without connecting a transport. Tests use this with an
 * in-memory transport; the executable uses it with stdio.
 */
export function createMcpServer(api: CoreApi, options: CreateMcpServerOptions = {}): McpServer {
  const server = new McpServer(
    {
      name: options.name ?? 'pro-bridge',
      version: options.version ?? SERVICE_VERSION,
    },
    {
      instructions:
        'Pro_Bridge exposes locally captured project conversations and extracted context. Read tools and resources load project data. Agent feedback tools append coding-agent sessions and progress, completion or blocker reports; they never approve tasks or change task status. Requirements, decisions and tasks are suggestions: check their status fields and never treat proposed items as approved.',
    },
  );

  registerTools(server, api);
  registerResources(server, api);

  return server;
}
